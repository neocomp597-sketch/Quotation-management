const express = require('express');
const router = express.Router();
const tenderController = require('../controllers/tenderController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/dashboard/data', protect, tenderController.getTenderDashboard);
router.post('/', protect, tenderController.createTender);
router.get('/', protect, tenderController.getAllTenders);
router.get('/:id', protect, tenderController.getTenderById);
router.put('/:id', protect, tenderController.updateTender);
router.delete('/:id', protect, tenderController.deleteTender);

module.exports = router;
