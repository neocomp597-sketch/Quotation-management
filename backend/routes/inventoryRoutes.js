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
const RolePermission = require('../models/RolePermission');
const { resolvePermissions } = require('../config/authorization');

// Protect all inventory routes
router.use(protect);

/**
 * Granular action & permission verification middleware
 */
const requirePermission = (permissionKey) => {
    return async (req, res, next) => {
        try {
            // Admin & Super Admin bypass granular checks
            if (req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'superadmin') {
                return next();
            }

            const roleDoc = await RolePermission.findOne({
                companyId: req.user?.companyId,
                role: req.user?.role
            }).lean();

            const permissions = resolvePermissions(req.user?.role, roleDoc?.menuVisibility || {});

            if (permissions[permissionKey] === true) {
                return next();
            }

            return res.status(403).json({ message: `Access denied. Requires '${permissionKey}' permission.` });
        } catch (error) {
            return res.status(500).json({ message: 'Authorization error', error: error.message });
        }
    };
};

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
router.get('/warehouses', requirePermission('inventory_warehouses'), warehouseController.getWarehouses);
router.get('/warehouses/:id', requirePermission('inventory_warehouses'), warehouseController.getWarehouseById);
router.post('/warehouses', requirePermission('inventory_warehouses'), warehouseController.createWarehouse);
router.put('/warehouses/:id', requirePermission('inventory_warehouses'), warehouseController.updateWarehouse);
router.delete('/warehouses/:id', requirePermission('inventory_warehouses'), warehouseController.deleteWarehouse);

// ==========================================
// 2. Stock Matrix & Breakdown Routes (/api/inventory/stock)
// ==========================================
router.get('/stock', requirePermission('inventory_items'), stockMatrixController.getStockMatrix);
router.get('/stock/product/:productId', requirePermission('inventory_items'), stockMatrixController.getProductStockBreakdown);

// ==========================================
// 3. Stock Transfer Routes (/api/inventory/transfers)
// ==========================================
router.get('/transfers', requirePermission('inventory_transfers'), stockTransferController.getTransfers);
router.get('/transfers/:id', requirePermission('inventory_transfers'), stockTransferController.getTransferById);
router.post('/transfers', requirePermission('inventory_transfers'), stockTransferController.createTransfer);
router.post('/transfers/:id/approve', requirePermission('inventory_transfers'), requireRoles(['admin', 'manager']), stockTransferController.approveTransfer);
router.post('/transfers/:id/dispatch', requirePermission('inventory_transfers'), stockTransferController.dispatchTransfer);
router.post('/transfers/:id/receive', requirePermission('inventory_transfers'), stockTransferController.receiveTransfer);
router.post('/transfers/:id/reject', requirePermission('inventory_transfers'), requireRoles(['admin', 'manager']), stockTransferController.rejectTransfer);

// ==========================================
// 4. Stock Adjustment Routes (/api/inventory/adjustments)
// ==========================================
router.get('/adjustments', requirePermission('inventory_adjustments'), stockAdjustmentController.getAdjustments);
router.get('/adjustments/:id', requirePermission('inventory_adjustments'), stockAdjustmentController.getAdjustmentById);
router.post('/adjustments', requirePermission('inventory_adjustments'), stockAdjustmentController.createAdjustment);
router.post('/adjustments/:id/approve', requirePermission('inventory_adjustments'), requireRoles(['admin', 'manager']), stockAdjustmentController.approveAdjustment);
router.post('/adjustments/:id/reject', requirePermission('inventory_adjustments'), requireRoles(['admin', 'manager']), stockAdjustmentController.rejectAdjustment);

// ==========================================
// 5. Stock Count Audits (/api/inventory/counts)
// ==========================================
router.get('/counts', requirePermission('inventory_stock_counts'), stockCountController.getCounts);
router.get('/counts/:id', requirePermission('inventory_stock_counts'), stockCountController.getCountById);
router.post('/counts', requirePermission('inventory_stock_counts'), stockCountController.createCount);
router.put('/counts/:id/record', requirePermission('inventory_stock_counts'), stockCountController.recordCount);
router.post('/counts/:id/reconcile', requirePermission('inventory_stock_counts'), requireRoles(['admin', 'manager']), stockCountController.reconcileCount);

// ==========================================
// 6. Stock Alerts (/api/inventory/alerts)
// ==========================================
router.get('/alerts', requirePermission('inventory_alerts'), stockAlertController.getAlerts);
router.post('/alerts/:id/resolve', requirePermission('inventory_alerts'), stockAlertController.resolveAlert);

// ==========================================
// 7. Inventory Reports (/api/inventory/reports)
// ==========================================
router.get('/reports/ledger', requirePermission('inventory_reports'), inventoryReportController.getLedgerReport);
router.get('/reports/valuation', requirePermission('inventory_reports'), inventoryReportController.getValuationReport);
router.get('/reports/movement', requirePermission('inventory_reports'), inventoryReportController.getMovementReport);

module.exports = router;
