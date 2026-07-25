/* Budget threshold detection.
 *
 * Extracted from transactions.controller.js so that every write path can run it
 * (goal contributions previously bypassed it entirely) and so it can be unit
 * tested directly rather than by spying on the logger.
 *
 * Returns the events it detected instead of only logging them. Logging is kept
 * for continuity with existing ops dashboards; the returned events are what the
 * notification dispatcher consumes.
 */
const Budget = require('../models/budget.model');
const Transaction = require('../models/transaction.model');
const logger = require('../utils/logger');

// Share of a budget that counts as "approaching". Matches the thresholds this
// app has always used.
const WARNING_RATIO = 0.9;

const monthKey = (date) => (date ? new Date(date) : new Date()).toISOString().slice(0, 7);

const monthBounds = (month) => {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
};

const sumExpenses = async (match) => {
    const agg = await Transaction.aggregate([
        { $match: { ...match, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    return (agg[0] && agg[0].total) || 0;
};

/**
 * Evaluate a user's budget for the month a transaction falls in.
 *
 * @returns {Promise<Array>} detected events, each
 *   { scope: 'total'|'category', level: 'exceeded'|'warning', month, spent,
 *     limit, categoryId?, categoryName? }
 *   Always an array — an empty one when there is nothing to report.
 */
async function checkBudgets(userId, trx) {
    const events = [];

    try {
        // Only expenses consume a budget. Income and transfers never do.
        if (trx.type !== 'expense') return events;

        const month = monthKey(trx.date);
        const budget = await Budget.findOne({ user: userId, month }).populate('categoryBudgets.category');
        if (!budget) return events;

        const { start, end } = monthBounds(month);
        const dateRange = { date: { $gte: start, $lt: end } };

        const totalSpent = await sumExpenses({ user: userId, ...dateRange });

        if (budget.totalBudget > 0) {
            if (totalSpent >= budget.totalBudget) {
                events.push({ scope: 'total', level: 'exceeded', month, spent: totalSpent, limit: budget.totalBudget });
                logger.warn('Budget exceeded', { userId, month, totalSpent, budgetLimit: budget.totalBudget });
            } else if (totalSpent >= budget.totalBudget * WARNING_RATIO) {
                events.push({ scope: 'total', level: 'warning', month, spent: totalSpent, limit: budget.totalBudget });
                logger.warn('Budget approaching limit', { userId, month, totalSpent, budgetLimit: budget.totalBudget, percentage: 90 });
            }
        }

        if (trx.category) {
            const cb = budget.categoryBudgets.find(
                (entry) => entry.category && String(entry.category._id) === String(trx.category)
            );

            if (cb && cb.amount > 0) {
                const categorySpent = await sumExpenses({ user: userId, category: trx.category, ...dateRange });
                const base = {
                    scope: 'category',
                    month,
                    spent: categorySpent,
                    limit: cb.amount,
                    categoryId: cb.category._id,
                    categoryName: cb.category.name
                };

                if (categorySpent >= cb.amount) {
                    events.push({ ...base, level: 'exceeded' });
                    logger.warn('Category budget exceeded', { userId, month, category: cb.category.name, categorySpent, limit: cb.amount });
                } else if (categorySpent >= cb.amount * WARNING_RATIO) {
                    events.push({ ...base, level: 'warning' });
                    logger.warn('Category budget approaching limit', { userId, month, category: cb.category.name, categorySpent, limit: cb.amount, percentage: 90 });
                }
            }
        }
    } catch (err) {
        // A budget check must never fail the write that triggered it.
        logger.error('Budget check failed', { userId, error: err.message, stack: err.stack });
    }

    return events;
}

module.exports = { checkBudgets, WARNING_RATIO };
