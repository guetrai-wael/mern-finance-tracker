/* Seed script to create initial admin user and sample data */
const mongoose = require('mongoose');
const config = require('../config/index');
const User = require('../models/user.model');
const Category = require('../models/category.model');
const Transaction = require('../models/transaction.model');
const Budget = require('../models/budget.model');
const { hashPassword } = require('../utils/password');
const logger = require('../utils/logger');

async function seedDatabase() {
    try {
        await mongoose.connect(config.mongoUri);
        logger.info('Database seeding: Connected to MongoDB', { operation: 'seed' });

        // Create admin user
        const adminExists = await User.findOne({ email: 'admin@finance.com' });
        if (!adminExists) {
            const adminPassword = await hashPassword('admin123');
            const admin = await User.create({
                name: 'Admin User',
                email: 'admin@finance.com',
                password: adminPassword,
                role: 'admin'
            });
            logger.info('Database seeding: admin user created', { email: admin.email, operation: 'seed' });
        }

        // Create test user
        const userExists = await User.findOne({ email: 'user@finance.com' });
        let testUser;
        if (!userExists) {
            const userPassword = await hashPassword('user123');
            testUser = await User.create({
                name: 'Test User',
                email: 'user@finance.com',
                password: userPassword,
                role: 'user'
            });
            logger.info('Database seeding: test user created', { email: testUser.email, operation: 'seed' });
        } else {
            testUser = userExists;
        }

        // Create sample categories for test user
        const categoryNames = ['Food', 'Transportation', 'Utilities', 'Entertainment', 'Shopping'];
        for (const name of categoryNames) {
            const exists = await Category.findOne({ user: testUser._id, name });
            if (!exists) {
                await Category.create({ user: testUser._id, name });
                logger.info('Database seeding: category created', { categoryName: name, operation: 'seed' });
            }
        }

        // Create sample transactions
        const categories = await Category.find({ user: testUser._id });
        const now = new Date();
        const thisMonth = now.toISOString().slice(0, 7);

        // Sample income
        const incomeExists = await Transaction.findOne({ user: testUser._id, type: 'income' });
        if (!incomeExists) {
            await Transaction.create({
                user: testUser._id,
                amount: 5000,
                type: 'income',
                description: 'Monthly Salary',
                date: new Date(thisMonth + '-01')
            });
            logger.info('Database seeding: sample income transaction created', { amount: 2500, operation: 'seed' });
        }

        // Sample expenses
        const expenseExists = await Transaction.findOne({ user: testUser._id, type: 'expense' });
        if (!expenseExists && categories.length > 0) {
            const sampleExpenses = [
                { amount: 300, category: categories[0]._id, description: 'Groceries' },
                { amount: 50, category: categories[1]._id, description: 'Gas' },
                { amount: 120, category: categories[2]._id, description: 'Electric Bill' },
                { amount: 80, category: categories[3]._id, description: 'Movie Night' }
            ];

            for (const expense of sampleExpenses) {
                await Transaction.create({
                    user: testUser._id,
                    type: 'expense',
                    ...expense,
                    date: new Date()
                });
            }
            logger.info('Database seeding: sample expense transactions created', { count: expenseTransactions.length, operation: 'seed' });
        }

        // Create sample budget
        const budgetExists = await Budget.findOne({ user: testUser._id, month: thisMonth });
        if (!budgetExists && categories.length > 0) {
            await Budget.create({
                user: testUser._id,
                month: thisMonth,
                totalBudget: 2000,
                categoryBudgets: [
                    { category: categories[0]._id, amount: 500 }, // Food
                    { category: categories[1]._id, amount: 200 }, // Transportation
                    { category: categories[2]._id, amount: 300 }, // Utilities
                    { category: categories[3]._id, amount: 200 }  // Entertainment
                ]
            });
            logger.info('Database seeding: sample budget created', { operation: 'seed' });
        }

        logger.info('Database seeding completed successfully', { operation: 'seed' });
        process.exit(0);
    } catch (error) {
        logger.error('Database seeding failed', { error: error.message, stack: error.stack, operation: 'seed' });
        process.exit(1);
    }
}

seedDatabase();