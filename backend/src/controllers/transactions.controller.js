/* Transactions controller: CRUD operations for user transactions */
const Transaction = require('../models/transaction.model');
const asyncHandler = require('../utils/asyncHandler');
const { success, successList, created, error } = require('../utils/response');
const { TransactionQueries, QueryMonitor } = require('../utils/dbOptimization');
const transactionWriter = require('../services/transactionWriter');
const { checkBudgets } = require('../services/budgetCheck');

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
    const { transaction } = await transactionWriter.createTransaction({
        ...req.body,
        user: req.user._id
    });
    return created(res, transaction, 'Transaction created successfully');
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

module.exports = { listTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction };
