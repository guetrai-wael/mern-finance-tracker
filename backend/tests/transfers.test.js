/* Transfers: the invariants that keep moved money from looking like spending. */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Account = require('../src/models/account.model');
const Budget = require('../src/models/budget.model');
const Category = require('../src/models/category.model');
const Transaction = require('../src/models/transaction.model');
const { signAccess } = require('../src/utils/jwt');
const transactionWriter = require('../src/services/transactionWriter');
const migration002 = require('../scripts/migrations/002-assert-account-required');

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const inCurrentMonth = () => new Date(`${CURRENT_MONTH}-15T12:00:00.000Z`);
const daysAhead = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const makeUser = (email) =>
    User.create({
        name: 'Transfer User',
        email,
        password: 'pass',
        isActive: true,
        expiresAt: daysAhead(1)
    });

describe('transfers', () => {
    let user;
    let cookie;
    let bank;
    let cash;

    beforeEach(async () => {
        user = await makeUser('transfer@test.com');
        cookie = `accessToken=${signAccess({ sub: user._id, role: 'user' })}`;
        bank = await Account.create({ user: user._id, name: 'Bank', isDefault: true, openingBalance: 1000 });
        cash = await Account.create({ user: user._id, name: 'Cash', openingBalance: 100 });
    });

    const balanceOf = async (id) => {
        const res = await request(app).get(`/api/v1/accounts/${id}`).set('Cookie', [cookie]);
        return res.body.data.balance;
    };

    it('creates a transfer between two accounts', async () => {
        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({
                amount: 200,
                type: 'transfer',
                account: String(bank._id),
                transferTo: String(cash._id),
                description: 'Cash withdrawal'
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.type).toEqual('transfer');
        expect(String(res.body.data.transferTo)).toEqual(String(cash._id));
    });

    it('moves the balance without changing the total', async () => {
        await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 200, type: 'transfer', account: String(bank._id), transferTo: String(cash._id) });

        expect(await balanceOf(bank._id)).toEqual(800);
        expect(await balanceOf(cash._id)).toEqual(300);
        // The invariant that matters: value relocated, not created or destroyed.
        expect((await balanceOf(bank._id)) + (await balanceOf(cash._id))).toEqual(1100);
    });

    it('rejects a transfer with no destination', async () => {
        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 50, type: 'transfer', account: String(bank._id) });

        expect(res.statusCode).toEqual(400);
        expect(await Transaction.countDocuments()).toEqual(0);
    });

    it('rejects a transfer to the same account', async () => {
        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 50, type: 'transfer', account: String(bank._id), transferTo: String(bank._id) });

        expect(res.statusCode).toEqual(400);
        expect(await Transaction.countDocuments()).toEqual(0);
    });

    it('rejects an expense that carries a destination', async () => {
        // A stale transferTo on a non-transfer would be credited by the balance
        // aggregation, counting the money twice.
        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 50, type: 'expense', account: String(bank._id), transferTo: String(cash._id) });

        expect(res.statusCode).toEqual(400);
    });

    it('refuses an account belonging to someone else', async () => {
        const other = await makeUser('transfer-other@test.com');
        const theirs = await Account.create({ user: other._id, name: 'Theirs' });

        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 50, type: 'transfer', account: String(bank._id), transferTo: String(theirs._id) });

        expect(res.statusCode).toEqual(404);
        expect(await Transaction.countDocuments({ user: user._id })).toEqual(0);
    });

    it('refuses to spend from an account belonging to someone else', async () => {
        const other = await makeUser('transfer-other2@test.com');
        const theirs = await Account.create({ user: other._id, name: 'Theirs' });

        const res = await request(app)
            .post('/api/v1/transactions')
            .set('Cookie', [cookie])
            .send({ amount: 50, type: 'expense', account: String(theirs._id) });

        expect(res.statusCode).toEqual(404);
    });

    it('drops the category — a transfer is not a spending category', async () => {
        const category = await Category.create({ user: user._id, name: 'Food' });

        const { transaction } = await transactionWriter.createTransaction({
            user: user._id,
            amount: 25,
            type: 'transfer',
            account: bank._id,
            transferTo: cash._id,
            category: category._id
        });

        expect(transaction.category).toBeUndefined();
    });

    it('stays out of income and expense totals', async () => {
        await transactionWriter.createTransaction({
            user: user._id, amount: 500, type: 'transfer',
            account: bank._id, transferTo: cash._id
        });

        expect(await Transaction.countDocuments({ user: user._id, type: 'income' })).toEqual(0);
        expect(await Transaction.countDocuments({ user: user._id, type: 'expense' })).toEqual(0);
    });

    it('does not consume budget', async () => {
        await Budget.create({ user: user._id, month: CURRENT_MONTH, totalBudget: 50 });

        const { budgetEvents } = await transactionWriter.createTransaction({
            user: user._id, amount: 5000, type: 'transfer',
            account: bank._id, transferTo: cash._id,
            date: inCurrentMonth()
        });

        expect(budgetEvents).toEqual([]);
    });

    it('appears in a statement for either account', async () => {
        await transactionWriter.createTransaction({
            user: user._id, amount: 200, type: 'transfer',
            account: bank._id, transferTo: cash._id
        });

        const fromSide = await request(app)
            .get(`/api/v1/transactions?account=${bank._id}`).set('Cookie', [cookie]);
        const toSide = await request(app)
            .get(`/api/v1/transactions?account=${cash._id}`).set('Cookie', [cookie]);

        // Money leaving one account is money arriving in the other; both
        // statements must show the movement.
        expect(fromSide.body.data).toHaveLength(1);
        expect(toSide.body.data).toHaveLength(1);
    });

    it('restores both balances when deleted', async () => {
        const { transaction } = await transactionWriter.createTransaction({
            user: user._id, amount: 200, type: 'transfer',
            account: bank._id, transferTo: cash._id
        });

        await request(app)
            .delete(`/api/v1/transactions/${transaction._id}`)
            .set('Cookie', [cookie]);

        expect(await balanceOf(bank._id)).toEqual(1000);
        expect(await balanceOf(cash._id)).toEqual(100);
    });
});

