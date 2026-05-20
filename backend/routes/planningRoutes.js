const express = require('express');
const router = express.Router();
const planningController = require('../controllers/planningController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, planningController.createEntry);
router.get('/', protect, planningController.getAllEntries);
router.get('/debug', planningController.getDebugStats);
router.get('/filters', protect, planningController.getFilters);
router.get('/mgr-report', protect, planningController.getMGRReport);
router.put('/:id', protect, planningController.updateEntry);
router.delete('/:id', protect, planningController.deleteEntry);

module.exports = router;
