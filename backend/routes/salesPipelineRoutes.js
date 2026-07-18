const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/salesPipelineController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/', protect, ctrl.getAllPipelines);
router.get('/:id', protect, ctrl.getPipelineById);
router.post('/', protect, admin, ctrl.createPipeline);
router.put('/:id', protect, admin, ctrl.updatePipeline);
router.delete('/:id', protect, admin, ctrl.deletePipeline);
router.post('/seed-defaults', protect, ctrl.seedDefaults);

module.exports = router;
