/* Auth routes: /api/auth */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { validateBody, sanitizeInput, checkValidationRateLimit } = require('../middleware/validation');
const { authSchemas } = require('../schemas/validationSchemas');
const auth = require('../middlewares/auth');

// Apply sanitization and rate limiting to all auth routes
router.use(sanitizeInput);
router.use(checkValidationRateLimit);

router.post('/signup', validateBody(authSchemas.signup), controller.signup);
router.post('/login', validateBody(authSchemas.login), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', auth, controller.me);
router.put('/profile', auth, validateBody(authSchemas.updateProfile), controller.updateProfile);
router.put('/password', auth, validateBody(authSchemas.changePassword), controller.changePassword);

module.exports = router;
