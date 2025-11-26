/* User management routes - admin only + user profile routes */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/users.controller');
const settingsCtrl = require('../controllers/settings.controller');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');
const { validateBody, validateParams, validateMultiple, sanitizeInput } = require('../middleware/validation');
const { userSchemas, paramSchemas, authSchemas } = require('../schemas/validationSchemas');

// All routes require authentication
router.use(auth);
router.use(sanitizeInput);

// User profile routes (accessible by the user themselves)
router.get('/profile', settingsCtrl.getProfile);
router.put('/profile', validateBody(authSchemas.updateProfile), settingsCtrl.updateProfile);
router.put('/change-password', validateBody(authSchemas.changePassword), settingsCtrl.changePassword);
router.get('/settings', settingsCtrl.getUserSettings);
router.put('/settings', settingsCtrl.updateUserSettings);
router.delete('/profile', settingsCtrl.deleteAccount);

// Admin-only routes
router.use(admin);
router.get('/', ctrl.listUsers);
router.get('/:id', validateParams(paramSchemas.id), ctrl.getUser);
router.put('/:id', validateMultiple([
    { schema: paramSchemas.id, target: 'params' },
    { schema: userSchemas.update, target: 'body' }
]), ctrl.updateUser);
router.delete('/:id', validateParams(paramSchemas.id), ctrl.deleteUser);

module.exports = router;
