/* Middleware to enforce subscription requirement */
const checkSubscription = (req, res, next) => {
    // Admin bypass: Admins are always allowed
    if (req.user && req.user.role === 'admin') {
        return next();
    }

    // Check if user exists (should be ensured by auth middleware, but safety first)
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized',
            errorType: 'auth_error'
        });
    }

    const { isActive, expiresAt } = req.user;
    const now = new Date();

    // Condition 1: User is explicitly inactive
    if (!isActive) {
        return res.status(403).json({
            success: false,
            message: 'Account inactive. Subscription required.',
            errorType: 'SUBSCRIPTION_REQUIRED'
        });
    }

    // Condition 2: Subscription has expired (if expiresAt is set)
    if (expiresAt && new Date(expiresAt) < now) {
        return res.status(403).json({
            success: false,
            message: 'Subscription expired. Please renew.',
            errorType: 'SUBSCRIPTION_REQUIRED'
        });
    }

    // All good
    next();
};

module.exports = checkSubscription;
