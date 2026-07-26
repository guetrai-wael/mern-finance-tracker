/* Accounts: CRUD, ownership, derived balances, and the backfill migration. */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Account = require('../src/models/account.model');
const Transaction = require('../src/models/transaction.model');
const { signAccess } = require('../src/utils/jwt');
const transactionWriter = require('../src/services/transactionWriter');
const { resolveDefaultAccount } = require('../src/controllers/accounts.controller');
const migration = require('../scripts/migrations/001-backfill-transaction-accounts');

const daysAhead = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const makeUser = (email) =>
    User.create({
        name: 'Account User',
        email,
        password: 'pass',
        isActive: true,
        expiresAt: daysAhead(1)
    });

describe('Accounts CRUD', () => {
    let user;
    let cookie;

    beforeEach(async () => {
        user = await makeUser('accounts@test.com');
        cookie = `accessToken=${signAccess({ sub: user._id, role: 'user' })}`;
    });

    it('creates an account and makes the first one default', async () => {
        const res = await request(app)
            .post('/api/v1/accounts')
            .set('Cookie', [cookie])
            .send({ name: 'Checking', type: 'bank', openingBalance: 500 });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.name).toEqual('Checking');
        expect(res.body.data.isDefault).toBe(true);
        expect(res.body.data.balance).toEqual(500);
    });

    it('does not make a second account the default', async () => {
        await request(app).post('/api/v1/accounts').set('Cookie', [cookie]).send({ name: 'First' });
        const res = await request(app).post('/api/v1/accounts').set('Cookie', [cookie]).send({ name: 'Second' });

        expect(res.body.data.isDefault).toBe(false);
    });

    it('rejects a duplicate name', async () => {
        await request(app).post('/api/v1/accounts').set('Cookie', [cookie]).send({ name: 'Wallet' });
        const res = await request(app).post('/api/v1/accounts').set('Cookie', [cookie]).send({ name: 'Wallet' });

        expect(res.statusCode).toEqual(400);
    });

    it('rejects an invalid type', async () => {
        const res = await request(app)
            .post('/api/v1/accounts')
            .set('Cookie', [cookie])
            .send({ name: 'Crypto', type: 'bitcoin' });

        expect(res.statusCode).toEqual(400);
    });

    it('hides archived accounts unless asked', async () => {
        await Account.create({ user: user._id, name: 'Old', isArchived: true });
        await Account.create({ user: user._id, name: 'Active' });

        const hidden = await request(app).get('/api/v1/accounts').set('Cookie', [cookie]);
        expect(hidden.body.data).toHaveLength(1);

        const shown = await request(app).get('/api/v1/accounts?includeArchived=true').set('Cookie', [cookie]);
        expect(shown.body.data).toHaveLength(2);
    });

    it('does not leak another user\'s accounts', async () => {
        const other = await makeUser('accounts-other@test.com');
        await Account.create({ user: other._id, name: 'Theirs' });
        await Account.create({ user: user._id, name: 'Mine' });

        const res = await request(app).get('/api/v1/accounts').set('Cookie', [cookie]);

        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].name).toEqual('Mine');
    });

    it('returns 404 for another user\'s account', async () => {
        const other = await makeUser('accounts-other2@test.com');
        const theirs = await Account.create({ user: other._id, name: 'Theirs' });

        const res = await request(app).get(`/api/v1/accounts/${theirs._id}`).set('Cookie', [cookie]);
        expect(res.statusCode).toEqual(404);
    });

    it('refuses to delete an account that still has transactions', async () => {
        const account = await Account.create({ user: user._id, name: 'Busy' });
        await Transaction.create({ user: user._id, amount: 10, type: 'expense', account: account._id });

        const res = await request(app).delete(`/api/v1/accounts/${account._id}`).set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toMatch(/Archive it instead/);
    });

    it('refuses to delete the default account', async () => {
        const account = await Account.create({ user: user._id, name: 'Primary', isDefault: true });

        const res = await request(app).delete(`/api/v1/accounts/${account._id}`).set('Cookie', [cookie]);
        expect(res.statusCode).toEqual(400);
    });

    it('deletes an unused non-default account', async () => {
        await Account.create({ user: user._id, name: 'Primary', isDefault: true });
        const spare = await Account.create({ user: user._id, name: 'Spare' });

        const res = await request(app).delete(`/api/v1/accounts/${spare._id}`).set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(await Account.countDocuments({ user: user._id })).toEqual(1);
    });

    it('moves the default flag without ever having two', async () => {
        const first = await Account.create({ user: user._id, name: 'First', isDefault: true });
        const second = await Account.create({ user: user._id, name: 'Second' });

        const res = await request(app)
            .post(`/api/v1/accounts/${second._id}/default`)
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect((await Account.findById(first._id)).isDefault).toBe(false);
        expect((await Account.findById(second._id)).isDefault).toBe(true);
        expect(await Account.countDocuments({ user: user._id, isDefault: true })).toEqual(1);
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/v1/accounts');
        expect(res.statusCode).toEqual(401);
    });
});

