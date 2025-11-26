/* Async handler wrapper to eliminate try-catch blocks in controllers */
const logger = require('./logger');

/**
 * Wraps async route handlers to catch errors automatically
 * @param {Function} fn - Async route handler function
 * @returns {Function} - Express middleware function
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        // Execute the async function and catch any errors
        Promise.resolve(fn(req, res, next)).catch((error) => {
            // Log the error with request context
            logger.error('Async handler caught error:', {
                error: error.message,
                stack: error.stack,
                url: req.url,
                method: req.method,
                ip: req.ip,
                userId: req.user?._id || 'anonymous',
                userAgent: req.get('User-Agent')
            });
            
            // Pass error to error handling middleware
            next(error);
        });
    };
};

module.exports = asyncHandler;