/* Auth controller: signup, login, refresh, logout with secure httpOnly cookies */
const User = require('../models/user.model');
const { hashPassword, comparePassword } = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const config = require('../config/index');
const logger = require('../utils/logger');
const enhancedLogger = require('../utils/enhancedLogger');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, error, successMessage } = require('../utils/response');

// Cookie options for secure JWT storage
// NOTE: sameSite 'none' is required for cross-origin cookies (frontend on chahrity.com, backend on api.chahrity.com)
const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000 // 15 minutes for access token
});

const getRefreshCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days for refresh token
});

const signup = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return error(res, 'Email already in use', 400);

    const hashed = await hashPassword(password);
    const user = await User.create({ name, email, password: hashed });

    // Enhanced logging with context
    const contextLogger = req.logger || enhancedLogger;
    contextLogger.auth('user_registration', user._id, {
        email: user.email,
        name: user.name,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    return created(res, { id: user._id, email: user.email, name: user.name }, 'User created successfully');
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const contextLogger = req.logger || enhancedLogger;

    const user = await User.findOne({ email });
    if (!user) {
        contextLogger.security('failed_login_attempt', {
            email,
            reason: 'user_not_found',
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        return error(res, 'Invalid credentials', 401);
    }

    const ok = await comparePassword(password, user.password);
    if (!ok) {
        contextLogger.security('invalid_password_attempt', {
            userId: user._id,
            email,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        return error(res, 'Invalid credentials', 401);
    }

    const access = signAccess({ sub: user._id, role: user.role });
    const refresh = signRefresh({ sub: user._id });
    user.refreshToken = refresh;
    await user.save();

    // Set secure httpOnly cookies
    res.cookie('accessToken', access, getCookieOptions());
    res.cookie('refreshToken', refresh, getRefreshCookieOptions());

    // Enhanced login success logging
    contextLogger.auth('successful_login', user._id, {
        email: user.email,
        role: user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        lastLogin: user.updatedAt
    });

    return success(res, {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        expiresAt: user.expiresAt
    }, 'Login successful');
});

const refresh = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return error(res, 'Refresh token required', 401);
    }

    const payload = verifyRefresh(refreshToken);
    const user = await User.findById(payload.sub);
    if (!user || user.refreshToken !== refreshToken) {
        return error(res, 'Invalid refresh token', 401);
    }

    const access = signAccess({ sub: user._id, role: user.role });
    const newRefresh = signRefresh({ sub: user._id });
    user.refreshToken = newRefresh;
    await user.save();

    // Set new secure cookies
    res.cookie('accessToken', access, getCookieOptions());
    res.cookie('refreshToken', newRefresh, getRefreshCookieOptions());

    logger.info(`Token refreshed for user: ${user.email}`);
    return successMessage(res, 'Token refreshed successfully');
});

const logout = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
        try {
            const payload = verifyRefresh(refreshToken);
            const user = await User.findById(payload.sub);
            if (user) {
                user.refreshToken = null;
                await user.save();
                logger.info(`User logged out: ${user.email}`);
            }
        } catch (tokenErr) {
            logger.warn('Invalid refresh token during logout:', tokenErr.message);
        }
    }

    // Clear cookies (must use same options as when setting, including sameSite)
    res.clearCookie('accessToken', getCookieOptions());
    res.clearCookie('refreshToken', getRefreshCookieOptions());

    return successMessage(res, 'Logged out successfully');
});

const me = asyncHandler(async (req, res) => {
    const user = req.user;
    return success(res, user, 'User profile retrieved successfully');
});

const updateProfile = asyncHandler(async (req, res) => {
    const { name, email } = req.body;
    const userId = req.user._id;

    // Check if email is already taken by another user
    if (email && email !== req.user.email) {
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
            return error(res, 'Email already in use', 400);
        }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
    ).select('-password -refreshToken');

    logger.info(`Profile updated for user: ${user.email}`);
    return success(res, user, 'Profile updated successfully');
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!currentPassword || !newPassword) {
        return error(res, 'Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
        return error(res, 'New password must be at least 6 characters long', 400);
    }

    const user = await User.findById(userId);
    const isValidPassword = await comparePassword(currentPassword, user.password);

    if (!isValidPassword) {
        return error(res, 'Current password is incorrect', 400);
    }

    const hashedPassword = await hashPassword(newPassword);
    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    logger.info(`Password changed for user: ${user.email}`);
    return successMessage(res, 'Password updated successfully');
});

module.exports = { signup, login, refresh, logout, me, updateProfile, changePassword };
