/* Validation schemas for request bodies using Joi */
const Joi = require('joi');

const signupSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

const transactionSchema = Joi.object({
    amount: Joi.number().required(),
    category: Joi.string().optional().allow(null),
    type: Joi.string().valid('income', 'expense').required(),
    date: Joi.date().optional(),
    description: Joi.string().allow('', null)
});

const categorySchema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().allow('', null)
});

const budgetSchema = Joi.object({
    month: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
    totalBudget: Joi.number().min(0).required(),
    categoryBudgets: Joi.array().items(
        Joi.object({ category: Joi.string().required(), amount: Joi.number().min(0).required() })
    )
});

const userUpdateSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
    isActive: Joi.boolean().optional(),
    role: Joi.string().valid('user', 'admin').optional()
});

const goalSchema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().allow('', null),
    targetAmount: Joi.number().min(0.01).required(),
    currentAmount: Joi.number().min(0).optional(),
    targetDate: Joi.date().optional(),
    category: Joi.string().valid('emergency', 'vacation', 'house', 'car', 'retirement', 'education', 'other').optional(),
    priority: Joi.string().valid('low', 'medium', 'high').optional()
});

// Parameter validation schemas
const idParamSchema = Joi.object({
    params: Joi.object({
        id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
    })
});

const paginationQuerySchema = Joi.object({
    query: Joi.object({
        page: Joi.number().integer().min(1).optional(),
        limit: Joi.number().integer().min(1).max(100).optional(),
        sort: Joi.string().optional()
    }).unknown(true) // Allow other query params
});

const goalContributionSchema = Joi.object({
    amount: Joi.number().min(0.01).required(),
    description: Joi.string().allow('', null)
});

const profileUpdateSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional()
});

const passwordUpdateSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required()
});

const settingsUpdateSchema = Joi.object({
    country: Joi.string().length(2).optional(),
    currency: Joi.string().length(3).optional(),
    dateFormat: Joi.string().valid('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD').optional(),
    numberFormat: Joi.string().valid('1,234.56', '1.234,56', '1 234,56').optional(),
    theme: Joi.string().valid('light', 'dark', 'auto').optional(),
    notifications: Joi.object({
        email: Joi.boolean().optional(),
        budgetAlerts: Joi.boolean().optional(),
        goalReminders: Joi.boolean().optional(),
        monthlyReports: Joi.boolean().optional()
    }).optional()
});

const accountDeleteSchema = Joi.object({
    password: Joi.string().required()
});

module.exports = { 
    // Body validation schemas
    signupSchema, 
    loginSchema, 
    transactionSchema, 
    categorySchema, 
    budgetSchema, 
    userUpdateSchema, 
    goalSchema, 
    goalContributionSchema,
    profileUpdateSchema,
    passwordUpdateSchema,
    settingsUpdateSchema,
    accountDeleteSchema,
    // Parameter validation schemas
    idParamSchema,
    paginationQuerySchema
};
