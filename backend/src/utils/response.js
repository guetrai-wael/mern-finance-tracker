/* Standardized API response utility for consistent frontend integration */

/**
 * Success response for single resource
 */
const success = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

/**
 * Success response for resource collections
 */
const successList = (res, items, message = 'Success', meta = {}) => {
    return res.status(200).json({
        success: true,
        message,
        data: items,
        meta: {
            count: items.length,
            ...meta
        }
    });
};

/**
 * Success response for operations without data
 */
const successMessage = (res, message, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message
    });
};

/**
 * Error response
 */
const error = (res, message, statusCode = 500, errors = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        ...(errors && { errors })
    });
};

/**
 * Created response for new resources
 */
const created = (res, data, message = 'Created successfully') => {
    return success(res, data, message, 201);
};

module.exports = {
    success,
    successList,
    successMessage,
    error,
    created
};