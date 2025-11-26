/* Transactions routes */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/transactions.controller');
const auth = require('../middlewares/auth');
const { validateBody, validateQuery, validateParams, validateMultiple, sanitizeInput } = require('../middleware/validation');
const { transactionSchemas, paramSchemas } = require('../schemas/validationSchemas');

router.use(auth);
router.use(sanitizeInput);

router.get('/', validateQuery(transactionSchemas.list), ctrl.listTransactions);
router.post('/', validateBody(transactionSchemas.create), ctrl.createTransaction);
router.get('/:id', validateParams(paramSchemas.id), ctrl.getTransaction);
router.put('/:id', validateMultiple([
    { schema: paramSchemas.id, target: 'params' },
    { schema: transactionSchemas.update, target: 'body' }
]), ctrl.updateTransaction);
router.delete('/:id', validateParams(paramSchemas.id), ctrl.deleteTransaction);

module.exports = router;