describe('derived balances', () => {
    let user;
    let cookie;

    beforeEach(async () => {
        user = await makeUser('balances@test.com');
        cookie = `accessToken=${signAccess({ sub: user._id, role: 'user' })}`;
    });

    const balanceOf = async (accountId) => {
        const res = await request(app).get(`/api/v1/accounts/${accountId}`).set('Cookie', [cookie]);
        return res.body.data.balance;
    };

    it('starts at the opening balance', async () => {
        const account = await Account.create({ user: user._id, name: 'Fresh', openingBalance: 250 });
        expect(await balanceOf(account._id)).toEqual(250);
    });

    it('adds income and subtracts expenses', async () => {
        const account = await Account.create({ user: user._id, name: 'Main', openingBalance: 100 });

        await transactionWriter.createTransaction({ user: user._id, amount: 50, type: 'income', account: account._id });
        await transactionWriter.createTransaction({ user: user._id, amount: 20, type: 'expense', account: account._id });

        expect(await balanceOf(account._id)).toEqual(130);
    });

    it('moves money across a transfer and leaves the total unchanged', async () => {
        // The invariant that actually matters: a transfer relocates value, it
        // does not create or destroy it.
        const from = await Account.create({ user: user._id, name: 'Bank', openingBalance: 500 });
        const to = await Account.create({ user: user._id, name: 'Cash', openingBalance: 100 });

        await transactionWriter.createTransaction({
            user: user._id, amount: 30, type: 'transfer',
            account: from._id, transferTo: to._id
        });

        expect(await balanceOf(from._id)).toEqual(470);
        expect(await balanceOf(to._id)).toEqual(130);
        expect((await balanceOf(from._id)) + (await balanceOf(to._id))).toEqual(600);
    });

    it('keeps a transfer out of income and expense totals', async () => {
        const from = await Account.create({ user: user._id, name: 'Bank' });
        const to = await Account.create({ user: user._id, name: 'Cash' });

        await transactionWriter.createTransaction({
            user: user._id, amount: 100, type: 'transfer',
            account: from._id, transferTo: to._id
        });

        expect(await Transaction.countDocuments({ user: user._id, type: 'income' })).toEqual(0);
        expect(await Transaction.countDocuments({ user: user._id, type: 'expense' })).toEqual(0);
    });

    it('keeps a transfer out of budget calculations', async () => {
        const Budget = require('../src/models/budget.model');
        const month = new Date().toISOString().slice(0, 7);
        await Budget.create({ user: user._id, month, totalBudget: 50 });

        const from = await Account.create({ user: user._id, name: 'Bank' });
        const to = await Account.create({ user: user._id, name: 'Cash' });

        const { budgetEvents } = await transactionWriter.createTransaction({
            user: user._id, amount: 5000, type: 'transfer',
            account: from._id, transferTo: to._id,
            date: new Date(`${month}-15T12:00:00.000Z`)
        });

        // A transfer far exceeding the budget must not trip it.
        expect(budgetEvents).toEqual([]);
    });
});

describe('resolveDefaultAccount', () => {
    let user;

    beforeEach(async () => {
        user = await makeUser('resolve@test.com');
    });

    it('provisions one on demand', async () => {
        const account = await resolveDefaultAccount(user._id);

        expect(account.name).toEqual('Main Account');
        expect(account.openingBalance).toEqual(0);
        expect(account.isDefault).toBe(true);
    });

    it('returns the same account on repeat calls', async () => {
        const first = await resolveDefaultAccount(user._id);
        const second = await resolveDefaultAccount(user._id);

        expect(String(first._id)).toEqual(String(second._id));
        expect(await Account.countDocuments({ user: user._id })).toEqual(1);
    });

    it('copies the user\'s currency', async () => {
        await User.findByIdAndUpdate(user._id, { $set: { 'settings.currency': 'EUR' } });
        const account = await resolveDefaultAccount(user._id);
        expect(account.currency).toEqual('EUR');
    });

    it('is used automatically when a transaction names no account', async () => {
        const { transaction } = await transactionWriter.createTransaction({
            user: user._id, amount: 25, type: 'expense'
        });

        expect(transaction.account).toBeDefined();
        const account = await Account.findById(transaction.account);
        expect(account.isDefault).toBe(true);
    });
});

