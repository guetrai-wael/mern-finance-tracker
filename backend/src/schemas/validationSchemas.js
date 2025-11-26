/* Comprehensive Joi validation schemas for all API endpoints */
const Joi = require('joi');

// Common validation patterns
const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/; // Min 8 chars, 1 upper, 1 lower, 1 number

// Reusable schema components
const commonSchemas = {
    objectId: Joi.string().pattern(objectIdPattern).required().messages({
        'string.pattern.base': 'Invalid ObjectId format'
    }),

    optionalObjectId: Joi.string().pattern(objectIdPattern).optional().messages({
        'string.pattern.base': 'Invalid ObjectId format'
    }),

    email: Joi.string().email().pattern(emailPattern).required().messages({
        'string.email': 'Invalid email format',
        'string.pattern.base': 'Invalid email format'
    }),

    password: Joi.string().min(6).max(128).required().messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.max': 'Password must not exceed 128 characters'
    }),

    strongPassword: Joi.string().pattern(passwordPattern).required().messages({
        'string.pattern.base': 'Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, and 1 number'
    }),

    name: Joi.string().trim().min(2).max(50).required().messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name must not exceed 50 characters'
    }),

    description: Joi.string().trim().max(500).optional().allow('').messages({
        'string.max': 'Description must not exceed 500 characters'
    }),

    amount: Joi.number().positive().precision(2).max(999999999.99).required().messages({
        'number.positive': 'Amount must be a positive number',
        'number.max': 'Amount must not exceed 999,999,999.99'
    }),

    optionalAmount: Joi.number().positive().precision(2).max(999999999.99).optional().messages({
        'number.positive': 'Amount must be a positive number',
        'number.max': 'Amount must not exceed 999,999,999.99'
    }),

    date: Joi.date().iso().required().messages({
        'date.format': 'Date must be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)'
    }),

    optionalDate: Joi.date().iso().optional().messages({
        'date.format': 'Date must be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)'
    }),

    pagination: {
        page: Joi.number().integer().min(1).max(1000).optional().default(1),
        limit: Joi.number().integer().min(1).max(100).optional().default(20)
    },

    sortOrder: Joi.string().valid('asc', 'desc', '1', '-1').optional().default('desc')
};

// Authentication schemas
const authSchemas = {
    signup: Joi.object({
        name: commonSchemas.name,
        email: commonSchemas.email,
        password: commonSchemas.strongPassword
    }).required(),

    login: Joi.object({
        email: commonSchemas.email,
        password: Joi.string().required().messages({
            'any.required': 'Password is required'
        })
    }).required(),

    changePassword: Joi.object({
        currentPassword: Joi.string().required().messages({
            'any.required': 'Current password is required'
        }),
        newPassword: commonSchemas.strongPassword
    }).required(),

    updateProfile: Joi.object({
        name: Joi.string().trim().min(2).max(50).optional().messages({
            'string.min': 'Name must be at least 2 characters long',
            'string.max': 'Name must not exceed 50 characters'
        }),
        email: Joi.string().email().optional().messages({
            'string.email': 'Invalid email format'
        })
    }).min(1).required().messages({
        'object.min': 'At least one field must be provided for update'
    })
};

// Transaction schemas
const transactionSchemas = {
    create: Joi.object({
        amount: commonSchemas.amount,
        type: Joi.string().valid('income', 'expense').required().messages({
            'any.only': 'Type must be either "income" or "expense"'
        }),
        category: commonSchemas.optionalObjectId,
        date: commonSchemas.optionalDate,
        description: commonSchemas.description
    }).required(),

    update: Joi.object({
        amount: commonSchemas.optionalAmount,
        type: Joi.string().valid('income', 'expense').optional().messages({
            'any.only': 'Type must be either "income" or "expense"'
        }),
        category: commonSchemas.optionalObjectId,
        date: commonSchemas.optionalDate,
        description: commonSchemas.description
    }).min(1).required().messages({
        'object.min': 'At least one field must be provided for update'
    }),

    list: Joi.object({
        start: Joi.date().iso().optional().messages({
            'date.format': 'Start date must be in ISO format'
        }),
        end: Joi.date().iso().optional().messages({
            'date.format': 'End date must be in ISO format'
        }),
        type: Joi.string().valid('income', 'expense').optional(),
        category: commonSchemas.optionalObjectId,
        ...commonSchemas.pagination,
        sort: commonSchemas.sortOrder
    }).custom((value, helpers) => {
        if (value.start && value.end && new Date(value.start) > new Date(value.end)) {
            return helpers.error('custom.dateRange');
        }
        return value;
    }).messages({
        'custom.dateRange': 'Start date must be before end date'
    })
};

// Category schemas
const categorySchemas = {
    create: Joi.object({
        name: Joi.string().trim().min(2).max(30).required().messages({
            'string.min': 'Category name must be at least 2 characters long',
            'string.max': 'Category name must not exceed 30 characters'
        }),
        description: commonSchemas.description
    }).required(),

    update: Joi.object({
        name: Joi.string().trim().min(2).max(30).optional().messages({
            'string.min': 'Category name must be at least 2 characters long',
            'string.max': 'Category name must not exceed 30 characters'
        }),
        description: commonSchemas.description
    }).min(1).required().messages({
        'object.min': 'At least one field must be provided for update'
    })
};

