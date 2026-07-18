const express = require('express');
const router = express.Router();
const authorizationController = require('../controllers/authorizationController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/me', protect, authorizationController.getMyPermissions);
router.get('/', protect, admin, authorizationController.getAuthorizationMatrix);
router.post('/initialize', protect, admin, authorizationController.initializeDefaults);

// Custom role CRUD
router.post('/roles', protect, admin, authorizationController.createRole);
router.patch('/roles/:role', protect, admin, authorizationController.updateRoleMeta);
router.delete('/roles/:role', protect, admin, authorizationController.deleteRole);

// Permissions update (must be AFTER /roles to avoid /:role swallowing POST /roles)
router.put('/:role', protect, admin, authorizationController.updateRolePermissions);

module.exports = router;
