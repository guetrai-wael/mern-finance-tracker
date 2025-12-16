/* User model: stores authentication info and profile */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: false }, // Default to false for new users
    activatedAt: { type: Date },
    expiresAt: { type: Date },
    refreshToken: { type: String },
    profilePicture: { type: String, default: null },
    settings: {
        country: { type: String, default: 'US' },
        currency: { type: String, default: 'USD' },
        dateFormat: { 
            type: String, 
            enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'], 
            default: 'MM/DD/YYYY' 
        },
        numberFormat: { 
            type: String, 
            enum: ['1,234.56', '1.234,56', '1 234,56'], 
            default: '1,234.56' 
        },
        theme: { 
            type: String, 
            enum: ['light', 'dark', 'auto'], 
            default: 'light' 
        },
        notifications: {
            email: { type: Boolean, default: true },
            budgetAlerts: { type: Boolean, default: true },
            goalReminders: { type: Boolean, default: true },
            monthlyReports: { type: Boolean, default: false }
        }
    }
}, { timestamps: true });

// Additional indexes for performance
userSchema.index({ isActive: 1 }); // Filter active users
userSchema.index({ role: 1 }); // Admin queries
userSchema.index({ expiresAt: 1 }); // Query expiring subscriptions

module.exports = mongoose.model('User', userSchema);
