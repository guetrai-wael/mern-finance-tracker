/* Export controller: CSV/JSON export of user data for admins */
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const User = require('../models/user.model');
const logger = require('../utils/logger');

async function exportUsers(req, res, next) {
    try {
        const format = req.query.format || 'json';
        const users = await User.find().select('-password -refreshToken');
        const filename = `users_export_${Date.now()}`;

        if (format === 'csv') {
            const filepath = path.join(__dirname, '../tmp', `${filename}.csv`);

            // Ensure tmp directory exists
            const tmpDir = path.dirname(filepath);
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            const csvWriter = createCsvWriter({
                path: filepath,
                header: [
                    { id: '_id', title: 'ID' },
                    { id: 'name', title: 'Name' },
                    { id: 'email', title: 'Email' },
                    { id: 'role', title: 'Role' },
                    { id: 'isActive', title: 'Active' },
                    { id: 'createdAt', title: 'Created' },
                    { id: 'updatedAt', title: 'Updated' }
                ]
            });

            await csvWriter.writeRecords(users);
            res.download(filepath, `${filename}.csv`, (err) => {
                if (err) logger.error('CSV export download failed', { error: err.message, filePath: filepath });
                // cleanup
                setTimeout(() => {
                    try { fs.unlinkSync(filepath); } catch { }
                }, 5000);
            });
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
            res.json(users);
        }
    } catch (err) { next(err); }
}

async function exportTransactions(req, res, next) {
    try {
        const format = req.query.format || 'json';
        const userId = req.user.id;

        // Import Transaction model here to avoid circular dependency
        const Transaction = require('../models/transaction.model');

        // Mirror the same filter shape as GET /transactions: start, end, type.
        // Without this, the export ignored the user's current view filters,
        // which surprised users who hit "Export" after narrowing to a month.
        const query = { user: userId };
        if (req.query.start || req.query.end) {
            query.date = {};
            if (req.query.start) query.date.$gte = new Date(req.query.start);
            if (req.query.end) query.date.$lte = new Date(req.query.end);
        }
        if (req.query.type === 'income' || req.query.type === 'expense') {
            query.type = req.query.type;
        }

        const transactions = await Transaction.find(query)
            .populate('category', 'name')
            .sort({ date: -1 });

        const filename = `transactions_export_${Date.now()}`;

        if (format === 'csv') {
            const filepath = path.join(__dirname, '../tmp', `${filename}.csv`);

            // Ensure tmp directory exists
            const tmpDir = path.dirname(filepath);
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            // Format data for CSV
            const csvData = transactions.map(transaction => ({
                id: transaction._id,
                type: transaction.type,
                amount: transaction.amount,
                description: transaction.description,
                category: transaction.category?.name || 'Uncategorized',
                date: transaction.date.toISOString().split('T')[0],
                createdAt: transaction.createdAt.toISOString().split('T')[0]
            }));

            const csvWriter = createCsvWriter({
                path: filepath,
                header: [
                    { id: 'id', title: 'ID' },
                    { id: 'type', title: 'Type' },
                    { id: 'amount', title: 'Amount' },
                    { id: 'description', title: 'Description' },
                    { id: 'category', title: 'Category' },
                    { id: 'date', title: 'Date' },
                    { id: 'createdAt', title: 'Created At' }
                ]
            });

            await csvWriter.writeRecords(csvData);
            res.download(filepath, `${filename}.csv`, (err) => {
                if (err) logger.error('CSV export download failed', { error: err.message, filePath: filepath });
                // cleanup
                setTimeout(() => {
                    try { fs.unlinkSync(filepath); } catch { }
                }, 5000);
            });
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
            res.json(transactions);
        }
    } catch (err) { next(err); }
}

module.exports = { exportUsers, exportTransactions };