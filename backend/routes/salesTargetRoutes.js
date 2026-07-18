const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/salesTargetController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/', protect, ctrl.getAllTargets);
router.post('/', protect, admin, ctrl.createTarget);
router.post('/bulk', protect, admin, ctrl.bulkCreateTargets);
router.put('/:id', protect, admin, ctrl.updateTarget);
router.delete('/:id', protect, admin, ctrl.deleteTarget);

module.exports = router;
