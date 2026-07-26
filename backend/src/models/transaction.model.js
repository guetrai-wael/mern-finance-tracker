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
    // Optional for now. Becomes required once every existing row has been
    // backfilled — see scripts/migrations/001-backfill-transaction-accounts.js.
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    // Destination account. Required only when type is 'transfer'.
    transferTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    date: { type: Date, default: Date.now },
    description: { type: String },
    // Provenance. Lets the UI mark automated entries and makes a misconfigured
    // recurring rule reversible in bulk via recurringId.
    source: { type: String, enum: ['manual', 'recurring', 'goal'], default: 'manual' },
    recurringId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringTransaction' }
}, { timestamps: true });

// Compound indexes for performance
transactionSchema.index({ user: 1, date: -1 }); // User's transactions by date desc
transactionSchema.index({ user: 1, type: 1, date: -1 }); // User's income/expense by date
transactionSchema.index({ user: 1, category: 1, date: -1 }); // User's category spending by date
transactionSchema.index({ user: 1, date: 1 }); // Date range queries (ascending)
transactionSchema.index({ recurringId: 1 }, { sparse: true }); // Bulk-undo a recurring rule
transactionSchema.index({ user: 1, account: 1, date: -1 }); // Per-account statement
transactionSchema.index({ user: 1, transferTo: 1, date: -1 }, { sparse: true }); // Incoming transfers

module.exports = mongoose.model('Transaction', transactionSchema);
