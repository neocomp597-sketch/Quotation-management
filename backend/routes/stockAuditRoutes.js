const express = require('express');
const router = express.Router();
const stockAuditController = require('../controllers/stockAuditController');
const { protect } = require('../middlewares/authMiddleware');

// Every route checks access itself: creating needs the 'inventory_sap_audit' permission, and a
// batch is open to its owner, admins, and the auditors / viewers named on it.
router.use(protect);

router.get('/meta', stockAuditController.getMeta);
router.get('/assigned-count', stockAuditController.getAssignedCount);
router.get('/name-check', stockAuditController.checkName);
router.get('/users', stockAuditController.searchUsers);

router.get('/', stockAuditController.getBatches);
router.post('/', stockAuditController.createBatch);
router.get('/:id', stockAuditController.getBatch);
router.put('/:id', stockAuditController.updateBatch);
router.delete('/:id', stockAuditController.deleteBatch);
router.post('/:id/status', stockAuditController.changeStatus);
router.get('/:id/access', stockAuditController.getAccess);
router.put('/:id/access', stockAuditController.updateAccess);
router.get('/:id/dashboard', stockAuditController.getDashboard);
router.get('/:id/logs', stockAuditController.getLogs);
router.get('/:id/export', stockAuditController.exportBatch);

router.get('/:id/items', stockAuditController.getItems);
router.post('/:id/items', stockAuditController.addItem);
router.post('/:id/items/import', stockAuditController.importItems);
router.delete('/:id/items/:itemId', stockAuditController.deleteItem);
router.put('/:id/items/:itemId/count', stockAuditController.recordCount);
router.put('/:id/items/:itemId/mismatch', stockAuditController.updateMismatch);

module.exports = router;
