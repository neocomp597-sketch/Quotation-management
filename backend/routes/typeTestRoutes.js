const express = require('express');
const router = express.Router();
const typeTestController = require('../controllers/typeTestController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/summary/data', protect, typeTestController.getTypeTestSummary);
router.post('/', protect, typeTestController.createTypeTest);
router.get('/', protect, typeTestController.getTypeTests);
router.get('/:id', protect, typeTestController.getTypeTestById);
router.put('/:id', protect, typeTestController.updateTypeTest);
router.post('/:id/certificate', protect, typeTestController.recordCertificate);
router.post('/:id/renewal/start', protect, typeTestController.startRenewal);
router.post('/:id/progress', protect, typeTestController.recordProgress);
router.post('/:id/active', protect, typeTestController.setActive);
router.delete('/:id', protect, typeTestController.deleteTypeTest);

module.exports = router;
