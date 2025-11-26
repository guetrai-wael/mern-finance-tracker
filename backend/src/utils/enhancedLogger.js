/* Enhanced logging system with request tracking and performance metrics */
const winston = require('winston');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Custom format for structured logging with request context
const structuredFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
        const { timestamp, level, message, stack, ...meta } = info;
        
        const logEntry = {
            timestamp,
            level,
            message: stack || message,
            ...meta
        };
        
        return JSON.stringify(logEntry);
    })
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, requestId, userId, duration, ...meta }) => {
        let logMessage = `${timestamp} [${level.toUpperCase()}]`;
        
        if (requestId) logMessage += ` [${requestId.slice(0, 8)}]`;
        if (userId) logMessage += ` [User:${userId}]`;
        if (duration !== undefined) logMessage += ` [${duration}ms]`;
        
        logMessage += `: ${message}`;
        
        // Add metadata if present
        const metaKeys = Object.keys(meta).filter(key => 
            !['timestamp', 'level', 'message', 'stack'].includes(key)
        );
        
        if (metaKeys.length > 0) {
            logMessage += ` | ${JSON.stringify(meta)}`;
        }
        
        return logMessage;
    })
);

// Create enhanced logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: structuredFormat,
    defaultMeta: {
        service: 'finance-app-backend',
        version: process.env.npm_package_version || '1.0.0'
    },
    transports: [
        // Console transport with enhanced format
        new winston.transports.Console({
            format: process.env.NODE_ENV === 'production' ? structuredFormat : consoleFormat
        }),
        
        // Error logs
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            tailable: true
        }),
        
        // Performance logs
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/performance.log'),
            level: 'info',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
            tailable: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.printf((info) => {
                    // Only log performance-related entries
                    if (info.duration !== undefined || info.queryTime !== undefined || info.memoryUsage) {
                        return JSON.stringify(info);
                    }
                    return false; // Skip non-performance logs
                })
            )
        }),
        
        // Application logs
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/app.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            tailable: true
        })
    ],
    
    // Exception and rejection handling
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/exceptions.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ],
    
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/rejections.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Request context storage for tracking requests across async operations
 */
class RequestContext {
    constructor() {
        this.context = new Map();
    }
    
    /**
     * Create new request context
     */
    create() {
        const requestId = uuidv4();
        const startTime = Date.now();
        
        const context = {
            requestId,
            startTime,
            userId: null,
            userAgent: null,
            ip: null,
            method: null,
            url: null,
            performance: {
                dbQueries: 0,
                dbTime: 0,
                memoryUsage: process.memoryUsage()
            }
        };
        
        this.context.set(requestId, context);
        return requestId;
    }
    
    /**
     * Get request context
     */
    get(requestId) {
        return this.context.get(requestId);
    }
    
    /**
     * Update request context
     */
    update(requestId, updates) {
        const context = this.context.get(requestId);
        if (context) {
            Object.assign(context, updates);
        }
    }
    
    /**
     * Remove request context
     */
    remove(requestId) {
        this.context.delete(requestId);
    }
    
    /**
     * Clean up old contexts (older than 1 hour)
     */
    cleanup() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [requestId, context] of this.context.entries()) {
            if (context.startTime < oneHourAgo) {
                this.context.delete(requestId);
            }
        }
    }
}

const requestContext = new RequestContext();

// Cleanup old contexts every 30 minutes
setInterval(() => {
    requestContext.cleanup();
}, 30 * 60 * 1000);

/**
 * Enhanced logger with request context and performance tracking
 */
class EnhancedLogger {
    constructor(winstonLogger) {
        this.logger = winstonLogger;
        this.requestContext = requestContext;
    }
    
    /**
     * Create child logger with request context
     */
    child(requestId) {
        const context = this.requestContext.get(requestId);
        return {
            info: (message, meta = {}) => this.info(message, { ...meta, requestId }),
            warn: (message, meta = {}) => this.warn(message, { ...meta, requestId }),
            error: (message, meta = {}) => this.error(message, { ...meta, requestId }),
            debug: (message, meta = {}) => this.debug(message, { ...meta, requestId }),
            performance: (message, meta = {}) => this.performance(message, { ...meta, requestId }),
            auth: (event, userId, meta = {}) => this.auth(event, userId, { ...meta, requestId }),
            security: (event, meta = {}) => this.security(event, { ...meta, requestId }),
            dbQuery: (queryName, duration, meta = {}) => this.dbQuery(queryName, duration, { ...meta, requestId })
        };
    }
    
    /**
     * Log with automatic context enrichment
     */
    _logWithContext(level, message, meta = {}) {
        const enrichedMeta = { ...meta };
        
        // Add request context if available
        if (meta.requestId) {
            const context = this.requestContext.get(meta.requestId);
            if (context) {
                enrichedMeta.userId = context.userId;
                enrichedMeta.method = context.method;
                enrichedMeta.url = context.url;
                enrichedMeta.userAgent = context.userAgent;
                enrichedMeta.ip = context.ip;
            }
        }
        
        this.logger[level](message, enrichedMeta);
    }
    
    info(message, meta = {}) {
        this._logWithContext('info', message, meta);
    }
    
    warn(message, meta = {}) {
        this._logWithContext('warn', message, meta);
    }
    
    error(message, meta = {}) {
        // Add stack trace for errors
        if (meta.error && meta.error.stack) {
            meta.stack = meta.error.stack;
        }
        this._logWithContext('error', message, meta);
    }
    
    debug(message, meta = {}) {
        this._logWithContext('debug', message, meta);
    }
    
    /**
     * Performance logging with metrics
     */
    performance(message, meta = {}) {
        const perfMeta = {
            ...meta,
            category: 'performance',
            memoryUsage: process.memoryUsage()
        };
        
        this._logWithContext('info', message, perfMeta);
    }
    
    /**
     * Database query logging
     */
    dbQuery(queryName, duration, meta = {}) {
        const queryMeta = {
            ...meta,
            category: 'database',
            queryName,
            queryTime: duration
        };
        
        // Update request context if available
        if (meta.requestId) {
            const context = this.requestContext.get(meta.requestId);
            if (context) {
                context.performance.dbQueries++;
                context.performance.dbTime += duration;
            }
        }
        
        this.performance(`Database query: ${queryName}`, queryMeta);
    }
    
    /**
     * HTTP request logging
     */
    httpRequest(req, res, duration) {
        const meta = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            category: 'http'
        };
        
        if (req.user) {
            meta.userId = req.user._id;
        }
        
        if (req.requestId) {
            meta.requestId = req.requestId;
        }
        
        const level = res.statusCode >= 400 ? 'warn' : 'info';
        this._logWithContext(level, `${req.method} ${req.originalUrl}`, meta);
    }
    
    /**
     * Authentication events
     */
    auth(event, userId, meta = {}) {
        const authMeta = {
            ...meta,
            category: 'authentication',
            event,
            userId
        };
        
        this.info(`Auth event: ${event}`, authMeta);
    }
    
    /**
     * Security events
     */
    security(event, meta = {}) {
        const securityMeta = {
            ...meta,
            category: 'security',
            event
        };
        
        this.warn(`Security event: ${event}`, securityMeta);
    }
}

// Create enhanced logger instance
const enhancedLogger = new EnhancedLogger(logger);

// Export both the enhanced logger and request context utilities
module.exports = enhancedLogger;
module.exports.requestContext = requestContext;
module.exports.logger = logger; // Export original winston logger for compatibility