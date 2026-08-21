const StockLedger = require('../models/StockLedger');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const StockAlert = require('../models/StockAlert');

/**
 * Helper to ensure a default main warehouse exists for the company
 */
const getDefaultWarehouse = async (companyId, session = null) => {
    let warehouse = await Warehouse.findOne({ companyId, isDefault: true }).session(session);
    if (!warehouse) {
        warehouse = await Warehouse.findOne({ companyId }).session(session);
    }
    if (!warehouse) {
        warehouse = new Warehouse({
            companyId,
            warehouseCode: 'MAIN-01',
            warehouseName: 'Main Warehouse',
            type: 'Main Warehouse',
            isDefault: true,
            isActive: true
        });
        await warehouse.save({ session });
    }
    return warehouse;
};

/**
 * Generate sequential transaction number for StockLedger
 */
const generateTransactionNumber = async (companyId, session = null) => {
    const today = new Date();
    const year = today.getFullYear();
    const prefix = `SL-${year}`;
    
    const count = await StockLedger.countDocuments({
        companyId,
        transactionNumber: new RegExp(`^${prefix}`)
    }).session(session);

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

/**
 * Record a transaction entry into StockLedger and update cached Stock Balance projections
 * 
 * @param {Object} params
 * @param {String} params.companyId
 * @param {String} params.productId
 * @param {String} [params.warehouseId]
 * @param {String} params.transactionType - ['STOCK_IN', 'STOCK_OUT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUB', 'RETURN_CUSTOMER', 'RETURN_SUPPLIER']
 * @param {Number} params.quantityDelta - Positive for inward, Negative for outward
 * @param {Number} [params.unitCost]
 * @param {String} [params.binRack]
 * @param {String} [params.batchNumber]
 * @param {Array<String>} [params.serialNumbers]
 * @param {String} [params.referenceType] - ['Voucher', 'PurchaseOrder', 'StockTransfer', 'StockAdjustment', 'StockCount', 'Manual']
 * @param {String} [params.referenceId]
 * @param {String} [params.referenceNumber]
 * @param {String} [params.vendorId]
 * @param {String} [params.performedBy]
 * @param {String} [params.notes]
 * @param {ClientSession} [params.session] - MongoDB Session for atomic transactions
 */
const recordTransaction = async ({
    companyId,
    productId,
    warehouseId,
    transactionType,
    quantityDelta,
    unitCost = 0,
    binRack = '',
    batchNumber = '',
    serialNumbers = [],
    referenceType = 'Manual',
    referenceId = null,
    referenceNumber = '',
    vendorId = null,
    performedBy = null,
    notes = '',
    session = null
}) => {
    // 1. Resolve Warehouse
    let targetWarehouseId = warehouseId;
    if (!targetWarehouseId) {
        const defaultWh = await getDefaultWarehouse(companyId, session);
        targetWarehouseId = defaultWh._id;
    }

    // 2. Generate Transaction Number
    const transactionNumber = await generateTransactionNumber(companyId, session);

    // 3. Calculate total value
    const totalValue = Math.round(Number(quantityDelta) * Number(unitCost) * 100) / 100;

    // 4. Create Stock Ledger entry (Authoritative Immutable Truth)
    const ledgerEntry = new StockLedger({
        companyId,
        transactionNumber,
        transactionType,
        productId,
        warehouseId: targetWarehouseId,
        binRack,
        batchNumber,
        serialNumbers,
        quantityDelta: Number(quantityDelta),
        unitCost: Number(unitCost),
        totalValue,
        referenceType,
        referenceId,
        referenceNumber,
        performedBy,
        notes
    });

    await ledgerEntry.save({ session });

    // 5. Update Derived/Cached Stock Projections on Product for fast operational reads
    const product = await Product.findById(productId).session(session);
    if (product) {
        // Ensure inventory sub-object exists
        if (!product.inventory) {
            product.inventory = { currentStock: 0, reservedStock: 0, availableStock: 0 };
        }

        // Calculate new aggregated stock balance from projection
        const newCurrentStock = Math.max(0, Number(product.inventory.currentStock || 0) + Number(quantityDelta));
        const newAvailableStock = Math.max(0, newCurrentStock - Number(product.inventory.reservedStock || 0));

        product.inventory.currentStock = newCurrentStock;
        product.inventory.availableStock = newAvailableStock;

        // If vendor stock is tracked on product
        if (vendorId && Array.isArray(product.vendors)) {
            const vIdx = product.vendors.findIndex(v => v.vendorId.toString() === vendorId.toString());
            if (vIdx > -1) {
                product.vendors[vIdx].stock = Math.max(0, Number(product.vendors[vIdx].stock || 0) + Number(quantityDelta));
            } else if (quantityDelta > 0) {
                product.vendors.push({
                    vendorId,
                    price: unitCost || product.basePrice || 0,
                    stock: Number(quantityDelta),
                    isPrimary: product.vendors.length === 0,
                    lastUpdated: new Date()
                });
            }
        }

        await product.save({ session });

        // 6. Check Stock Alerts (Low stock / Out of stock)
        await evaluateStockAlerts({ companyId, product, warehouseId: targetWarehouseId, session });
    }

    return ledgerEntry;
};

/**
 * Calculate absolute stock balance for a product at a warehouse from the immutable ledger
 */
const getCalculatedStockBalance = async (companyId, productId, warehouseId = null) => {
    const match = { companyId, productId };
    if (warehouseId) {
        match.warehouseId = warehouseId;
    }

    const result = await StockLedger.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$productId',
                totalStock: { $sum: '$quantityDelta' },
                totalValuation: { $sum: '$totalValue' }
            }
        }
    ]);

    if (result && result.length > 0) {
        return {
            totalStock: Math.max(0, result[0].totalStock),
            totalValuation: Math.max(0, result[0].totalValuation)
        };
    }

    return { totalStock: 0, totalValuation: 0 };
};