describe('editing a transfer', () => {
    let user;
    let cookie;
    let bank;
    let cash;

    beforeEach(async () => {
        user = await makeUser('transfer-edit@test.com');
        cookie = `accessToken=${signAccess({ sub: user._id, role: 'user' })}`;
        bank = await Account.create({ user: user._id, name: 'Bank', isDefault: true, openingBalance: 1000 });
        cash = await Account.create({ user: user._id, name: 'Cash', openingBalance: 0 });
    });

    const makeTransfer = () =>
        transactionWriter.createTransaction({
            user: user._id, amount: 200, type: 'transfer',
            account: bank._id, transferTo: cash._id
        });

    it('clears the destination when converted to an expense', async () => {
        // The load-modify-save path exists for this: findOneAndUpdate would
        // leave transferTo set, and the balance aggregation credits transferTo
        // on any transfer row, so the money would be counted twice.
        const { transaction } = await makeTransfer();

        const res = await request(app)
            .put(`/api/v1/transactions/${transaction._id}`)
            .set('Cookie', [cookie])
            .send({ type: 'expense' });

        expect(res.statusCode).toEqual(200);

        const updated = await Transaction.findById(transaction._id);
        expect(updated.type).toEqual('expense');
        expect(updated.transferTo == null).toBe(true);
    });

    it('leaves the destination account whole after conversion', async () => {
        const { transaction } = await makeTransfer();

        await request(app)
            .put(`/api/v1/transactions/${transaction._id}`)
            .set('Cookie', [cookie])
            .send({ type: 'expense' });

        const res = await request(app).get(`/api/v1/accounts/${cash._id}`).set('Cookie', [cookie]);
        expect(res.body.data.balance).toEqual(0);
    });

    it('updates the amount on both sides', async () => {
        const { transaction } = await makeTransfer();

        await request(app)
            .put(`/api/v1/transactions/${transaction._id}`)
            .set('Cookie', [cookie])
            .send({ amount: 500 });

        const bankRes = await request(app).get(`/api/v1/accounts/${bank._id}`).set('Cookie', [cookie]);
        const cashRes = await request(app).get(`/api/v1/accounts/${cash._id}`).set('Cookie', [cookie]);

        expect(bankRes.body.data.balance).toEqual(500);
        expect(cashRes.body.data.balance).toEqual(500);
    });

    it('returns 404 for another user\'s transaction', async () => {
        const other = await makeUser('transfer-edit-other@test.com');
        const theirAccount = await Account.create({ user: other._id, name: 'Theirs', isDefault: true });
        const theirs = await transactionWriter.createTransaction({
            user: other._id, amount: 10, type: 'expense', account: theirAccount._id
        });

        const res = await request(app)
            .put(`/api/v1/transactions/${theirs.transaction._id}`)
            .set('Cookie', [cookie])
            .send({ amount: 999 });

        expect(res.statusCode).toEqual(404);
    });
});

describe('002-assert-account-required', () => {
    it('passes when every transaction has an account', async () => {
        const user = await makeUser('migration002@test.com');
        const account = await Account.create({ user: user._id, name: 'Main', isDefault: true });
        await transactionWriter.createTransaction({
            user: user._id, amount: 10, type: 'expense', account: account._id
        });

        const result = await migration002.up({ db: mongoose.connection.db });
        expect(result.verified).toEqual(1);
    });

    it('aborts when a transaction has no account', async () => {
        const user = await makeUser('migration002-bad@test.com');
        // Inserted through the driver to bypass the required constraint.
        await mongoose.connection.db.collection('transactions').insertOne({
            user: user._id, amount: 10, type: 'expense', date: new Date()
        });

        await expect(migration002.up({ db: mongoose.connection.db }))
            .rejects.toThrow(/have no account/);
    });

    it('aborts when a transfer has no destination', async () => {
        const user = await makeUser('migration002-transfer@test.com');
        const account = await Account.create({ user: user._id, name: 'Main', isDefault: true });
        await mongoose.connection.db.collection('transactions').insertOne({
            user: user._id, amount: 10, type: 'transfer', account: account._id, date: new Date()
        });

        await expect(migration002.up({ db: mongoose.connection.db }))
            .rejects.toThrow(/no destination account/);
    });
});
