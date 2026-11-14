const express = require('express');
const router = express.Router();
const authorizationController = require('../controllers/authorizationController');
const { protect } = require('../middlewares/authMiddleware');
// Administrators, and users an administrator gave the Authorization screen (with limits).
const { authorizationManager, administratorOnly, guardDelegateRole } = require('../middlewares/authorizationAccess');

router.get('/me', protect, authorizationController.getMyPermissions);
router.get('/', protect, authorizationManager, authorizationController.getAuthorizationMatrix);
router.post('/initialize', protect, authorizationManager, administratorOnly, authorizationController.initializeDefaults);

// Custom role CRUD
router.post('/roles', protect, authorizationManager, authorizationController.createRole);
router.patch('/roles/:role', protect, authorizationManager, guardDelegateRole, authorizationController.updateRoleMeta);
router.delete('/roles/:role', protect, authorizationManager, guardDelegateRole, authorizationController.deleteRole);

// Permissions update (must be AFTER /roles to avoid /:role swallowing POST /roles)
router.put('/:role', protect, authorizationManager, guardDelegateRole, authorizationController.updateRolePermissions);

module.exports = router;
