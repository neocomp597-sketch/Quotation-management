const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/summary', protect, analyticsController.getDashboardSummary);
router.get('/stages', protect, analyticsController.getStageDistribution);
router.get('/trends', protect, analyticsController.getTrends);
router.get('/followups', protect, analyticsController.getFollowUpIntelligence);
router.get('/vendors', protect, analyticsController.getVendorIntelligence);
router.get('/products', protect, analyticsController.getProductIntelligence);
router.get('/users', protect, analyticsController.getUserPerformance);
router.get('/probability', protect, analyticsController.getProbabilityIntelligence);
router.get('/health', protect, analyticsController.getHealthScores);
router.get('/export', protect, analyticsController.exportReport);

module.exports = router;
