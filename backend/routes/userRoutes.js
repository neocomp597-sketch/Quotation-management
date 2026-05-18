const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Ensure you have this controller or remove if not needed yet
const { protect, admin } = require('../middlewares/authMiddleware');

// Define user routes here
router.get('/', protect, userController.getAllUsers);
router.post('/', protect, admin, userController.createUser);
router.put('/profile', protect, userController.updateUserProfile);
router.patch('/:id/role', protect, admin, userController.updateUserRole);

module.exports = router;
