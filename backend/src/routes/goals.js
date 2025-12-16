/* Goals routes */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/goals.controller');
const auth = require('../middlewares/auth');
const checkSubscription = require('../middlewares/checkSubscription');
const { validateBody, validateParams, validateMultiple, sanitizeInput } = require('../middleware/validation');
const { goalSchemas, paramSchemas } = require('../schemas/validationSchemas');

router.use(auth);
router.use(checkSubscription);
router.use(sanitizeInput);

router.get('/', ctrl.listGoals);
router.post('/', validateBody(goalSchemas.create), ctrl.createGoal);
router.put('/:id', validateMultiple([
    { schema: paramSchemas.id, target: 'params' },
    { schema: goalSchemas.update, target: 'body' }
]), ctrl.updateGoal);
router.delete('/:id', validateParams(paramSchemas.id), ctrl.deleteGoal);
router.post('/:id/contribute', validateMultiple([
    { schema: paramSchemas.id, target: 'params' },
    { schema: goalSchemas.addContribution, target: 'body' }
]), ctrl.addContribution);

module.exports = router;