/* In-app notifications: dispatch, deduplication, preferences, and the API. */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Budget = require('../src/models/budget.model');
const Goal = require('../src/models/goal.model');
const Category = require('../src/models/category.model');
const Notification = require('../src/models/notification.model');
const Transaction = require('../src/models/transaction.model');
const { signAccess } = require('../src/utils/jwt');
const transactionWriter = require('../src/services/transactionWriter');
const { dispatch } = require('../src/services/notifications');
const goalReminders = require('../src/jobs/goalReminders');
const monthlyReport = require('../src/jobs/monthlyReport');

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const inCurrentMonth = () => new Date(`${CURRENT_MONTH}-15T12:00:00.000Z`);
const daysAhead = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const makeUser = async (email, notifications) =>
    User.create({
        name: 'Notify User',
        email,
        password: 'pass',
        isActive: true,
        expiresAt: daysAhead(1),
        ...(notifications ? { settings: { notifications } } : {})
    });

describe('budget notifications', () => {
    let user;

    beforeEach(async () => {
        user = await makeUser('notify-budget@test.com');
        await Budget.create({ user: user._id, month: CURRENT_MONTH, totalBudget: 1000 });
    });

    const spend = (amount, category) =>
        transactionWriter.createTransaction({
            user: user._id,
            amount,
            type: 'expense',
            category,
            date: inCurrentMonth()
        });

    it('creates one notification when the budget is exceeded', async () => {
        await spend(1100);

        const notifications = await Notification.find({ user: user._id });
        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toEqual('budget');
        expect(notifications[0].title).toMatch(/Over budget/);
        expect(notifications[0].read).toBe(false);
    });

    it('does not repeat the alert for further spending in the same month', async () => {
        // The core anti-spam guarantee. checkBudgets fires on every write, so
        // without deduplication this would produce four identical alerts.
        await spend(1100);
        await spend(50);
        await spend(50);
        await spend(50);

        expect(await Notification.countDocuments({ user: user._id })).toEqual(1);
    });

    it('separates the warning and exceeded alerts', async () => {
        await spend(950); // 95% — warning
        await spend(100); // over — exceeded

        const notifications = await Notification.find({ user: user._id }).sort({ createdAt: 1 });
        expect(notifications).toHaveLength(2);
        expect(notifications[0].dedupeKey).toMatch(/budget:warning/);
        expect(notifications[1].dedupeKey).toMatch(/budget:exceeded/);
    });

    it('alerts separately per category', async () => {
        const food = await Category.create({ user: user._id, name: 'Food' });
        const travel = await Category.create({ user: user._id, name: 'Travel' });
        await Budget.findOneAndUpdate(
            { user: user._id, month: CURRENT_MONTH },
            { categoryBudgets: [
                { category: food._id, amount: 100 },
                { category: travel._id, amount: 100 }
            ] }
        );

        await spend(150, food._id);
        await spend(150, travel._id);

        const categoryAlerts = await Notification.find({
            user: user._id,
            dedupeKey: { $regex: '^budget:exceeded:.*:cat:' }
        });
        expect(categoryAlerts).toHaveLength(2);
    });

    it('produces a fresh alert in a new month', async () => {
        await spend(1100);

        // Same threshold, different month — a new event, so a new key.
        const nextMonth = new Date();
        nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
        const nextKey = nextMonth.toISOString().slice(0, 7);
        await Budget.create({ user: user._id, month: nextKey, totalBudget: 1000 });

        await transactionWriter.createTransaction({
            user: user._id,
            amount: 1100,
            type: 'expense',
            date: new Date(`${nextKey}-15T12:00:00.000Z`)
        });

        expect(await Notification.countDocuments({ user: user._id })).toEqual(2);
    });

    it('respects the budgetAlerts preference', async () => {
        const optedOut = await makeUser('opted-out@test.com', { budgetAlerts: false });
        await Budget.create({ user: optedOut._id, month: CURRENT_MONTH, totalBudget: 100 });

        await transactionWriter.createTransaction({
            user: optedOut._id,
            amount: 500,
            type: 'expense',
            date: inCurrentMonth()
        });

        expect(await Notification.countDocuments({ user: optedOut._id })).toEqual(0);
    });

    it('still alerts a user who has never touched settings', async () => {
        await spend(1100);
        expect(await Notification.countDocuments({ user: user._id })).toEqual(1);
    });
});

