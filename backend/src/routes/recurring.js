/* Recurring transaction routes */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/recurring.controller');
const auth = require('../middlewares/auth');
const checkSubscription = require('../middlewares/checkSubscription');
const { validateBody, validateParams, validateMultiple, sanitizeInput } = require('../middleware/validation');
const { recurringSchemas, paramSchemas } = require('../schemas/validationSchemas');

router.use(auth);
router.use(checkSubscription);
router.use(sanitizeInput);

router.get('/', ctrl.listRecurring);
router.post('/', validateBody(recurringSchemas.create), ctrl.createRecurring);
router.put('/:id', validateMultiple([
    { schema: paramSchemas.id, target: 'params' },
    { schema: recurringSchemas.update, target: 'body' }
]), ctrl.updateRecurring);
router.delete('/:id', validateParams(paramSchemas.id), ctrl.deleteRecurring);
router.delete('/:id/generated', validateParams(paramSchemas.id), ctrl.undoGenerated);

module.exports = router;
