/* Posts transactions for recurring rules that have come due.
 *
 * Idempotency comes from nextDue living in the database: a transaction is only
 * posted when nextDue <= now, and nextDue is advanced in the same save. Running
 * this twice in a row is a no-op the second time.
 *
 * Catch-up: the inner loop keeps posting until nextDue moves past now, so a
 * server that was down for three days posts the three missed occurrences on
 * their real dates rather than collapsing them into one.
 */
const RecurringTransaction = require('../models/recurringTransaction.model');
const transactionWriter = require('../services/transactionWriter');
const { advance, MAX_ADVANCE_STEPS } = require('./recurrence');
const logger = require('../utils/logger');

/**
 * @param {Date} [now] injectable for tests
 * @returns {Promise<{posted: number, rulesProcessed: number, deactivated: number}>}
 */
async function postRecurring(now = new Date()) {
    // Served directly by the { nextDue: 1, isActive: 1 } index.
    const dueRules = await RecurringTransaction.find({ isActive: true, nextDue: { $lte: now } });

    let posted = 0;
    let deactivated = 0;

    for (const rule of dueRules) {
        let steps = 0;

        try {
            while (rule.nextDue <= now && steps < MAX_ADVANCE_STEPS) {
                // A rule that has run past its end date stops rather than posting.
                if (rule.endDate && rule.nextDue > rule.endDate) {
                    rule.isActive = false;
                    deactivated += 1;
                    break;
                }

                await transactionWriter.createTransaction({
                    user: rule.user,
                    amount: rule.amount,
                    type: rule.type,
                    category: rule.category,
                    account: rule.account,
                    // Backdated to when it was due, not when it was posted —
                    // otherwise a delayed run lands the money in the wrong month
                    // and corrupts budget totals.
                    date: new Date(rule.nextDue),
                    description: rule.description || rule.name,
                    source: 'recurring',
                    recurringId: rule._id
                });

                posted += 1;
                rule.lastProcessed = new Date(rule.nextDue);
                rule.nextDue = advance(rule.nextDue, rule.frequency, { dayOfMonth: rule.dayOfMonth });
                steps += 1;
            }

            if (steps >= MAX_ADVANCE_STEPS) {
                logger.warn('Recurring rule hit the catch-up ceiling; deactivating', {
                    ruleId: rule._id, userId: rule.user, steps
                });
                rule.isActive = false;
                deactivated += 1;
            }

            await rule.save();
        } catch (err) {
            // One broken rule must not stop the rest.
            logger.error('Failed to process recurring rule', {
                ruleId: rule._id, userId: rule.user, error: err.message, stack: err.stack
            });
        }
    }

    return { posted, rulesProcessed: dueRules.length, deactivated };
}

module.exports = postRecurring;
