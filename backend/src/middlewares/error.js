/* Error handling middleware with structured logging */
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
    // Log error with context
    logger.error('Request error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    
    const status = err.status || 500;
    const message = status === 500 ? 'Internal Server Error' : err.message;
    
    res.status(status).json({ 
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

module.exports = { errorHandler };
