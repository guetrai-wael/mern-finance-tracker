/* Account routes */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/accounts.controller');
const auth = require('../middlewares/auth');
const checkSubscription = require('../middlewares/checkSubscription');
const { validateBody, validateParams, validateMultiple, sanitizeInput } = require('../middleware/validation');
const { accountSchemas, paramSchemas } = require('../schemas/validationSchemas');

router.use(auth);
router.use(checkSubscription);
router.use(sanitizeInput);

router.get('/', ctrl.listAccounts);
router.post('/', validateBody(accountSchemas.create), ctrl.createAccount);
router.get('/:id', validateParams(paramSchemas.id), ctrl.getAccount);
router.put('/:id', validateMultiple([
    { schema: paramSchemas.id, target: 'params' },
    { schema: accountSchemas.update, target: 'body' }
]), ctrl.updateAccount);
router.delete('/:id', validateParams(paramSchemas.id), ctrl.deleteAccount);
router.post('/:id/default', validateParams(paramSchemas.id), ctrl.setDefaultAccount);

module.exports = router;
