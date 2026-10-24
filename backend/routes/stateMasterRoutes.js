const express = require('express');
const router = express.Router();
const stateMasterController = require('../controllers/stateMasterController');
const auth = require('../middlewares/auth');
const { enforceApiPermission } = require('../middlewares/permissionMiddleware');

// Screen permissions (View/Create/Modify/Delete), see config/apiPermissions.js
router.use(auth, enforceApiPermission);

router.get('/', stateMasterController.getAll);
router.post('/', stateMasterController.create);
router.put('/:id', stateMasterController.update);
router.delete('/:id', stateMasterController.delete);

module.exports = router;
