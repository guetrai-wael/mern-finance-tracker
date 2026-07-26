/* Budget threshold detection + the single transaction write path.
 *
 * checkBudgets used to be private to transactions.controller.js and only ever
 * wrote a log line, so none of this behaviour was covered. It is now the
 * foundation the notification system builds on, so it needs real assertions.
 */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Budget = require('../src/models/budget.model');
const Category = require('../src/models/category.model');
const Transaction = require('../src/models/transaction.model');
const Goal = require('../src/models/goal.model');
const { signAccess } = require('../src/utils/jwt');
const { checkBudgets } = require('../src/services/budgetCheck');
const transactionWriter = require('../src/services/transactionWriter');

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const inCurrentMonth = () => new Date(`${CURRENT_MONTH}-15T12:00:00.000Z`);

describe('checkBudgets', () => {
    let user;

    beforeEach(async () => {
        user = await User.create({
            name: 'Budget User',
            email: 'budget-check@test.com',
            password: 'pass',
            isActive: true,
            expiresAt: new Date(Date.now() + 86400000)
        });
    });

    const spend = (amount, category) =>
        transactionWriter.createTransaction({
            user: user._id,
            amount,
            type: 'expense',
            category,
            date: inCurrentMonth()
        });

    it('reports nothing when the user has no budget', async () => {
        const { budgetEvents } = await spend(500);
        expect(budgetEvents).toEqual([]);
    });

    it('reports nothing while spending stays below 90%', async () => {
        await Budget.create({ user: user._id, month: CURRENT_MONTH, totalBudget: 1000 });
        const { budgetEvents } = await spend(500);
        expect(budgetEvents).toEqual([]);
    });

    it('warns at 90% of the total budget', async () => {
        await Budget.create({ user: user._id, month: CURRENT_MONTH, totalBudget: 1000 });
        const { budgetEvents } = await spend(900);

        expect(budgetEvents).toHaveLength(1);
        expect(budgetEvents[0]).toMatchObject({ scope: 'total', level: 'warning', spent: 900, limit: 1000 });
    });

    it('escalates to exceeded at 100%', async () => {
        await Budget.create({ user: user._id, month: CURRENT_MONTH, totalBudget: 1000 });
        const { budgetEvents } = await spend(1000);

        expect(budgetEvents).toHaveLength(1);
        expect(budgetEvents[0]).toMatchObject({ scope: 'total', level: 'exceeded' });
    });

    it('accumulates across transactions rather than judging one in isolation', async () => {
        await Budget.create({ user: user._id, month: CURRENT_MONTH, totalBudget: 1000 });

        const first = await spend(600);
        expect(first.budgetEvents).toEqual([]);

        // Neither transaction exceeds the budget alone; together they do.
        const second = await spend(500);
        expect(second.budgetEvents[0]).toMatchObject({ level: 'exceeded', spent: 1100 });
    });

    it('reports a category budget breach with the category name', async () => {
        const category = await Category.create({ user: user._id, name: 'Food' });
        await Budget.create({
            user: user._id,
            month: CURRENT_MONTH,
            totalBudget: 0,
            categoryBudgets: [{ category: category._id, amount: 200 }]
        });

        const { budgetEvents } = await spend(250, category._id);

        expect(budgetEvents).toHaveLength(1);
        expect(budgetEvents[0]).toMatchObject({
            scope: 'category',
            level: 'exceeded',
            spent: 250,
            limit: 200,
            categoryName: 'Food'
        });
    });

    it('ignores income entirely', async () => {
        await Budget.create({ user: user._id, month: CURRENT_MONTH, totalBudget: 100 });

        const { budgetEvents } = await transactionWriter.createTransaction({
            user: user._id,
            amount: 5000,
            type: 'income',
            date: inCurrentMonth()
        });

        expect(budgetEvents).toEqual([]);
    });

    it('scopes spending to the transaction\'s own month', async () => {
        await Budget.create({ user: user._id, month: CURRENT_MONTH, totalBudget: 1000 });

        // A large expense in a different month must not trip this month's budget.
        await transactionWriter.createTransaction({
            user: user._id,
            amount: 5000,
            type: 'expense',
            date: new Date('2020-03-15T12:00:00.000Z')
        });

        const { budgetEvents } = await spend(100);
        expect(budgetEvents).toEqual([]);
    });

    it('never throws — a budget failure must not fail the write', async () => {
        // Malformed input: no date, no type match, nothing persisted.
        await expect(checkBudgets(user._id, {})).resolves.toEqual([]);
    });
});

describe('goal contributions count toward budgets', () => {
    // Regression test. addContribution called Transaction.create() directly,
    // bypassing the budget check entirely, so contributing to a goal was
    // invisible to budget tracking.
    let user;
    let cookie;

    beforeEach(async () => {
        user = await User.create({
            name: 'Goal Budget User',
            email: 'goal-budget@test.com',
            password: 'pass',
            isActive: true,
            expiresAt: new Date(Date.now() + 86400000)
        });
        cookie = `accessToken=${signAccess({ sub: user._id, role: 'user' })}`;
    });

    it('creates a transaction tagged as a goal contribution', async () => {
        const goal = await Goal.create({
            user: user._id,
            name: 'Emergency Fund',
            targetAmount: 5000
        });

        const res = await request(app)
            .post(`/api/v1/goals/${goal._id}/contribute`)
            .set('Cookie', [cookie])
            .send({ amount: 250 });

        expect(res.statusCode).toEqual(200);

        const created = await Transaction.findOne({ user: user._id });
        expect(created).not.toBeNull();
        expect(created.source).toEqual('goal');
        expect(created.amount).toEqual(250);
        expect(created.type).toEqual('expense');
    });

    it('accumulates with manual spending in budget math', async () => {
        await Budget.create({ user: user._id, month: CURRENT_MONTH, totalBudget: 500 });
        const goal = await Goal.create({ user: user._id, name: 'Car', targetAmount: 5000 });

        await request(app)
            .post(`/api/v1/goals/${goal._id}/contribute`)
            .set('Cookie', [cookie])
            .send({ amount: 400 });

        // A later manual expense sees the contribution in the running total:
        // 400 contributed + 150 spent = 550 against a 500 budget.
        const { budgetEvents } = await transactionWriter.createTransaction({
            user: user._id,
            amount: 150,
            type: 'expense',
            date: inCurrentMonth()
        });

        expect(budgetEvents).toHaveLength(1);
        expect(budgetEvents[0]).toMatchObject({ level: 'exceeded', spent: 550 });
    });
});
