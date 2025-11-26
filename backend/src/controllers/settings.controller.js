const User = require('../models/user.model');
const { hashPassword, comparePassword } = require('../utils/password');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

// Get user profile and settings
const getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select('-password -refreshToken');

        res.json({
            success: true,
            user
        });
    } catch (err) {
        next(err);
    }
};

// Update user profile (name, email)
const updateProfile = asyncHandler(async (req, res) => {
    const { name, email } = req.body;
    const userId = req.user.id;

    // Check if email is already taken by another user
    if (email) {
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
            return error(res, 'Email already in use', 400);
        }
    }

    const user = await User.findByIdAndUpdate(
        userId,
        { name, email },
        { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!user) {
        return error(res, 'User not found', 404);
    }

    logger.info('Profile updated', { userId, email: user.email });
    return success(res, user, 'Profile updated successfully');
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
        return error(res, 'User not found', 404);
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
        return error(res, 'Current password is incorrect', 400);
    }

    // Hash new password and update
    const hashedPassword = await hashPassword(newPassword);
    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    logger.info('Password changed', { userId, email: user.email });
    return success(res, null, 'Password changed successfully');
});

// Get user settings
const getUserSettings = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const user = await User.findById(userId).select('settings');
    if (!user) {
        return error(res, 'User not found', 404);
    }

    const settings = user.settings || { currency: 'USD' };
    return success(res, settings, 'Settings retrieved successfully');
});

// Update user settings
const updateUserSettings = asyncHandler(async (req, res) => {
    const { currency } = req.body;
    const userId = req.user.id;

    const user = await User.findByIdAndUpdate(
        userId,
        {
            $set: {
                'settings.currency': currency
            }
        },
        { new: true, runValidators: true }
    ).select('settings');

    if (!user) {
        return error(res, 'User not found', 404);
    }

    logger.info('Settings updated', { userId, currency });
    return success(res, user.settings, 'Settings updated successfully');
});

// Export user data (placeholder)
const exportData = async (req, res, next) => {
    try {
        res.json({
            success: true,
            message: 'Data export feature coming soon'
        });
    } catch (err) {
        next(err);
    }
};

// Delete user account
const deleteAccount = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Note: In a real app, you might want to soft delete or archive data
    // instead of hard delete, and cleanup related data (transactions, etc.)
    await User.findByIdAndDelete(userId);

    logger.info('Account deleted', { userId });
    return success(res, null, 'Account deleted successfully');
});

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
    getUserSettings,
    updateUserSettings,
    deleteAccount
};