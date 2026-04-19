const express = require('express');
const router = express.Router();
const authorizationController = require('../controllers/authorizationController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/me', protect, authorizationController.getMyPermissions);
router.get('/', protect, admin, authorizationController.getAuthorizationMatrix);
router.put('/:role', protect, admin, authorizationController.updateRolePermissions);

module.exports = router;
