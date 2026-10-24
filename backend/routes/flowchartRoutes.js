const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { enforceApiPermission } = require('../middlewares/permissionMiddleware');
const flowchartController = require('../controllers/flowchartController');

// Screen permissions (View/Create/Modify/Delete), see config/apiPermissions.js
router.use(auth, enforceApiPermission);

router.get('/', flowchartController.getAll);
router.post('/generate', flowchartController.generate);
router.post('/import', flowchartController.importJson);
router.get('/:id', flowchartController.getById);
router.post('/', flowchartController.create);
router.put('/:id', flowchartController.update);
router.delete('/:id', flowchartController.delete);
router.get('/:id/versions', flowchartController.getVersions);
router.post('/:id/restore/:versionId', flowchartController.restoreVersion);

module.exports = router;
