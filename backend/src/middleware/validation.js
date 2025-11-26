/* Enhanced validation middleware with comprehensive error handling and logging */
const Joi = require('joi');
const enhancedLogger = require('../utils/enhancedLogger');

/**
 * Enhanced validation middleware factory
 */
const createValidationMiddleware = (schema, target = 'body') => {
    return (req, res, next) => {
        const contextLogger = req.logger || enhancedLogger;
        
        // Get data to validate
        let dataToValidate;
        switch (target) {
            case 'body':
                dataToValidate = req.body;
                break;
            case 'query':
                dataToValidate = req.query;
                break;
            case 'params':
                dataToValidate = req.params;
                break;
            case 'headers':
                dataToValidate = req.headers;
                break;
            default:
                dataToValidate = req.body;
        }
        
        // Validate data
        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false, // Collect all errors
            stripUnknown: true, // Remove unknown fields
            convert: true, // Type conversion (string to number, etc.)
            errors: {
                wrap: {
                    label: false // Don't wrap field names in quotes
                }
            }
        });
        
        if (error) {
            // Log validation errors
            contextLogger.warn('Validation failed', {
                target,
                errors: error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value,
                    type: detail.type
                })),
                originalData: dataToValidate,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            
            // Format validation errors for response
            const validationErrors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));
            
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors,
                errorType: 'validation_error'
            });
        }
        
        // Replace original data with validated/sanitized data
        switch (target) {
            case 'body':
                req.body = value;
                break;
            case 'query':
                req.query = value;
                break;
            case 'params':
                req.params = value;
                break;
            case 'headers':
                req.headers = value;
                break;
        }
        
        // Log successful validation in debug mode
        contextLogger.debug('Validation passed', {
            target,
            fieldsValidated: Object.keys(value || {})
        });
        
        next();
    };
};

/**
 * Validate request body
 */
const validateBody = (schema) => createValidationMiddleware(schema, 'body');

/**
 * Validate query parameters
 */
const validateQuery = (schema) => createValidationMiddleware(schema, 'query');

/**
 * Validate route parameters
 */
const validateParams = (schema) => createValidationMiddleware(schema, 'params');

/**
 * Validate headers
 */
const validateHeaders = (schema) => createValidationMiddleware(schema, 'headers');

/**
 * Multiple validation middleware - validates multiple targets
 */
const validateMultiple = (validations) => {
    return (req, res, next) => {
        const contextLogger = req.logger || enhancedLogger;
        const allErrors = [];
        
        // Validate each target
        for (const { schema, target } of validations) {
            let dataToValidate;
            switch (target) {
                case 'body':
                    dataToValidate = req.body;
                    break;
                case 'query':
                    dataToValidate = req.query;
                    break;
                case 'params':
                    dataToValidate = req.params;
                    break;
                case 'headers':
                    dataToValidate = req.headers;
                    break;
                default:
                    continue;
            }
            
            const { error, value } = schema.validate(dataToValidate, {
                abortEarly: false,
                stripUnknown: true,
                convert: true,
                errors: { wrap: { label: false } }
            });
            
            if (error) {
                // Collect errors with target context
                const targetErrors = error.details.map(detail => ({
                    target,
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value,
                    type: detail.type
                }));
                allErrors.push(...targetErrors);
            } else {
                // Update request with validated data
                switch (target) {
                    case 'body':
                        req.body = value;
                        break;
                    case 'query':
                        req.query = value;
                        break;
                    case 'params':
                        req.params = value;
                        break;
                    case 'headers':
                        req.headers = value;
                        break;
                }
            }
        }
        
        if (allErrors.length > 0) {
            // Log all validation errors
            contextLogger.warn('Multiple validation failures', {
                errors: allErrors,
                totalErrors: allErrors.length,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: allErrors,
                errorType: 'validation_error'
            });
        }
        
        contextLogger.debug('Multiple validations passed', {
            targets: validations.map(v => v.target)
        });
        
        next();
    };
};

/**
 * Conditional validation - only validate if condition is met
 */
const validateConditional = (condition, schema, target = 'body') => {
    return (req, res, next) => {
        // Check condition
        const shouldValidate = typeof condition === 'function' 
            ? condition(req) 
            : condition;
        
        if (!shouldValidate) {
            return next();
        }
        
        // Apply validation
        return createValidationMiddleware(schema, target)(req, res, next);
    };
};

/**
 * Sanitization middleware - additional data cleaning
 */
const sanitizeInput = (req, res, next) => {
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        
        return str
            .trim() // Remove leading/trailing whitespace
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/vbscript:/gi, '') // Remove vbscript: protocol
            .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    };
    
    const sanitizeObject = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        
        if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = sanitizeString(value);
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    };
    
    // Sanitize request data
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    
    next();
};

/**
 * Rate limiting for validation failures - prevent brute force validation attacks
 */
const validationRateLimit = new Map();

const checkValidationRateLimit = (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const maxFailures = 50; // Max 50 validation failures per 5 minutes
    
    if (!validationRateLimit.has(key)) {
        validationRateLimit.set(key, { count: 0, resetTime: now + windowMs });
        return next();
    }
    
    const record = validationRateLimit.get(key);
    
    if (now > record.resetTime) {
        // Reset window
        record.count = 0;
        record.resetTime = now + windowMs;
        return next();
    }
    
    if (record.count >= maxFailures) {
        const contextLogger = req.logger || enhancedLogger;
        contextLogger.security('validation_rate_limit_exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            count: record.count,
            window: windowMs
        });
        
        return res.status(429).json({
            success: false,
            message: 'Too many validation failures. Please try again later.',
            errorType: 'rate_limit_error',
            retryAfter: Math.ceil((record.resetTime - now) / 1000)
        });
    }
    
    next();
};

// Clean up old rate limit records every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of validationRateLimit.entries()) {
        if (now > record.resetTime) {
            validationRateLimit.delete(key);
        }
    }
}, 10 * 60 * 1000);

module.exports = {
    validateBody,
    validateQuery,
    validateParams,
    validateHeaders,
    validateMultiple,
    validateConditional,
    sanitizeInput,
    checkValidationRateLimit,
    createValidationMiddleware
};