// Budget schemas
const budgetSchemas = {
    upsert: Joi.object({
        month: Joi.string().pattern(/^\d{4}-\d{2}$/).required().messages({
            'string.pattern.base': 'Month must be in YYYY-MM format'
        }),
        totalBudget: Joi.number().min(0).precision(2).max(999999999.99).required().messages({
            'number.min': 'Total budget must be zero or positive',
            'number.max': 'Total budget must not exceed 999,999,999.99'
        }),
        categoryBudgets: Joi.array().items(
            Joi.object({
                category: commonSchemas.objectId,
                amount: Joi.number().min(0).precision(2).max(999999999.99).required().messages({
                    'number.min': 'Category budget amount must be zero or positive',
                    'number.max': 'Category budget amount must not exceed 999,999,999.99'
                })
            })
        ).optional().default([])
    }).required(),

    get: Joi.object({
        month: Joi.string().pattern(/^\d{4}-\d{2}$/).required().messages({
            'string.pattern.base': 'Month must be in YYYY-MM format'
        })
    })
};

// Goal schemas
const goalSchemas = {
    create: Joi.object({
        name: Joi.string().trim().min(2).max(100).required().messages({
            'string.min': 'Goal name must be at least 2 characters long',
            'string.max': 'Goal name must not exceed 100 characters'
        }),
        description: commonSchemas.description,
        targetAmount: commonSchemas.amount,
        currentAmount: Joi.number().min(0).precision(2).max(999999999.99).optional().default(0).messages({
            'number.min': 'Current amount must be zero or positive',
            'number.max': 'Current amount must not exceed 999,999,999.99'
        }),
        targetDate: commonSchemas.optionalDate,
        category: Joi.string().valid(
            'emergency', 'vacation', 'house', 'car', 'retirement', 'education', 'other'
        ).optional().default('other').messages({
            'any.only': 'Category must be one of: emergency, vacation, house, car, retirement, education, other'
        }),
        priority: Joi.string().valid('low', 'medium', 'high').optional().default('medium').messages({
            'any.only': 'Priority must be one of: low, medium, high'
        })
    }).required(),

    update: Joi.object({
        name: Joi.string().trim().min(2).max(100).optional().messages({
            'string.min': 'Goal name must be at least 2 characters long',
            'string.max': 'Goal name must not exceed 100 characters'
        }),
        description: commonSchemas.description,
        targetAmount: commonSchemas.optionalAmount,
        currentAmount: Joi.number().min(0).precision(2).max(999999999.99).optional().messages({
            'number.min': 'Current amount must be zero or positive',
            'number.max': 'Current amount must not exceed 999,999,999.99'
        }),
        targetDate: commonSchemas.optionalDate,
        category: Joi.string().valid(
            'emergency', 'vacation', 'house', 'car', 'retirement', 'education', 'other'
        ).optional().messages({
            'any.only': 'Category must be one of: emergency, vacation, house, car, retirement, education, other'
        }),
        priority: Joi.string().valid('low', 'medium', 'high').optional().messages({
            'any.only': 'Priority must be one of: low, medium, high'
        }),
        isCompleted: Joi.boolean().optional()
    }).min(1).required().messages({
        'object.min': 'At least one field must be provided for update'
    }),

    addContribution: Joi.object({
        amount: commonSchemas.amount,
        description: Joi.string().trim().max(200).optional().messages({
            'string.max': 'Description must not exceed 200 characters'
        })
    }).required()
};

// User schemas
const userSchemas = {
    update: Joi.object({
        name: commonSchemas.name.optional(),
        email: Joi.string().email().optional().messages({
            'string.email': 'Invalid email format'
        }),
        role: Joi.string().valid('user', 'admin').optional().messages({
            'any.only': 'Role must be either "user" or "admin"'
        }),
        isActive: Joi.boolean().optional()
    }).min(1).required().messages({
        'object.min': 'At least one field must be provided for update'
    })
};

// Parameter validation schemas
const paramSchemas = {
    id: Joi.object({
        id: commonSchemas.objectId
    }),

    userId: Joi.object({
        userId: commonSchemas.objectId
    })
};

// Query validation schemas
const querySchemas = {
    pagination: Joi.object(commonSchemas.pagination),

    dateRange: Joi.object({
        start: Joi.date().iso().optional(),
        end: Joi.date().iso().optional(),
        ...commonSchemas.pagination
    }).custom((value, helpers) => {
        if (value.start && value.end && new Date(value.start) > new Date(value.end)) {
            return helpers.error('custom.dateRange');
        }
        return value;
    }).messages({
        'custom.dateRange': 'Start date must be before end date'
    })
};

module.exports = {
    authSchemas,
    transactionSchemas,
    categorySchemas,
    budgetSchemas,
    goalSchemas,
    userSchemas,
    paramSchemas,
    querySchemas,
    commonSchemas
};