describe('001-backfill-transaction-accounts', () => {
    let db;

    beforeEach(() => {
        db = mongoose.connection.db;
    });

    /** Insert through the driver, bypassing mongoose, to produce pre-migration rows. */
    const rawTransaction = (userId, overrides = {}) =>
        db.collection('transactions').insertOne({
            user: userId,
            amount: 100,
            type: 'expense',
            date: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        });

    it('gives every account-less transaction an account', async () => {
        const user = await makeUser('backfill@test.com');
        await rawTransaction(user._id);
        await rawTransaction(user._id, { amount: 50, type: 'income' });

        await migration.up({ db, mongoose });

        expect(await db.collection('transactions').countDocuments({ account: { $exists: false } })).toEqual(0);
        expect(await Account.countDocuments({ user: user._id })).toEqual(1);

        const account = await Account.findOne({ user: user._id });
        expect(account.name).toEqual('Main Account');
        expect(account.openingBalance).toEqual(0);
    });

    it('is a no-op on a second run', async () => {
        const user = await makeUser('backfill-twice@test.com');
        await rawTransaction(user._id);

        const first = await migration.up({ db, mongoose });
        const accountsAfterFirst = await Account.find({ user: user._id });
        const trxAfterFirst = await db.collection('transactions').find({}).toArray();

        const second = await migration.up({ db, mongoose });
        const accountsAfterSecond = await Account.find({ user: user._id });
        const trxAfterSecond = await db.collection('transactions').find({}).toArray();

        expect(accountsAfterSecond).toHaveLength(accountsAfterFirst.length);
        expect(String(accountsAfterSecond[0]._id)).toEqual(String(accountsAfterFirst[0]._id));
        expect(trxAfterSecond.map((t) => String(t.account))).toEqual(trxAfterFirst.map((t) => String(t.account)));
        expect(second.updated).toEqual(0);
        expect(first.updated).toEqual(1);
    });

    it('reuses an account the user already had', async () => {
        const user = await makeUser('backfill-existing@test.com');
        const existing = await Account.create({
            user: user._id, name: 'My Bank', isDefault: true, openingBalance: 900
        });
        await rawTransaction(user._id);

        await migration.up({ db, mongoose });

        expect(await Account.countDocuments({ user: user._id })).toEqual(1);
        const trx = await db.collection('transactions').findOne({ user: user._id });
        expect(String(trx.account)).toEqual(String(existing._id));
    });

    it('leaves already-accounted transactions alone', async () => {
        const user = await makeUser('backfill-partial@test.com');
        const account = await Account.create({ user: user._id, name: 'Existing', isDefault: true });
        await rawTransaction(user._id, { account: account._id });
        await rawTransaction(user._id);

        const result = await migration.up({ db, mongoose });

        expect(result.updated).toEqual(1); // only the account-less one
    });

    it('provisions an account for a user with no transactions', async () => {
        const user = await makeUser('backfill-empty@test.com');

        await migration.up({ db, mongoose });

        expect(await Account.countDocuments({ user: user._id })).toEqual(1);
    });

    it('handles transactions orphaned by a deleted user', async () => {
        const orphanId = new mongoose.Types.ObjectId();
        await rawTransaction(orphanId);

        const result = await migration.up({ db, mongoose });

        expect(result.orphans).toEqual(1);
        expect(await db.collection('transactions').countDocuments({ account: { $exists: false } })).toEqual(0);
    });

    it('writes nothing during a dry run', async () => {
        const user = await makeUser('backfill-dry@test.com');
        await rawTransaction(user._id);

        await migration.up({ db, mongoose, dryRun: true });

        expect(await Account.countDocuments()).toEqual(0);
        expect(await db.collection('transactions').countDocuments({ account: { $exists: false } })).toEqual(1);
    });

    it('rolls back cleanly', async () => {
        const user = await makeUser('backfill-down@test.com');
        await rawTransaction(user._id);

        const meta = await migration.up({ db, mongoose });
        await migration.down({ db, mongoose, meta });

        expect(await db.collection('transactions').countDocuments({ account: { $exists: false } })).toEqual(1);
        expect(await Account.countDocuments({ user: user._id })).toEqual(0);
    });

    it('does not delete an account it did not create during rollback', async () => {
        const user = await makeUser('backfill-down-safe@test.com');
        const handMade = await Account.create({ user: user._id, name: 'Mine', isDefault: true });
        await rawTransaction(user._id);

        const meta = await migration.up({ db, mongoose });
        await migration.down({ db, mongoose, meta });

        // The migration reused the existing account rather than creating one,
        // so rollback must leave it in place.
        expect(await Account.findById(handMade._id)).not.toBeNull();
    });
});
