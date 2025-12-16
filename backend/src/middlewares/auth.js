/* Auth middleware: verify access token from httpOnly cookie and attach user to req */
const { verifyAccess } = require('../utils/jwt');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

const auth = asyncHandler(async (req, res, next) => {
    // Extract token from cookie OR Authorization header
    const token = req.cookies?.accessToken ||
        (req.headers.authorization?.startsWith('Bearer') ? req.headers.authorization.split(' ')[1] : null);

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    const payload = verifyAccess(token);
    const user = await User.findById(payload.sub).select('-password -refreshToken');
    if (!user) {
        logger.warn(`User not found for token: ${payload.sub}`);
        return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
});

module.exports = auth;
