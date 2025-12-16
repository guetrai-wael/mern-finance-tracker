/* Categories routes */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/categories.controller');
const auth = require('../middlewares/auth');
const checkSubscription = require('../middlewares/checkSubscription');
const { validateBody, validateParams, validateMultiple, sanitizeInput } = require('../middleware/validation');
const { categorySchemas, paramSchemas } = require('../schemas/validationSchemas');

router.use(auth);
router.use(checkSubscription);
router.use(sanitizeInput);

router.get('/', ctrl.listCategories);
router.post('/', validateBody(categorySchemas.create), ctrl.createCategory);
router.put('/:id', validateMultiple([
    { schema: paramSchemas.id, target: 'params' },
    { schema: categorySchemas.update, target: 'body' }
]), ctrl.updateCategory);
router.delete('/:id', validateParams(paramSchemas.id), ctrl.deleteCategory);

module.exports = router;
