/* Transaction model: income or expense record */
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    type: { type: String, enum: ['income', 'expense'], required: true },
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

module.exports = mongoose.model('Transaction', transactionSchema);
