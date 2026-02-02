const express = require('express');
const router = express.Router();
const companySettingsController = require('../controllers/companySettingsController');
const { protect } = require('../middlewares/authMiddleware');

// Get company settings for logged-in user
router.get('/', protect, companySettingsController.getCompanySettings);

// Create or update company settings
router.put('/', protect, companySettingsController.updateCompanySettings);

module.exports = router;
