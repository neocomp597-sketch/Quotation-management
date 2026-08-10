const express = require('express');
const router = express.Router();
const landingPlanController = require('../controllers/landingPlanController');

// Public route to view plans (used by landing page)
router.get('/', landingPlanController.getLandingPlans);

// Admin routes to save/update, delete, or seed plans
router.post('/', landingPlanController.saveLandingPlan);
router.delete('/:tabKey', landingPlanController.deleteLandingPlan);
router.post('/seed', landingPlanController.seedLandingPlans);

module.exports = router;
