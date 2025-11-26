/* Transaction model: income or expense record */
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    type: { type: String, enum: ['income', 'expense'], required: true },
    date: { type: Date, default: Date.now },
    description: { type: String }
}, { timestamps: true });

// Compound indexes for performance
transactionSchema.index({ user: 1, date: -1 }); // User's transactions by date desc
transactionSchema.index({ user: 1, type: 1, date: -1 }); // User's income/expense by date
transactionSchema.index({ user: 1, category: 1, date: -1 }); // User's category spending by date
transactionSchema.index({ user: 1, date: 1 }); // Date range queries (ascending)

module.exports = mongoose.model('Transaction', transactionSchema);
