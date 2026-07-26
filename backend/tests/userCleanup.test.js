/* Deleting a user must take their data with it.
 *
 * Before this, both delete paths removed only the User document. The wallets
 * backfill found the consequence in production: one of five user ids owning
 * transactions had no User record left.
 */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Account = require('../src/models/account.model');
const Category = require('../src/models/category.model');
const Budget = require('../src/models/budget.model');
const Goal = require('../src/models/goal.model');
const Transaction = require('../src/models/transaction.model');
const Notification = require('../src/models/notification.model');
const RecurringTransaction = require('../src/models/recurringTransaction.model');
const { signAccess } = require('../src/utils/jwt');
const transactionWriter = require('../src/services/transactionWriter');
const { purgeUserData } = require('../src/services/userCleanup');
const { dispatch } = require('../src/services/notifications');

const daysAhead = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

const makeUser = (email, role = 'user') =>
    User.create({
        name: 'Cleanup User',
        email,
        password: 'pass',
        role,
        isActive: true,
        expiresAt: daysAhead(1)
    });

/** Give a user one document in every collection they can own. */
const populate = async (user) => {
    const category = await Category.create({ user: user._id, name: `Food-${user._id}` });
    await Budget.create({ user: user._id, month: CURRENT_MONTH, totalBudget: 500 });
    await Goal.create({ user: user._id, name: 'Fund', targetAmount: 100 });
    await RecurringTransaction.create({
        user: user._id, name: 'Rent', amount: 100, type: 'expense',
        frequency: 'monthly', startDate: new Date(), nextDue: daysAhead(5)
    });
    await dispatch(user, { type: 'system', title: 'Hi', body: 'x', dedupeKey: `sys:${user._id}` });
    await transactionWriter.createTransaction({
        user: user._id, amount: 25, type: 'expense', category: category._id
    });
};

const countsFor = async (userId) => ({
    transactions: await Transaction.countDocuments({ user: userId }),
    accounts: await Account.countDocuments({ user: userId }),
    categories: await Category.countDocuments({ user: userId }),
    budgets: await Budget.countDocuments({ user: userId }),
    goals: await Goal.countDocuments({ user: userId }),
    notifications: await Notification.countDocuments({ user: userId }),
    recurring: await RecurringTransaction.countDocuments({ user: userId }),
    users: await User.countDocuments({ _id: userId })
});

describe('purgeUserData', () => {
    it('removes every document the user owns', async () => {
        const user = await makeUser('purge@test.com');
        await populate(user);

        const before = await countsFor(user._id);
        expect(before.transactions).toEqual(1);
        expect(before.accounts).toEqual(1); // provisioned by the writer

        await purgeUserData(user._id);

        expect(await countsFor(user._id)).toEqual({
            transactions: 0, accounts: 0, categories: 0, budgets: 0,
            goals: 0, notifications: 0, recurring: 0, users: 0
        });
    });

    it('leaves other users untouched', async () => {
        const doomed = await makeUser('purge-doomed@test.com');
        const bystander = await makeUser('purge-bystander@test.com');
        await populate(doomed);
        await populate(bystander);

        await purgeUserData(doomed._id);

        const survivor = await countsFor(bystander._id);
        expect(survivor.transactions).toEqual(1);
        expect(survivor.accounts).toEqual(1);
        expect(survivor.users).toEqual(1);
    });

    it('can purge data while keeping the user', async () => {
        const user = await makeUser('purge-keep@test.com');
        await populate(user);

        await purgeUserData(user._id, { deleteUser: false });

        const after = await countsFor(user._id);
        expect(after.transactions).toEqual(0);
        expect(after.users).toEqual(1);
    });

    it('is safe on a user with no data', async () => {
        const user = await makeUser('purge-empty@test.com');
        await expect(purgeUserData(user._id)).resolves.toBeDefined();
        expect(await User.countDocuments({ _id: user._id })).toEqual(0);
    });
});

describe('DELETE /users/profile', () => {
    it('takes the user\'s data with them', async () => {
        const user = await makeUser('self-delete@test.com');
        await populate(user);
        const cookie = `accessToken=${signAccess({ sub: user._id, role: 'user' })}`;

        const res = await request(app).delete('/api/v1/users/profile').set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(await Transaction.countDocuments({ user: user._id })).toEqual(0);
        expect(await Account.countDocuments({ user: user._id })).toEqual(0);
        expect(await User.countDocuments({ _id: user._id })).toEqual(0);
    });
});

describe('DELETE /users/:id (admin)', () => {
    let admin;
    let adminCookie;

    beforeEach(async () => {
        admin = await makeUser('cleanup-admin@test.com', 'admin');
        adminCookie = `accessToken=${signAccess({ sub: admin._id, role: 'admin' })}`;
    });

    it('takes the target\'s data with them', async () => {
        const target = await makeUser('admin-deleted@test.com');
        await populate(target);

        const res = await request(app)
            .delete(`/api/v1/users/${target._id}`)
            .set('Cookie', [adminCookie]);

        expect(res.statusCode).toEqual(200);
        expect(await Transaction.countDocuments({ user: target._id })).toEqual(0);
        expect(await Account.countDocuments({ user: target._id })).toEqual(0);
        expect(await User.countDocuments({ _id: target._id })).toEqual(0);
    });

    it('still 404s for a user that does not exist', async () => {
        const gone = await makeUser('already-gone@test.com');
        const id = gone._id;
        await User.deleteOne({ _id: id });

        const res = await request(app)
            .delete(`/api/v1/users/${id}`)
            .set('Cookie', [adminCookie]);

        expect(res.statusCode).toEqual(404);
    });

    it('does not touch the admin\'s own data', async () => {
        const target = await makeUser('admin-deleted2@test.com');
        await populate(admin);
        await populate(target);

        await request(app).delete(`/api/v1/users/${target._id}`).set('Cookie', [adminCookie]);

        expect(await Transaction.countDocuments({ user: admin._id })).toEqual(1);
    });
});
