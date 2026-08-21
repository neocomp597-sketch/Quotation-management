const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const StockAlertSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    alertType: {
        type: String,
        enum: ['LowStock', 'OutOfStock', 'ExpiringStock', 'Overstock', 'PendingTransfer'],
        required: true,
        index: true
    },
    severity: {
        type: String,
        enum: ['Info', 'Warning', 'Critical'],
        default: 'Warning'
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    currentValue: { type: Number, default: 0 },
    thresholdValue: { type: Number, default: 0 },
    batchNumber: { type: String, default: '' },
    expiryDate: { type: Date },
    isResolved: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now, index: true }
});

StockAlertSchema.index({ companyId: 1, productId: 1, alertType: 1, isResolved: 1 });
StockAlertSchema.plugin(tenantPlugin);

module.exports = mongoose.model('StockAlert', StockAlertSchema);
