/* The single write path for transactions.
 *
 * Every transaction in the system must be created through here — the HTTP
 * controller, goal contributions, and the recurring-transaction job alike.
 *
 * Before this existed, Transaction.create() was called from three places and
 * only one of them ran the budget check, so contributing to a goal silently
 * failed to count against the user's budget. Centralising also means that when
 * `account` becomes required (multi-account support), only this file needs to
 * learn how to resolve a default.
 */
const Transaction = require('../models/transaction.model');
const { checkBudgets } = require('./budgetCheck');

/**
 * Create a transaction and run every side effect that must accompany it.
 *
 * @param {Object} input
 * @param {ObjectId} input.user       owner — required
 * @param {number}   input.amount     positive
 * @param {'income'|'expense'} input.type
 * @param {ObjectId} [input.category]
 * @param {Date}     [input.date]     defaults to now
 * @param {string}   [input.description]
 * @param {'manual'|'recurring'|'goal'} [input.source='manual']
 * @param {ObjectId} [input.recurringId] set when source is 'recurring'
 * @returns {Promise<{ transaction, budgetEvents }>}
 */
async function createTransaction(input) {
    const { user, amount, type, category, date, description, source = 'manual', recurringId } = input;

    const transaction = await Transaction.create({
        user,
        amount,
        type,
        category,
        date: date || new Date(),
        description,
        source,
        recurringId
    });

    // Budget evaluation must never fail the write — checkBudgets swallows its
    // own errors and returns an empty list.
    const budgetEvents = await checkBudgets(user, transaction);

    return { transaction, budgetEvents };
}

module.exports = { createTransaction };
