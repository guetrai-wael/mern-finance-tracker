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
const { dispatchBudgetEvents } = require('./notifications');
const { resolveDefaultAccount } = require('../controllers/accounts.controller');

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
    const {
        user, amount, type, category, date, description,
        source = 'manual', recurringId, account, transferTo
    } = input;

    // Callers that do not name an account get the user's default, provisioned
    // on demand. This is the only place that decision is made — which is the
    // reason this module exists.
    const resolvedAccount = account || (await resolveDefaultAccount(user))._id;

    const transaction = await Transaction.create({
        user,
        amount,
        type,
        category,
        account: resolvedAccount,
        // Only meaningful on a transfer; stored as undefined otherwise so an
        // expense can never carry a stale destination.
        transferTo: type === 'transfer' ? transferTo : undefined,
        date: date || new Date(),
        description,
        source,
        recurringId
    });

    // Budget evaluation must never fail the write — checkBudgets swallows its
    // own errors and returns an empty list.
    const budgetEvents = await checkBudgets(user, transaction);

    // Dedupe lives in the dispatcher, so repeatedly crossing the same threshold
    // in the same month produces one notification, not one per transaction.
    if (budgetEvents.length > 0) {
        await dispatchBudgetEvents(user, budgetEvents);
    }

    return { transaction, budgetEvents };
}

module.exports = { createTransaction };
