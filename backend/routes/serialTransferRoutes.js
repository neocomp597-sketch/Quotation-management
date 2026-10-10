const express = require('express');
const router = express.Router();
const serialTransferController = require('../controllers/serialTransferController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

// Serial No Transfer sits with Invoice Bulk Upload and uses the same permission.
const canManageSerials = requirePermission('master_serials');

router.use(protect, canManageSerials);

router.get('/serials', serialTransferController.listSerials);
router.get('/serials/:assetId', serialTransferController.getSerial);
router.post('/serials/:assetId/transfer', serialTransferController.transferSerial);
router.post('/serials/:assetId/past-entry', serialTransferController.addPastEntry);
router.get('/history', serialTransferController.listHistory);

module.exports = router;
