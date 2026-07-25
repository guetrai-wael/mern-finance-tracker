/* Recurring transaction rules: CRUD + the job runner that posts them. */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Category = require('../src/models/category.model');
const Transaction = require('../src/models/transaction.model');
const RecurringTransaction = require('../src/models/recurringTransaction.model');
const { signAccess } = require('../src/utils/jwt');
const postRecurring = require('../src/jobs/postRecurring');

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const makeUser = async (email) =>
    User.create({
        name: 'Recurring User',
        email,
        password: 'pass',
        isActive: true,
        expiresAt: daysAhead(1)
    });

/** A rule written straight to the DB so nextDue can be placed in the past. */
const makeRule = (user, overrides = {}) =>
    RecurringTransaction.create({
        user: user._id,
        name: 'Rent',
        amount: 1200,
        type: 'expense',
        frequency: 'monthly',
        startDate: daysAgo(30),
        nextDue: daysAgo(1),
        ...overrides
    });

describe('Recurring CRUD', () => {
    let user;
    let cookie;

    beforeEach(async () => {
        user = await makeUser('recurring@test.com');
        cookie = `accessToken=${signAccess({ sub: user._id, role: 'user' })}`;
    });

    it('creates a rule and derives nextDue from the start date', async () => {
        const res = await request(app)
            .post('/api/v1/recurring')
            .set('Cookie', [cookie])
            .send({
                name: 'Netflix',
                amount: 15.99,
                type: 'expense',
                frequency: 'monthly',
                startDate: daysAhead(3).toISOString()
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data.name).toEqual('Netflix');
        expect(res.body.data.nextDue).toBeDefined();
        expect(res.body.data.isActive).toBe(true);
    });

    it('does not backfill history when the start date is in the past', async () => {
        // A rule that "started" two years ago must begin at its next future
        // occurrence, not dump 24 backdated transactions into the ledger.
        const res = await request(app)
            .post('/api/v1/recurring')
            .set('Cookie', [cookie])
            .send({
                name: 'Old Rent',
                amount: 1000,
                type: 'expense',
                frequency: 'monthly',
                startDate: daysAgo(730).toISOString()
            });

        expect(res.statusCode).toEqual(201);
        expect(new Date(res.body.data.nextDue).getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
    });

    it('rejects an unsupported frequency', async () => {
        const res = await request(app)
            .post('/api/v1/recurring')
            .set('Cookie', [cookie])
            .send({
                name: 'Odd', amount: 5, type: 'expense',
                frequency: 'fortnightly', startDate: new Date().toISOString()
            });

        expect(res.statusCode).toEqual(400);
    });

    it('lists only the requesting user\'s rules', async () => {
        const other = await makeUser('other-recurring@test.com');
        await makeRule(user, { name: 'Mine' });
        await makeRule(other, { name: 'Theirs' });

        const res = await request(app).get('/api/v1/recurring').set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].name).toEqual('Mine');
    });

    it('returns 404 updating another user\'s rule', async () => {
        const other = await makeUser('other-update@test.com');
        const rule = await makeRule(other);

        const res = await request(app)
            .put(`/api/v1/recurring/${rule._id}`)
            .set('Cookie', [cookie])
            .send({ amount: 1 });

        expect(res.statusCode).toEqual(404);
    });

    it('deletes a rule', async () => {
        const rule = await makeRule(user);

        const res = await request(app)
            .delete(`/api/v1/recurring/${rule._id}`)
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(await RecurringTransaction.countDocuments({ user: user._id })).toEqual(0);
    });

    it('bulk-undoes the transactions a rule generated', async () => {
        const rule = await makeRule(user, { nextDue: daysAgo(1), frequency: 'daily' });
        await postRecurring();

        expect(await Transaction.countDocuments({ recurringId: rule._id })).toBeGreaterThan(0);

        const res = await request(app)
            .delete(`/api/v1/recurring/${rule._id}/generated`)
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(await Transaction.countDocuments({ recurringId: rule._id })).toEqual(0);
    });
});

