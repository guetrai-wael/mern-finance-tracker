/* Removing a user and everything that belongs to them.
 *
 * Both delete paths — a user deleting their own account, and an admin deleting
 * someone — previously removed only the User document. Everything else stayed:
 * transactions, categories, budgets, goals, notifications, recurring rules.
 *
 * That is not a hypothetical. The wallets backfill found one such user in
 * production: 5 user ids owned transactions, but only 4 had a User document.
 * Orphaned rows are invisible in the UI, still counted by any aggregation that
 * does not join to users, and impossible to attribute later.
 */
const Transaction = require('../models/transaction.model');
const Category = require('../models/category.model');
const Budget = require('../models/budget.model');
const Goal = require('../models/goal.model');
const Notification = require('../models/notification.model');
const RecurringTransaction = require('../models/recurringTransaction.model');
const Account = require('../models/account.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');

// Order matters only for readability; there are no FK constraints to satisfy.
const OWNED_COLLECTIONS = [
    ['transactions', Transaction],
    ['recurringTransactions', RecurringTransaction],
    ['budgets', Budget],
    ['goals', Goal],
    ['categories', Category],
    ['notifications', Notification],
    ['accounts', Account]
];

/**
 * Delete every document belonging to a user, then the user.
 *
 * Not wrapped in a transaction: the test harness runs a standalone
 * mongodb-memory-server, which has no multi-document transaction support. A
 * partial failure therefore leaves some data behind — which is the same state
 * this codebase has always been in, and strictly better than the previous
 * behaviour of never deleting any of it. The counts are logged so a partial
 * run is at least diagnosable.
 *
 * @returns {Promise<Object>} deleted counts per collection
 */
async function purgeUserData(userId, { deleteUser = true } = {}) {
    const deleted = {};

    for (const [name, Model] of OWNED_COLLECTIONS) {
        const result = await Model.deleteMany({ user: userId });
        deleted[name] = result.deletedCount;
    }

    if (deleteUser) {
        const result = await User.deleteOne({ _id: userId });
        deleted.user = result.deletedCount;
    }

    logger.info('Purged user data', { userId, deleted });
    return deleted;
}

module.exports = { purgeUserData, OWNED_COLLECTIONS };
