/* Financial Goals model: savings and financial targets */
const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    targetDate: { type: Date },
    category: { type: String, enum: ['emergency', 'vacation', 'house', 'car', 'retirement', 'education', 'other'], default: 'other' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date }
}, { timestamps: true });

// Compound indexes for performance
goalSchema.index({ user: 1, isCompleted: 1 }); // Active/completed goals by user
goalSchema.index({ user: 1, priority: 1, targetDate: 1 }); // Goals by priority and deadline
goalSchema.index({ user: 1, category: 1 }); // Goals by category

module.exports = mongoose.model('Goal', goalSchema);