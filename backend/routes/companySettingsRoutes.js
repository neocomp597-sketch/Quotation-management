const express = require('express');
const router = express.Router();
const companySettingsController = require('../controllers/companySettingsController');
const { protect } = require('../middlewares/authMiddleware');

// Get company settings for logged-in user
router.get('/', protect, companySettingsController.getCompanySettings);

// Create or update company settings
router.put('/', protect, companySettingsController.updateCompanySettings);

// Just the two logos printed on the RCA sheet
router.put('/rca-logos', protect, companySettingsController.updateRcaLogos);

module.exports = router;
