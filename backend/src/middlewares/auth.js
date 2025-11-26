/* Auth middleware: verify access token from httpOnly cookie and attach user to req */
const { verifyAccess } = require('../utils/jwt');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

const auth = asyncHandler(async (req, res, next) => {
    // Extract token from cookie instead of Authorization header
    const token = req.cookies?.accessToken;
    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }
    
    const payload = verifyAccess(token);
    const user = await User.findById(payload.sub).select('-password -refreshToken');
    if (!user || !user.isActive) {
        logger.warn(`Inactive user attempted access: ${payload.sub}`);
        return res.status(401).json({ message: 'Account inactive' });
    }
    
    req.user = user;
    next();
});

module.exports = auth;