describe('goalReminders job', () => {
    let user;

    beforeEach(async () => {
        user = await makeUser('notify-goal@test.com');
    });

    it('warns about a goal due within 30 days', async () => {
        await Goal.create({
            user: user._id,
            name: 'Vacation',
            targetAmount: 2000,
            currentAmount: 500,
            targetDate: daysAhead(20)
        });

        const result = await goalReminders();

        expect(result.sent).toEqual(1);
        const notification = await Notification.findOne({ user: user._id });
        expect(notification.type).toEqual('goal');
        expect(notification.title).toMatch(/Vacation/);
    });

    it('is idempotent across runs', async () => {
        await Goal.create({
            user: user._id, name: 'Vacation', targetAmount: 2000,
            currentAmount: 500, targetDate: daysAhead(20)
        });

        await goalReminders();
        await goalReminders();
        await goalReminders();

        expect(await Notification.countDocuments({ user: user._id })).toEqual(1);
    });

    it('sends a second, distinct reminder as the deadline nears', async () => {
        const goal = await Goal.create({
            user: user._id, name: 'Vacation', targetAmount: 2000,
            currentAmount: 500, targetDate: daysAhead(20)
        });
        await goalReminders();

        // Move the goal inside the 7-day window.
        goal.targetDate = daysAhead(5);
        await goal.save();
        await goalReminders();

        const keys = (await Notification.find({ user: user._id })).map((n) => n.dedupeKey);
        expect(keys).toHaveLength(2);
        expect(keys.some((k) => k.endsWith(':30d'))).toBe(true);
        expect(keys.some((k) => k.endsWith(':7d'))).toBe(true);
    });

    it('ignores goals that are far off, complete, or already funded', async () => {
        await Goal.create({ user: user._id, name: 'Far', targetAmount: 100, targetDate: daysAhead(200) });
        await Goal.create({ user: user._id, name: 'Done', targetAmount: 100, targetDate: daysAhead(5), isCompleted: true });
        await Goal.create({ user: user._id, name: 'Funded', targetAmount: 100, currentAmount: 100, targetDate: daysAhead(5) });

        const result = await goalReminders();
        expect(result.sent).toEqual(0);
    });

    it('respects the goalReminders preference', async () => {
        const optedOut = await makeUser('goal-opt-out@test.com', { goalReminders: false });
        await Goal.create({
            user: optedOut._id, name: 'Quiet', targetAmount: 500,
            currentAmount: 0, targetDate: daysAhead(10)
        });

        await goalReminders();
        expect(await Notification.countDocuments({ user: optedOut._id })).toEqual(0);
    });
});

describe('monthlyReport job', () => {
    let user;

    beforeEach(async () => {
        user = await makeUser('notify-report@test.com', { monthlyReports: true });
    });

    const lastMonthDate = () => {
        const d = new Date();
        d.setUTCMonth(d.getUTCMonth() - 1, 15);
        return d;
    };

    it('summarises the month that just ended', async () => {
        await transactionWriter.createTransaction({ user: user._id, amount: 3000, type: 'income', date: lastMonthDate() });
        await transactionWriter.createTransaction({ user: user._id, amount: 1200, type: 'expense', date: lastMonthDate() });

        const result = await monthlyReport();

        expect(result.sent).toEqual(1);
        const notification = await Notification.findOne({ user: user._id });
        expect(notification.type).toEqual('report');
        expect(notification.meta.income).toEqual(3000);
        expect(notification.meta.expense).toEqual(1200);
        expect(notification.meta.net).toEqual(1800);
    });

    it('is idempotent across runs', async () => {
        await transactionWriter.createTransaction({ user: user._id, amount: 100, type: 'income', date: lastMonthDate() });

        await monthlyReport();
        await monthlyReport();

        expect(await Notification.countDocuments({ user: user._id })).toEqual(1);
    });

    it('sends nothing when there was no activity', async () => {
        const result = await monthlyReport();
        expect(result.sent).toEqual(0);
    });

    it('respects the monthlyReports preference', async () => {
        const optedOut = await makeUser('report-opt-out@test.com', { monthlyReports: false });
        await transactionWriter.createTransaction({ user: optedOut._id, amount: 100, type: 'income', date: lastMonthDate() });

        await monthlyReport();
        expect(await Notification.countDocuments({ user: optedOut._id })).toEqual(0);
    });
});