/**
 * Evaluate and trigger stock alerts (Out of stock / Low stock)
 */
const evaluateStockAlerts = async ({ companyId, product, warehouseId, session = null }) => {
    const currentStock = Number(product.inventory?.currentStock || 0);
    const minStock = Number(product.minStock || 5); // Default threshold 5 if not configured

    if (currentStock === 0) {
        await StockAlert.findOneAndUpdate(
            { companyId, productId: product._id, alertType: 'OutOfStock', isResolved: false },
            {
                companyId,
                productId: product._id,
                warehouseId,
                alertType: 'OutOfStock',
                severity: 'Critical',
                title: `Out of Stock: ${product.productName}`,
                message: `Product ${product.productCode} (${product.productName}) has reached 0 available quantity.`,
                currentValue: 0,
                thresholdValue: minStock
            },
            { upsert: true, new: true, session }
        );
    } else if (currentStock <= minStock) {
        await StockAlert.findOneAndUpdate(
            { companyId, productId: product._id, alertType: 'LowStock', isResolved: false },
            {
                companyId,
                productId: product._id,
                warehouseId,
                alertType: 'LowStock',
                severity: 'Warning',
                title: `Low Stock Warning: ${product.productName}`,
                message: `Current stock (${currentStock}) is at or below minimum threshold (${minStock}).`,
                currentValue: currentStock,
                thresholdValue: minStock
            },
            { upsert: true, new: true, session }
        );
    } else {
        // Resolve active low stock alerts if stock has recovered
        await StockAlert.updateMany(
            { companyId, productId: product._id, alertType: { $in: ['LowStock', 'OutOfStock'] }, isResolved: false },
            { $set: { isResolved: true, resolvedAt: new Date() } },
            { session }
        );
    }
};

module.exports = {
    getDefaultWarehouse,
    generateTransactionNumber,
    recordTransaction,
    getCalculatedStockBalance,
    evaluateStockAlerts
};
