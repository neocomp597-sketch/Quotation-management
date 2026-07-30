const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const flowchartController = require('../controllers/flowchartController');

router.get('/', auth, flowchartController.getAll);
router.post('/generate', auth, flowchartController.generate);
router.post('/import', auth, flowchartController.importJson);
router.get('/:id', auth, flowchartController.getById);
router.post('/', auth, flowchartController.create);
router.put('/:id', auth, flowchartController.update);
router.delete('/:id', auth, flowchartController.delete);
router.get('/:id/versions', auth, flowchartController.getVersions);
router.post('/:id/restore/:versionId', auth, flowchartController.restoreVersion);

module.exports = router;
