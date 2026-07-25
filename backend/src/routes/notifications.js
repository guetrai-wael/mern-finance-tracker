/* Notification routes */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notifications.controller');
const auth = require('../middlewares/auth');
const { validateParams, sanitizeInput } = require('../middleware/validation');
const { paramSchemas } = require('../schemas/validationSchemas');

// Deliberately no checkSubscription: a user whose subscription has lapsed
// should still be able to read and clear alerts they already received.
router.use(auth);
router.use(sanitizeInput);

router.get('/', ctrl.listNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.post('/read-all', ctrl.markAllRead);
router.patch('/:id/read', validateParams(paramSchemas.id), ctrl.markRead);
router.delete('/:id', validateParams(paramSchemas.id), ctrl.deleteNotification);

module.exports = router;
