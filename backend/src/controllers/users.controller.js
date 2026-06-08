/* Users controller: admin operations and user management */
const User = require('../models/user.model');
const logger = require('../utils/logger');
const { hashPassword } = require('../utils/password');
const asyncHandler = require('../utils/asyncHandler');
const { success, successList, error } = require('../utils/response');

const listUsers = asyncHandler(async (req, res) => {
    const users = await User.find().select('-password -refreshToken');
    const usersWithId = users.map(user => ({ ...user.toObject(), id: user._id.toString() }));
    return successList(res, usersWithId, 'Users retrieved successfully');
});

const getUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password -refreshToken');
    if (!user) return error(res, 'User not found', 404);
    const userWithId = { ...user.toObject(), id: user._id.toString() };
    return success(res, userWithId, 'User retrieved successfully');
});

const updateUser = asyncHandler(async (req, res) => {
    logger.info('User update initiated', { userId: req.params.id, updates: Object.keys(req.body) });
    const updates = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password -refreshToken');
    if (!user) return error(res, 'User not found', 404);
    const userWithId = { ...user.toObject(), id: user._id.toString() };
    logger.info('User updated successfully', { userId: req.params.id, email: userWithId.email });
    return success(res, userWithId, 'User updated successfully');
});

const deleteUser = asyncHandler(async (req, res) => {
    logger.info('User deletion initiated', { userId: req.params.id });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    logger.info('User deleted successfully', { userId: req.params.id, email: user.email });
    return success(res, null, 'User deleted successfully');
});

const activateUser = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days subscription

    const user = await User.findByIdAndUpdate(userId, {
        isActive: true,
        activatedAt: now,
        expiresAt: expiresAt
    }, { new: true }).select('-password -refreshToken');

    if (!user) return error(res, 'User not found', 404);

    logger.info(`User activated by admin`, { targetUserId: userId, adminId: req.user._id });
    return success(res, user, 'User activated successfully');
});

const extendSubscription = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { days } = req.body;

    // Race-safe: read the current expiresAt, compute the new one, then
    // findOneAndUpdate with a predicate on the observed expiresAt. If two
    // admins extend the same user simultaneously, the second write's predicate
    // misses and we retry with the latest value — never silently overwriting.
    const MAX_ATTEMPTS = 3;
    let updated = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const user = await User.findById(userId);
        if (!user) return error(res, 'User not found', 404);

        const now = new Date();
        const base = (user.expiresAt && user.expiresAt > now) ? user.expiresAt : now;
        const newExpiry = new Date(base);
        newExpiry.setDate(newExpiry.getDate() + days);

        // Predicate matches a specific observed state: this expiresAt value (or
        // null/missing) on a doc whose _id we already verified. If a concurrent
        // request mutated expiresAt between our read and our write, the predicate
        // fails and we loop.
        updated = await User.findOneAndUpdate(
            {
                _id: userId,
                expiresAt: user.expiresAt ?? null
            },
            {
                $set: {
                    isActive: true,
                    expiresAt: newExpiry,
                    ...(user.activatedAt ? {} : { activatedAt: now })
                }
            },
            { new: true }
        ).select('-password -refreshToken');

        if (updated) break;
    }

    if (!updated) {
        logger.warn('extendSubscription gave up after retries', { targetUserId: userId, adminId: req.user._id });
        return error(res, 'Could not extend subscription — please retry', 409);
    }

    logger.info('User subscription extended by admin', {
        targetUserId: userId,
        days,
        newExpiresAt: updated.expiresAt,
        adminId: req.user._id
    });
    return success(res, updated, `Subscription extended by ${days} days`);
});

const deactivateUser = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(userId, {
        isActive: false
    }, { new: true }).select('-password -refreshToken');

    if (!user) return error(res, 'User not found', 404);

    logger.info(`User deactivated by admin`, { targetUserId: userId, adminId: req.user._id });
    return success(res, user, 'User deactivated successfully');
});

const resetUserPassword = asyncHandler(async (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return error(res, 'User not found', 404);

    user.password = await hashPassword(newPassword);
    user.refreshToken = null; // Force re-login after admin reset
    await user.save();

    logger.info('User password reset by admin', { targetUserId: userId, adminId: req.user._id });
    return success(res, null, 'Password reset successfully');
});

module.exports = { listUsers, getUser, updateUser, deleteUser, activateUser, deactivateUser, extendSubscription, resetUserPassword };