describe('postRecurring job', () => {
    let user;

    beforeEach(async () => {
        user = await makeUser('job@test.com');
    });

    it('posts nothing when nothing is due', async () => {
        await makeRule(user, { nextDue: daysAhead(5) });

        const result = await postRecurring();

        expect(result.posted).toEqual(0);
        expect(await Transaction.countDocuments()).toEqual(0);
    });

    it('posts one transaction for one due rule', async () => {
        await makeRule(user, { nextDue: daysAgo(1), frequency: 'monthly' });

        const result = await postRecurring();

        expect(result.posted).toEqual(1);

        const trx = await Transaction.findOne({ user: user._id });
        expect(trx.amount).toEqual(1200);
        expect(trx.type).toEqual('expense');
        expect(trx.source).toEqual('recurring');
        expect(trx.recurringId).toBeDefined();
    });

    it('is idempotent — a second run posts nothing more', async () => {
        await makeRule(user, { nextDue: daysAgo(1), frequency: 'monthly' });

        await postRecurring();
        const second = await postRecurring();

        expect(second.posted).toEqual(0);
        expect(await Transaction.countDocuments({ user: user._id })).toEqual(1);
    });

    it('catches up on every occurrence missed during downtime', async () => {
        // Three days stale on a daily rule: the server was down, and all three
        // must land rather than collapsing into a single entry.
        await makeRule(user, { name: 'Coffee', amount: 5, frequency: 'daily', nextDue: daysAgo(3) });

        const result = await postRecurring();

        expect(result.posted).toEqual(4); // 3 days ago, 2, 1, and today
        expect(await Transaction.countDocuments({ user: user._id })).toEqual(4);
    });

    it('backdates each caught-up transaction to when it was due', async () => {
        await makeRule(user, { name: 'Coffee', amount: 5, frequency: 'daily', nextDue: daysAgo(2) });

        await postRecurring();

        const dates = (await Transaction.find({ user: user._id }).sort({ date: 1 })).map((t) =>
            t.date.toISOString().slice(0, 10)
        );

        // Distinct days, not three copies of today.
        expect(new Set(dates).size).toEqual(dates.length);
        expect(dates[0]).toEqual(daysAgo(2).toISOString().slice(0, 10));
    });

    it('advances nextDue past now', async () => {
        const rule = await makeRule(user, { frequency: 'daily', nextDue: daysAgo(1) });

        await postRecurring();

        const updated = await RecurringTransaction.findById(rule._id);
        expect(updated.nextDue.getTime()).toBeGreaterThan(Date.now());
        expect(updated.lastProcessed).toBeDefined();
    });

    it('skips inactive rules', async () => {
        await makeRule(user, { isActive: false, nextDue: daysAgo(1) });

        const result = await postRecurring();

        expect(result.posted).toEqual(0);
    });

    it('deactivates a rule that has passed its end date', async () => {
        const rule = await makeRule(user, {
            frequency: 'daily',
            nextDue: daysAgo(1),
            endDate: daysAgo(5)
        });

        const result = await postRecurring();

        expect(result.posted).toEqual(0);
        expect(result.deactivated).toEqual(1);
        expect((await RecurringTransaction.findById(rule._id)).isActive).toBe(false);
    });

    it('carries the category onto the generated transaction', async () => {
        const category = await Category.create({ user: user._id, name: 'Housing' });
        await makeRule(user, { category: category._id, nextDue: daysAgo(1) });

        await postRecurring();

        const trx = await Transaction.findOne({ user: user._id });
        expect(String(trx.category)).toEqual(String(category._id));
    });

    it('keeps processing other rules when one fails', async () => {
        await makeRule(user, { name: 'Good', amount: 10, nextDue: daysAgo(1) });
        // amount: null violates the model's required constraint.
        await RecurringTransaction.collection.insertOne({
            user: user._id,
            name: 'Broken',
            amount: null,
            type: 'expense',
            frequency: 'monthly',
            startDate: daysAgo(30),
            nextDue: daysAgo(1),
            isActive: true
        });

        const result = await postRecurring();

        expect(result.posted).toEqual(1);
        expect(await Transaction.countDocuments({ user: user._id })).toEqual(1);
    });

    it('posts income rules as income', async () => {
        await makeRule(user, { name: 'Salary', amount: 3400, type: 'income', nextDue: daysAgo(1) });

        await postRecurring();

        const trx = await Transaction.findOne({ user: user._id });
        expect(trx.type).toEqual('income');
    });
});
