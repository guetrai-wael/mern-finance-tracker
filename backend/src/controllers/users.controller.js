/* Users controller: admin operations and user management */
const User = require('../models/user.model');
const logger = require('../utils/logger');
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

const deactivateUser = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(userId, {
        isActive: false
    }, { new: true }).select('-password -refreshToken');

    if (!user) return error(res, 'User not found', 404);

    logger.info(`User deactivated by admin`, { targetUserId: userId, adminId: req.user._id });
    return success(res, user, 'User deactivated successfully');
});

module.exports = { listUsers, getUser, updateUser, deleteUser, activateUser, deactivateUser };
