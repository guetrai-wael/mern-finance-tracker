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
const Account = require('../models/account.model');
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
/**
 * Confirm the named accounts belong to this user.
 *
 * Without this a caller could reference another user's account id and move
 * money into or out of a stranger's balance — the ids are guessable in the
 * sense that they are just ObjectIds passed straight from the request body.
 *
 * @throws {Error} with .status = 404, matching how controllers report a
 *   resource the requester is not allowed to see.
 */
async function assertOwnsAccounts(userId, ids) {
    const wanted = ids.filter(Boolean).map(String);
    if (wanted.length === 0) return;

    const owned = await Account.countDocuments({
        _id: { $in: wanted },
        user: userId
    });

    if (owned !== new Set(wanted).size) {
        const err = new Error('Account not found');
        err.status = 404;
        throw err;
    }
}

async function createTransaction(input) {
    const {
        user, amount, type, category, date, description,
        source = 'manual', recurringId, account, transferTo
    } = input;

    await assertOwnsAccounts(user, [account, type === 'transfer' ? transferTo : null]);

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
        // Passed through as given rather than silently dropped on non-transfers.
        // The schema's pre('validate') hook rejects the combination with a 400,
        // so a client sending a destination on an expense learns it was wrong
        // instead of having the field quietly discarded.
        transferTo,
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

/**
 * Apply an update to an existing transaction.
 *
 * Uses load-modify-save rather than findOneAndUpdate so the schema's
 * pre('validate') hook runs. That hook is what clears transferTo when a
 * transfer is edited into an expense — a blind findOneAndUpdate would leave the
 * stale destination behind, and the balance aggregation credits transferTo on
 * anything typed 'transfer', so the money would be counted in two places.
 *
 * @returns {Promise<{transaction, budgetEvents}|null>} null when not found
 */
async function updateTransaction(userId, id, changes) {
    const transaction = await Transaction.findOne({ _id: id, user: userId });
    if (!transaction) return null;

    await assertOwnsAccounts(userId, [changes.account, changes.transferTo]);

    Object.assign(transaction, changes);

    // Switching away from a transfer must drop the destination. Assigning
    // undefined does not remove a set path in mongoose; the field has to be
    // explicitly cleared.
    if (changes.type && changes.type !== 'transfer') {
        transaction.transferTo = undefined;
        transaction.markModified('transferTo');
    }

    await transaction.save();

    const budgetEvents = await checkBudgets(userId, transaction);
    if (budgetEvents.length > 0) {
        await dispatchBudgetEvents(userId, budgetEvents);
    }

    return { transaction, budgetEvents };
}

module.exports = { createTransaction, updateTransaction, assertOwnsAccounts };
