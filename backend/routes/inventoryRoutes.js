const express = require('express');
const router = express.Router();

const warehouseController = require('../controllers/warehouseController');
const stockMatrixController = require('../controllers/stockMatrixController');
const stockTransferController = require('../controllers/stockTransferController');
const stockAdjustmentController = require('../controllers/stockAdjustmentController');
const stockCountController = require('../controllers/stockCountController');
const stockAlertController = require('../controllers/stockAlertController');
const inventoryReportController = require('../controllers/inventoryReportController');

const { protect } = require('../middlewares/authMiddleware');

// Protect all inventory routes. Screen permissions (View/Create/Modify/Delete) are
// checked by protect against config/apiPermissions.js.
router.use(protect);

/**
 * Role restriction middleware for manager/admin approvals
 */
const requireRoles = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user?.role) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        const userRole = String(req.user.role).toLowerCase();
        const allowed = allowedRoles.map(r => String(r).toLowerCase());

        if (allowed.includes(userRole) || userRole === 'admin' || userRole === 'super_admin' || userRole === 'superadmin') {
            return next();
        }

        return res.status(403).json({ message: `Action requires one of the following roles: ${allowedRoles.join(', ')}` });
    };
};

// ==========================================
// 1. Warehouse Management Routes (/api/inventory/warehouses)
// ==========================================
router.get('/warehouses', warehouseController.getWarehouses);
router.get('/warehouses/:id', warehouseController.getWarehouseById);
router.post('/warehouses', warehouseController.createWarehouse);
router.put('/warehouses/:id', warehouseController.updateWarehouse);
router.delete('/warehouses/:id', warehouseController.deleteWarehouse);

// ==========================================
// 2. Stock Matrix & Breakdown Routes (/api/inventory/stock)
// ==========================================
router.get('/stock', stockMatrixController.getStockMatrix);
router.get('/stock/product/:productId', stockMatrixController.getProductStockBreakdown);

// ==========================================
// 3. Stock Transfer Routes (/api/inventory/transfers)
// ==========================================
router.get('/transfers', stockTransferController.getTransfers);
router.get('/transfers/:id', stockTransferController.getTransferById);
router.post('/transfers', stockTransferController.createTransfer);
router.post('/transfers/:id/approve', requireRoles(['admin', 'manager']), stockTransferController.approveTransfer);
router.post('/transfers/:id/dispatch', stockTransferController.dispatchTransfer);
router.post('/transfers/:id/receive', stockTransferController.receiveTransfer);
router.post('/transfers/:id/reject', requireRoles(['admin', 'manager']), stockTransferController.rejectTransfer);

// ==========================================
// 4. Stock Adjustment Routes (/api/inventory/adjustments)
// ==========================================
router.get('/adjustments', stockAdjustmentController.getAdjustments);
router.get('/adjustments/:id', stockAdjustmentController.getAdjustmentById);
router.post('/adjustments', stockAdjustmentController.createAdjustment);
router.post('/adjustments/:id/approve', requireRoles(['admin', 'manager']), stockAdjustmentController.approveAdjustment);
router.post('/adjustments/:id/reject', requireRoles(['admin', 'manager']), stockAdjustmentController.rejectAdjustment);

// ==========================================
// 5. Stock Count Audits (/api/inventory/counts)
// ==========================================
router.get('/counts', stockCountController.getCounts);
router.get('/counts/:id', stockCountController.getCountById);
router.post('/counts', stockCountController.createCount);
router.put('/counts/:id/record', stockCountController.recordCount);
router.post('/counts/:id/reconcile', requireRoles(['admin', 'manager']), stockCountController.reconcileCount);

// ==========================================
// 6. Stock Alerts (/api/inventory/alerts)
// ==========================================
router.get('/alerts', stockAlertController.getAlerts);
router.post('/alerts/:id/resolve', stockAlertController.resolveAlert);

// ==========================================
// 7. Inventory Reports (/api/inventory/reports)
// ==========================================
router.get('/reports/ledger', inventoryReportController.getLedgerReport);
router.get('/reports/valuation', inventoryReportController.getValuationReport);
router.get('/reports/movement', inventoryReportController.getMovementReport);

module.exports = router;
