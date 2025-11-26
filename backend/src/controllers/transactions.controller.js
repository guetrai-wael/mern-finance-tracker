/* Transactions controller: CRUD operations for user transactions */
const Transaction = require('../models/transaction.model');
const Budget = require('../models/budget.model');
const Category = require('../models/category.model');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { success, successList, created, error } = require('../utils/response');
const { TransactionQueries, QueryMonitor } = require('../utils/dbOptimization');

const listTransactions = asyncHandler(async (req, res) => {
    const { start, end, type, limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    const queryConfig = TransactionQueries.getUserTransactions(req.user._id, {
        start,
        end,
        type,
        limit: parseInt(limit),
        skip
    });
    
    const items = await QueryMonitor.executeWithTiming(
        'listTransactions',
        Transaction.find(queryConfig.filter, null, queryConfig.options)
            .populate(queryConfig.populate),
        req.requestId
    );
    
    return successList(res, items, 'Transactions retrieved successfully');
});

const getTransaction = asyncHandler(async (req, res) => {
    const item = await QueryMonitor.executeWithTiming(
        'getTransaction',
        Transaction.findOne({ _id: req.params.id, user: req.user._id })
            .populate('category')
            .lean(),
        req.requestId
    );
    
    if (!item) return error(res, 'Transaction not found', 404);
    return success(res, item, 'Transaction retrieved successfully');
});

const createTransaction = asyncHandler(async (req, res) => {
    const data = { ...req.body, user: req.user._id };
    const trx = await Transaction.create(data);
    // Check budget
    await checkBudgets(req.user._id, trx);
    return created(res, trx, 'Transaction created successfully');
});

const updateTransaction = asyncHandler(async (req, res) => {
    const trx = await Transaction.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true });
    if (!trx) return error(res, 'Transaction not found', 404);
    await checkBudgets(req.user._id, trx);
    return success(res, trx, 'Transaction updated successfully');
});

const deleteTransaction = asyncHandler(async (req, res) => {
    const trx = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!trx) return error(res, 'Transaction not found', 404);
    return success(res, null, 'Transaction deleted successfully');
});

// Simple budget check: when a transaction is created/updated, compute month and category spent
async function checkBudgets(userId, trx) {
    try {
        if (trx.type !== 'expense') return; // only expenses count toward budgets
        const month = trx.date ? trx.date.toISOString().slice(0, 7) : (new Date()).toISOString().slice(0, 7);
        const budget = await Budget.findOne({ user: userId, month }).populate('categoryBudgets.category');
        if (!budget) return;
        // compute total spent for this category and overall
        const monthStart = new Date(month + '-01T00:00:00.000Z');
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        const spentAgg = await Transaction.aggregate([
            { $match: { user: userId, type: 'expense', date: { $gte: monthStart, $lt: monthEnd } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalSpent = (spentAgg[0] && spentAgg[0].total) || 0;
        // category spent
        let categorySpent = 0;
        if (trx.category) {
            const catAgg = await Transaction.aggregate([
                { $match: { user: userId, type: 'expense', category: trx.category, date: { $gte: monthStart, $lt: monthEnd } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            categorySpent = (catAgg[0] && catAgg[0].total) || 0;
        }
        // thresholds
        if (budget.totalBudget > 0 && totalSpent >= budget.totalBudget) {
            // Log budget violation for monitoring and future notification system
            logger.warn('Budget exceeded', { userId, month, totalSpent, budgetLimit: budget.totalBudget });
        } else if (budget.totalBudget > 0 && totalSpent >= budget.totalBudget * 0.9) {
            logger.warn('Budget approaching limit', { userId, month, totalSpent, budgetLimit: budget.totalBudget, percentage: 90 });
        }
        if (trx.category) {
            const cb = budget.categoryBudgets.find(cb => cb.category && String(cb.category._id) === String(trx.category));
            if (cb && cb.amount > 0 && categorySpent >= cb.amount) {
                logger.warn('Category budget exceeded', { userId, month, category: cb.category.name, categorySpent, limit: cb.amount });
            } else if (cb && cb.amount > 0 && categorySpent >= cb.amount * 0.9) {
                logger.warn('Category budget approaching limit', { userId, month, category: cb.category.name, categorySpent, limit: cb.amount, percentage: 90 });
            }
        }
    } catch (err) {
        logger.error('Budget check failed', { userId, error: err.message, stack: err.stack });
    }
}

module.exports = { listTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction };
