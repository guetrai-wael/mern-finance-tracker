/* Transaction model: income or expense record */
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    // 'transfer' moves money between two of the user's own accounts. It is
    // excluded from every income/expense and budget calculation automatically,
    // because those are all written as inclusion filters (type: 'expense').
    type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
    // Required as of migration 001, which backfilled every pre-existing row.
    // Enforced here rather than in Joi on purpose: a stale cached SPA that
    // posts without one must not get a 400 it cannot recover from, so the Joi
    // schema keeps it optional and transactionWriter fills in the user's
    // default. This is the guarantee that no code path can skip.
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    // Destination account. Required only when type is 'transfer'.
    transferTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    date: { type: Date, default: Date.now },
    description: { type: String },
    // Provenance. Lets the UI mark automated entries and makes a misconfigured
    // recurring rule reversible in bulk via recurringId.
    source: { type: String, enum: ['manual', 'recurring', 'goal'], default: 'manual' },
    recurringId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringTransaction' }
}, { timestamps: true });

/* Transfer invariants.
 *
 * Enforced on the schema rather than only in Joi because several writers reach
 * the model directly — goals.controller, the recurring job, the seed script —
 * and none of them pass through the request-validation middleware.
 */
/** These are all bad input, not server faults, so they carry a 400. */
function badRequest(message) {
    const err = new Error(message);
    err.status = 400;
    return err;
}

function validateTransfer(doc) {
    if (doc.type === 'transfer') {
        if (!doc.transferTo) {
            throw badRequest('A transfer requires a destination account (transferTo).');
        }
        if (String(doc.transferTo) === String(doc.account)) {
            throw badRequest('A transfer must move money between two different accounts.');
        }
    } else if (doc.transferTo) {
        // An expense carrying a stale destination would be counted twice by the
        // balance aggregation, which credits transferTo on any transfer row.
        throw badRequest('transferTo is only valid on a transfer.');
    }
}

transactionSchema.pre('validate', function preValidate(next) {
    try {
        // A transfer is a movement, not a spending category.
        if (this.type === 'transfer') this.category = undefined;
        validateTransfer(this);
        next();
    } catch (err) {
        next(err);
    }
});

// Compound indexes for performance
transactionSchema.index({ user: 1, date: -1 }); // User's transactions by date desc
transactionSchema.index({ user: 1, type: 1, date: -1 }); // User's income/expense by date
transactionSchema.index({ user: 1, category: 1, date: -1 }); // User's category spending by date
transactionSchema.index({ user: 1, date: 1 }); // Date range queries (ascending)
transactionSchema.index({ recurringId: 1 }, { sparse: true }); // Bulk-undo a recurring rule
transactionSchema.index({ user: 1, account: 1, date: -1 }); // Per-account statement
transactionSchema.index({ user: 1, transferTo: 1, date: -1 }, { sparse: true }); // Incoming transfers

module.exports = mongoose.model('Transaction', transactionSchema);
