/* Budget model: monthly and category budgets per user */
const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    month: { type: String, required: true }, // YYYY-MM
    totalBudget: { type: Number, default: 0 },
    categoryBudgets: [
        {
            category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
            amount: { type: Number, default: 0 }
        }
    ]
}, { timestamps: true });

budgetSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
