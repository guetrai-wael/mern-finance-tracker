/* Export routes - admin + user routes */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/export.controller');
const auth = require('../middlewares/auth');
const checkSubscription = require('../middlewares/checkSubscription');
const admin = require('../middlewares/admin');

// All routes require authentication
router.use(auth);
router.use(checkSubscription);

// User can export their own transactions
router.get('/transactions', ctrl.exportTransactions);

// Admin-only routes
router.use(admin);
router.get('/users', ctrl.exportUsers);

module.exports = router;