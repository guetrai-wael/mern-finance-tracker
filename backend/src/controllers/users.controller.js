/* Users controller: admin operations and user management */
const User = require('../models/user.model');
const logger = require('../utils/logger');
const { hashPassword } = require('../utils/password');
const asyncHandler = require('../utils/asyncHandler');
const { success, successList, error } = require('../utils/response');

const listUsers = asyncHandler(async (req, res) => {
    // Bounded pagination — at friends/family scale this is overkill, but it makes
    // the contract safe by default once the user table grows.
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
        User.find().select('-password -refreshToken').sort({ createdAt: -1 }).skip(skip).limit(limit),
        User.countDocuments()
    ]);
    const usersWithId = users.map(user => ({ ...user.toObject(), id: user._id.toString() }));
    return successList(res, usersWithId, 'Users retrieved successfully', { page, limit, total });
});

const getUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password -refreshToken');
    if (!user) return error(res, 'User not found', 404);
    const userWithId = { ...user.toObject(), id: user._id.toString() };
    return success(res, userWithId, 'User retrieved successfully');
});

const updateUser = asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    const actingAdminId = req.user._id.toString();

    // Defense-in-depth even though the route now has validateBody(userSchemas.update):
    // explicitly narrow to the four fields the schema allows. Anything else gets
    // silently dropped, so a future schema change can't widen attack surface here.
    const ALLOWED = ['name', 'email', 'role', 'isActive'];
    const updates = {};
    for (const k of ALLOWED) {
        if (Object.prototype.hasOwnProperty.call(req.body, k)) updates[k] = req.body[k];
    }

    // Self-edit guard: admins can update their own name/email via /api/v1/auth/profile,
    // but the admin endpoint must not let an admin downgrade or deactivate themselves —
    // both are foot-guns that lock the only admin out of their own app.
    if (targetId === actingAdminId) {
        if (updates.role && updates.role !== 'admin') {
            return error(res, 'You cannot downgrade your own admin role here. Ask another admin.', 400);
        }
        if (updates.isActive === false) {
            return error(res, 'You cannot deactivate your own account.', 400);
        }
    }

    logger.info('User update initiated', { userId: targetId, updates: Object.keys(updates), adminId: actingAdminId });
    const user = await User.findByIdAndUpdate(targetId, updates, {
        new: true,
        runValidators: true
    }).select('-password -refreshToken');
    if (!user) return error(res, 'User not found', 404);
    const userWithId = { ...user.toObject(), id: user._id.toString() };
    logger.info('User updated successfully', { userId: targetId, email: userWithId.email });
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
