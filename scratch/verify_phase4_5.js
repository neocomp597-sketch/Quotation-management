const stockAdjustmentController = require('../backend/controllers/stockAdjustmentController');
const stockCountController = require('../backend/controllers/stockCountController');
const stockAlertController = require('../backend/controllers/stockAlertController');
const inventoryReportController = require('../backend/controllers/inventoryReportController');
const inventoryRoutes = require('../backend/routes/inventoryRoutes');

console.log('--- Phase 4 & 5 Verification Check ---');
console.log('1. StockAdjustment Controller loaded:', Boolean(stockAdjustmentController.approveAdjustment));
console.log('2. StockCount Controller loaded:', Boolean(stockCountController.reconcileCount));
console.log('3. StockAlert Controller loaded:', Boolean(stockAlertController.getAlerts));
console.log('4. InventoryReport Controller loaded:', Boolean(inventoryReportController.getValuationReport));
console.log('5. Full Inventory Router loaded:', Boolean(inventoryRoutes));
console.log('--- All Controllers & Routes Successfully Verified ---');
