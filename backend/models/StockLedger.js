const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const StockLedgerSchema = new mongoose.Schema({
    transactionNumber: { type: String, required: true },
    transactionType: {
        type: String,
        enum: [
            'STOCK_IN',
            'STOCK_OUT',
            'TRANSFER_OUT',
            'TRANSFER_IN',
            'ADJUSTMENT_ADD',
            'ADJUSTMENT_SUB',
            'RETURN_CUSTOMER',
            'RETURN_SUPPLIER'
        ],
        required: true,
        index: true
    },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    binRack: { type: String, default: '', trim: true },
    batchNumber: { type: String, default: '', trim: true },
    serialNumbers: [{ type: String, trim: true }],
    quantityDelta: { type: Number, required: true }, // Positive for inward, Negative for outward
    unitCost: { type: Number, default: 0, min: 0 },
    totalValue: { type: Number, default: 0 },
    referenceType: {
        type: String,
        enum: ['Voucher', 'PurchaseOrder', 'StockTransfer', 'StockAdjustment', 'StockCount', 'Manual'],
        default: 'Manual'
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    referenceNumber: { type: String, default: '' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: Date.now, index: true }
});

StockLedgerSchema.index({ companyId: 1, productId: 1, warehouseId: 1 });
StockLedgerSchema.index({ companyId: 1, transactionNumber: 1 }, { unique: true });
StockLedgerSchema.plugin(tenantPlugin);

module.exports = mongoose.model('StockLedger', StockLedgerSchema);