describe('notifications API', () => {
    let user;
    let cookie;

    beforeEach(async () => {
        user = await makeUser('notify-api@test.com');
        cookie = `accessToken=${signAccess({ sub: user._id, role: 'user' })}`;

        await dispatch(user, { type: 'system', title: 'One', body: 'First', dedupeKey: 'system:one' });
        await dispatch(user, { type: 'system', title: 'Two', body: 'Second', dedupeKey: 'system:two' });
    });

    it('lists the user\'s notifications newest first', async () => {
        const res = await request(app).get('/api/v1/notifications').set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.meta.unreadCount).toEqual(2);
    });

    it('reports the unread count', async () => {
        const res = await request(app).get('/api/v1/notifications/unread-count').set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.count).toEqual(2);
    });

    it('marks one as read', async () => {
        const notification = await Notification.findOne({ user: user._id, dedupeKey: 'system:one' });

        const res = await request(app)
            .patch(`/api/v1/notifications/${notification._id}/read`)
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.read).toBe(true);
        expect(await Notification.countDocuments({ user: user._id, read: false })).toEqual(1);
    });

    it('marks everything read', async () => {
        const res = await request(app).post('/api/v1/notifications/read-all').set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.updated).toEqual(2);
        expect(await Notification.countDocuments({ user: user._id, read: false })).toEqual(0);
    });

    it('filters to unread only', async () => {
        const notification = await Notification.findOne({ user: user._id, dedupeKey: 'system:one' });
        await Notification.findByIdAndUpdate(notification._id, { read: true });

        const res = await request(app).get('/api/v1/notifications?unread=true').set('Cookie', [cookie]);

        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].dedupeKey).toEqual('system:two');
    });

    it('does not leak another user\'s notifications', async () => {
        const other = await makeUser('notify-other@test.com');
        await dispatch(other, { type: 'system', title: 'Theirs', body: 'x', dedupeKey: 'system:theirs' });

        const res = await request(app).get('/api/v1/notifications').set('Cookie', [cookie]);

        expect(res.body.data).toHaveLength(2);
        expect(res.body.data.map((n) => n.dedupeKey)).not.toContain('system:theirs');
    });

    it('returns 404 marking another user\'s notification read', async () => {
        const other = await makeUser('notify-other2@test.com');
        const theirs = await dispatch(other, {
            type: 'system', title: 'Theirs', body: 'x', dedupeKey: 'system:theirs2'
        });

        const res = await request(app)
            .patch(`/api/v1/notifications/${theirs._id}/read`)
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(404);
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/v1/notifications');
        expect(res.statusCode).toEqual(401);
    });

    it('deletes a notification', async () => {
        const notification = await Notification.findOne({ user: user._id, dedupeKey: 'system:one' });

        const res = await request(app)
            .delete(`/api/v1/notifications/${notification._id}`)
            .set('Cookie', [cookie]);

        expect(res.statusCode).toEqual(200);
        expect(await Notification.countDocuments({ user: user._id })).toEqual(1);
    });
});

describe('settings persistence', () => {
    let user;
    let cookie;

    beforeEach(async () => {
        user = await makeUser('settings-persist@test.com');
        cookie = `accessToken=${signAccess({ sub: user._id, role: 'user' })}`;
    });

    it('saves notification preferences', async () => {
        // Before this, updateUserSettings only ever wrote settings.currency, so
        // the toggles in the UI could not be persisted at all.
        const res = await request(app)
            .put('/api/v1/users/settings')
            .set('Cookie', [cookie])
            .send({ notifications: { budgetAlerts: false } });

        expect(res.statusCode).toEqual(200);

        const updated = await User.findById(user._id);
        expect(updated.settings.notifications.budgetAlerts).toBe(false);
    });

    it('leaves sibling toggles untouched on a partial update', async () => {
        // A whole-object $set would silently reset the other three.
        await request(app)
            .put('/api/v1/users/settings')
            .set('Cookie', [cookie])
            .send({ notifications: { budgetAlerts: false } });

        const updated = await User.findById(user._id);
        expect(updated.settings.notifications.goalReminders).toBe(true);
        expect(updated.settings.notifications.email).toBe(true);
    });

    it('still saves currency', async () => {
        const res = await request(app)
            .put('/api/v1/users/settings')
            .set('Cookie', [cookie])
            .send({ currency: 'EUR' });

        expect(res.statusCode).toEqual(200);
        expect((await User.findById(user._id)).settings.currency).toEqual('EUR');
    });

    it('rejects an unknown theme', async () => {
        const res = await request(app)
            .put('/api/v1/users/settings')
            .set('Cookie', [cookie])
            .send({ theme: 'neon' });

        expect(res.statusCode).toEqual(400);
    });
});
