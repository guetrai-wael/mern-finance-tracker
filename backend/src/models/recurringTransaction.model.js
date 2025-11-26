/* Recurring Transactions model: automated income/expenses */
const mongoose = require('mongoose');

const recurringTransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    type: { type: String, enum: ['income', 'expense'], required: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date }, // Optional end date
    dayOfWeek: { type: Number, min: 0, max: 6 }, // For weekly (0 = Sunday)
    dayOfMonth: { type: Number, min: 1, max: 31 }, // For monthly
    isActive: { type: Boolean, default: true },
    lastProcessed: { type: Date },
    nextDue: { type: Date, required: true },
    description: { type: String }
}, { timestamps: true });

// Index for finding due transactions
recurringTransactionSchema.index({ nextDue: 1, isActive: 1 });

module.exports = mongoose.model('RecurringTransaction', recurringTransactionSchema);