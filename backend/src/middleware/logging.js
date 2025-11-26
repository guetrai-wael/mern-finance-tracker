/* Request logging and tracking middleware */
const logger = require('../utils/enhancedLogger');
const { requestContext } = require('../utils/enhancedLogger');

/**
 * Request tracking middleware - adds request ID and context
 */
const requestTracking = (req, res, next) => {
    // Create new request context
    const requestId = requestContext.create();
    req.requestId = requestId;
    
    // Update context with request details
    requestContext.update(requestId, {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user ? req.user._id : null
    });
    
    // Add request ID to response headers for debugging
    res.set('X-Request-ID', requestId);
    
    // Create child logger for this request
    req.logger = logger.child(requestId);
    
    next();
};

/**
 * Request logging middleware - logs HTTP requests with performance metrics
 */
const requestLogging = (req, res, next) => {
    const startTime = Date.now();
    
    // Log incoming request
    req.logger.info(`Incoming request: ${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        contentLength: req.get('Content-Length'),
        referer: req.get('Referer')
    });
    
    // Override res.end to capture response details
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const duration = Date.now() - startTime;
        
        // Log response
        logger.httpRequest(req, res, duration);
        
        // Log performance metrics for slow requests
        if (duration > 1000) { // Log requests taking more than 1 second
            req.logger.performance(`Slow request detected`, {
                duration,
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode
            });
        }
        
        // Clean up request context
        if (req.requestId) {
            setTimeout(() => {
                requestContext.remove(req.requestId);
            }, 5000); // Keep context for 5 seconds after request completion
        }
        
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

/**
 * Error logging middleware - comprehensive error logging with context
 */
const errorLogging = (err, req, res, next) => {
    const errorId = require('uuid').v4();
    
    // Prepare error metadata
    const errorMeta = {
        errorId,
        name: err.name,
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode || 500,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user ? req.user._id : null,
        requestId: req.requestId,
        headers: req.headers,
        body: req.body ? JSON.stringify(req.body).substring(0, 1000) : null, // Limit body size
        query: req.query,
        params: req.params
    };
    
    // Log error with appropriate level
    if (err.statusCode && err.statusCode < 500) {
        // Client errors (4xx)
        logger.warn(`Client error: ${err.message}`, errorMeta);
    } else {
        // Server errors (5xx)
        logger.error(`Server error: ${err.message}`, errorMeta);
        
        // Alert on critical errors in production
        if (process.env.NODE_ENV === 'production') {
            logger.error('Critical error in production', {
                ...errorMeta,
                alert: true,
                severity: 'critical'
            });
        }
    }
    
    // Add error ID to response for tracking
    res.set('X-Error-ID', errorId);
    
    next(err);
};

/**
 * Performance monitoring middleware - tracks response times and memory usage
 */
const performanceMonitoring = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    // Override res.end to capture performance metrics
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        // Calculate memory usage delta
        const memoryDelta = {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            external: endMemory.external - startMemory.external
        };
        
        // Log performance metrics
        req.logger.performance(`Request completed`, {
            duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
            statusCode: res.statusCode,
            memoryDelta,
            currentMemory: endMemory
        });
        
        // Alert on high memory usage
        if (endMemory.heapUsed > 100 * 1024 * 1024) { // 100MB
            logger.warn('High memory usage detected', {
                memoryUsage: endMemory,
                requestId: req.requestId,
                url: req.originalUrl
            });
        }
        
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

/**
 * Security event logging middleware
 */
const securityLogging = (req, res, next) => {
    // Log suspicious activities
    const suspiciousPatterns = [
        /\.\./,  // Directory traversal
        /<script/i, // XSS attempts
        /union.*select/i, // SQL injection
        /javascript:/i, // JavaScript injection
        /vbscript:/i // VBScript injection
    ];
    
    const checkForSuspiciousContent = (content) => {
        if (!content) return false;
        const contentStr = JSON.stringify(content);
        return suspiciousPatterns.some(pattern => pattern.test(contentStr));
    };
    
    // Check URL, query params, and body for suspicious content
    if (checkForSuspiciousContent(req.originalUrl) ||
        checkForSuspiciousContent(req.query) ||
        checkForSuspiciousContent(req.body)) {
        
        logger.security('Suspicious request detected', {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            query: req.query,
            body: req.body,
            requestId: req.requestId
        });
    }
    
    // Log multiple failed authentication attempts from same IP
    if (req.originalUrl.includes('/auth/login') && req.method === 'POST') {
        // This would typically work with a rate limiting store
        // For now, just log the attempt
        logger.auth('login_attempt', req.body?.email, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            requestId: req.requestId
        });
    }
    
    next();
};

module.exports = {
    requestTracking,
    requestLogging,
    errorLogging,
    performanceMonitoring,
    securityLogging
};