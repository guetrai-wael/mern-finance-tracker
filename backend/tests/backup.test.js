/* Backup and restore, exercised against a real database.
 *
 * These exist because the first version of backup.js shipped broken: it used
 * require('bson'), which resolved to a different major than the copy mongoose
 * creates documents with, and blew up with BSONVersionError on the first real
 * run. Verifying EJSON round-trips in isolation was not enough — the bug only
 * appears when the documents come out of an actual driver.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../src/models/user.model');
const Category = require('../src/models/category.model');
const Transaction = require('../src/models/transaction.model');
const { backupCollections } = require('../scripts/backup');
const { restoreCollection } = require('../scripts/restore');
const { resolveDefaultAccount } = require('../src/controllers/accounts.controller');

const silent = () => {};
const daysAhead = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

let tmpDir;

const makeTmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));

describe('backup and restore', () => {
    let db;
    let user;
    let category;

    beforeEach(async () => {
        db = mongoose.connection.db;
        tmpDir = makeTmpDir();

        user = await User.create({
            name: 'Backup User',
            email: 'backup@test.com',
            password: 'pass',
            isActive: true,
            expiresAt: daysAhead(1)
        });
        category = await Category.create({ user: user._id, name: 'Food' });
        const account = await resolveDefaultAccount(user._id);
        await Transaction.create({
            user: user._id,
            amount: 42.5,
            type: 'expense',
            category: category._id,
            account: account._id,
            date: new Date('2026-03-15T10:30:00.000Z'),
            description: 'Lunch'
        });
    });

    afterEach(() => {
        if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writes a file per collection plus a manifest', async () => {
        const result = await backupCollections(db, tmpDir, { log: silent });

        expect(fs.existsSync(path.join(tmpDir, 'transactions.json'))).toBe(true);
        expect(fs.existsSync(path.join(tmpDir, '_manifest.json'))).toBe(true);
        expect(result.collections.transactions).toEqual(1);
    });

    it('serializes documents produced by the live driver', async () => {
        // The exact operation that threw BSONVersionError in production.
        await expect(backupCollections(db, tmpDir, { log: silent })).resolves.toBeDefined();
    });

    it('preserves ObjectIds as ObjectIds, not strings', async () => {
        await backupCollections(db, tmpDir, { log: silent });

        const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'transactions.json'), 'utf8'));
        // Extended JSON marks an ObjectId with $oid. A plain string here would
        // mean every reference silently becomes text on restore.
        expect(raw[0]._id.$oid).toBeDefined();
        expect(raw[0].user.$oid).toBeDefined();
        expect(raw[0].date.$date).toBeDefined();
    });

    it('round-trips a transaction with its types intact', async () => {
        await backupCollections(db, tmpDir, { log: silent });
        await Transaction.deleteMany({});
        expect(await Transaction.countDocuments()).toEqual(0);

        const result = await restoreCollection(db, {
            dir: tmpDir, collection: 'transactions', confirm: true, log: silent
        });

        expect(result.restored).toEqual(1);

        const restored = await Transaction.findOne({});
        expect(restored.amount).toEqual(42.5);
        expect(restored.description).toEqual('Lunch');
        // The assertions that actually matter: these must be real types, not strings.
        expect(restored.date instanceof Date).toBe(true);
        expect(restored.date.toISOString()).toEqual('2026-03-15T10:30:00.000Z');
        expect(String(restored.user)).toEqual(String(user._id));
        expect(String(restored.category)).toEqual(String(category._id));
    });

    it('keeps populate() working after a restore', async () => {
        // The end-to-end proof that references survived: if _id had become a
        // string, this would resolve to null.
        await backupCollections(db, tmpDir, { log: silent });
        await Transaction.deleteMany({});
        await restoreCollection(db, {
            dir: tmpDir, collection: 'transactions', confirm: true, log: silent
        });

        const restored = await Transaction.findOne({}).populate('category');
        expect(restored.category).not.toBeNull();
        expect(restored.category.name).toEqual('Food');
    });

    it('changes nothing without --confirm', async () => {
        await backupCollections(db, tmpDir, { log: silent });
        await Transaction.deleteMany({});

        const result = await restoreCollection(db, {
            dir: tmpDir, collection: 'transactions', confirm: false, log: silent
        });

        expect(result.dryRun).toBe(true);
        expect(await Transaction.countDocuments()).toEqual(0);
    });

    it('refuses a collection with no backup file', async () => {
        await backupCollections(db, tmpDir, { log: silent });

        await expect(
            restoreCollection(db, { dir: tmpDir, collection: 'nonexistent', confirm: true, log: silent })
        ).rejects.toThrow(/No backup file/);
    });

    it('replaces rather than merges', async () => {
        await backupCollections(db, tmpDir, { log: silent });

        // Add a transaction that was not in the backup.
        const account = await resolveDefaultAccount(user._id);
        await Transaction.create({ user: user._id, amount: 999, type: 'income', account: account._id });
        expect(await Transaction.countDocuments()).toEqual(2);

        await restoreCollection(db, {
            dir: tmpDir, collection: 'transactions', confirm: true, log: silent
        });

        expect(await Transaction.countDocuments()).toEqual(1);
        expect(await Transaction.countDocuments({ amount: 999 })).toEqual(0);
    });
});
