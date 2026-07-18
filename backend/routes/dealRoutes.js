const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dealController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, ctrl.getAllDeals);
router.get('/board/:pipelineId', protect, ctrl.getDealBoard);
router.get('/sources', protect, ctrl.getSources);
router.post('/sources', protect, ctrl.createSource);
router.delete('/sources/:id', protect, ctrl.deleteSource);
router.get('/:id', protect, ctrl.getDealById);
router.post('/', protect, ctrl.createDeal);
router.put('/:id', protect, ctrl.updateDeal);
router.patch('/:id/stage', protect, ctrl.updateDealStage);
router.patch('/:id/lost', protect, ctrl.markDealLost);
router.patch('/:id/reopen', protect, ctrl.reopenDeal);
router.delete('/:id', protect, ctrl.deleteDeal);
router.post('/:id/activity', protect, ctrl.addActivity);
router.get('/:id/activities', protect, ctrl.getDealActivities);

module.exports = router;
