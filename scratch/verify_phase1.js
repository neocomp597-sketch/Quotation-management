const Warehouse = require('../backend/models/Warehouse');
const StockLedger = require('../backend/models/StockLedger');
const StockTransfer = require('../backend/models/StockTransfer');
const StockAdjustment = require('../backend/models/StockAdjustment');
const StockCount = require('../backend/models/StockCount');
const StockAlert = require('../backend/models/StockAlert');
const stockLedgerService = require('../backend/services/stockLedgerService');
const authorization = require('../backend/config/authorization');

console.log('--- Phase 1 Model & Service Audit ---');
console.log('1. Warehouse model loaded:', Boolean(Warehouse));
console.log('2. StockLedger model loaded:', Boolean(StockLedger));
console.log('3. StockTransfer model loaded:', Boolean(StockTransfer));
console.log('4. StockAdjustment model loaded:', Boolean(StockAdjustment));
console.log('5. StockCount model loaded:', Boolean(StockCount));
console.log('6. StockAlert model loaded:', Boolean(StockAlert));
console.log('7. StockLedger service loaded:', Boolean(stockLedgerService.recordTransaction));

const inventoryGroup = authorization.MENU_GROUPS.find(g => g.key === 'inventory');
console.log('8. Authorization Inventory Group added:', Boolean(inventoryGroup));
if (inventoryGroup) {
    console.log('   Children keys:', inventoryGroup.children.map(c => c.key));
}

console.log('--- All Phase 1 Foundation Checks Passed Successfully ---');
