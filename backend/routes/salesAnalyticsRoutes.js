const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/salesAnalyticsController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/funnel/:pipelineId', protect, ctrl.getPipelineFunnel);
router.get('/dropoff', protect, ctrl.getStageDropoff);
router.get('/stuck', protect, ctrl.getStuckDeals);
router.get('/salesperson', protect, ctrl.getSalespersonAnalytics);
router.get('/velocity', protect, ctrl.getPipelineVelocity);
router.get('/source', protect, ctrl.getSourceAnalytics);
router.get('/activities', protect, ctrl.getAllActivities);

module.exports = router;
