/* Budgets routes */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/budgets.controller');
const auth = require('../middlewares/auth');
const checkSubscription = require('../middlewares/checkSubscription');
const { validateBody, validateQuery, sanitizeInput } = require('../middleware/validation');
const { budgetSchemas } = require('../schemas/validationSchemas');

router.use(auth);
router.use(checkSubscription);
router.use(sanitizeInput);

router.get('/', validateQuery(budgetSchemas.get), ctrl.getBudget);
router.post('/', validateBody(budgetSchemas.upsert), ctrl.upsertBudget);

module.exports = router;