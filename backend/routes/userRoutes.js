const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Ensure you have this controller or remove if not needed yet
const { protect, admin } = require('../middlewares/authMiddleware');

// Define user routes here
// For example:
// router.get('/', protect, admin, userController.getAllUsers);
router.put('/profile', protect, userController.updateUserProfile);

module.exports = router;
