const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/forecastController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/dashboard', protect, ctrl.getForecastDashboard);
router.get('/revenue', protect, ctrl.getRevenueForecast);
router.get('/accuracy', protect, ctrl.getForecastAccuracy);
router.get('/trends', protect, ctrl.getRevenueTrends);
router.post('/snapshot', protect, admin, ctrl.takeSnapshot);

module.exports = router;
