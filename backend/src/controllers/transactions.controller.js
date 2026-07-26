/* Transactions controller: CRUD operations for user transactions */
const Transaction = require('../models/transaction.model');
const asyncHandler = require('../utils/asyncHandler');
const { success, successList, created, error } = require('../utils/response');
const { TransactionQueries, QueryMonitor } = require('../utils/dbOptimization');
const transactionWriter = require('../services/transactionWriter');

const listTransactions = asyncHandler(async (req, res) => {
    const { start, end, type, account, limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const queryConfig = TransactionQueries.getUserTransactions(req.user._id, {
        start,
        end,
        type,
        account,
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
            .populate('account', 'name type currency')
            .populate('transferTo', 'name type currency')
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
    const result = await transactionWriter.updateTransaction(req.user._id, req.params.id, req.body);
    if (!result) return error(res, 'Transaction not found', 404);
    return success(res, result.transaction, 'Transaction updated successfully');
});

const deleteTransaction = asyncHandler(async (req, res) => {
    const trx = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!trx) return error(res, 'Transaction not found', 404);
    return success(res, null, 'Transaction deleted successfully');
});

module.exports = { listTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction };
