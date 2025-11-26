/* Budgets controller: manage monthly and category budgets */
const Budget = require('../models/budget.model');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/response');

const getBudget = asyncHandler(async (req, res) => {
    const month = req.query.month;
    if (!month) return error(res, 'month required (YYYY-MM)', 400);
    const budget = await Budget.findOne({ user: req.user._id, month }).populate('categoryBudgets.category');
    return success(res, budget, 'Budget retrieved successfully');
});

const upsertBudget = asyncHandler(async (req, res) => {
    const data = req.body;
    const filter = { user: req.user._id, month: data.month };
    const update = { totalBudget: data.totalBudget, categoryBudgets: data.categoryBudgets };
    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
    const budget = await Budget.findOneAndUpdate(filter, update, opts).populate('categoryBudgets.category');
    return success(res, budget, 'Budget updated successfully');
});

module.exports = { getBudget, upsertBudget };