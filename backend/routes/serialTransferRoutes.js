const express = require('express');
const router = express.Router();
const serialTransferController = require('../controllers/serialTransferController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const { acrossBranches } = require('../utils/serialBranchAccess');

// Serial No Transfer has its own switch in Authorization; transfers and past entries need its
// Modify (config/apiPermissions.js).
const canViewSerialTransfers = requirePermission('master_serial_transfer');

router.use(protect, canViewSerialTransfers);

router.get('/serials', serialTransferController.listSerials);
router.get('/serials/:assetId', serialTransferController.getSerial);
router.post('/serials/:assetId/transfer', serialTransferController.transferSerial);
router.post('/serials/:assetId/past-entry', serialTransferController.addPastEntry);
router.get('/history', serialTransferController.listHistory);
router.get('/activity', serialTransferController.listActivity);
router.get('/activity/export', serialTransferController.exportActivity);

// Branch Transfer works across branches; utils/serialBranchAccess.js holds its access rules.
router.get('/branch-transfers', acrossBranches, serialTransferController.listBranchTransfers);
router.post('/branch-transfers', acrossBranches, serialTransferController.createBranchTransfer);
router.get('/branch-transfers/branches', acrossBranches, serialTransferController.listTransferBranches);
router.get('/branch-transfers/serials', acrossBranches, serialTransferController.searchBranchSerials);
router.get('/branch-transfers/serials/:assetId', acrossBranches, serialTransferController.getSerialBranchHistory);

module.exports = router;
