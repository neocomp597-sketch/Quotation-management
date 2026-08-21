const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const StockAdjustmentItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    batchNumber: { type: String, default: '' },
    binRack: { type: String, default: '' },
    systemQty: { type: Number, required: true },
    actualQty: { type: Number, required: true },
    varianceQty: { type: Number, required: true }, // positive (surplus) or negative (deficit)
    unitCost: { type: Number, default: 0 },
    totalValueImpact: { type: Number, default: 0 },
    reason: { type: String, required: true }
}, { _id: true });

const StockAdjustmentSchema = new mongoose.Schema({
    adjustmentNumber: { type: String, required: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    adjustmentType: {
        type: String,
        enum: ['Damage', 'Loss', 'Expiry', 'Physical_Variance', 'System_Correction'],
        required: true
    },
    items: [StockAdjustmentItemSchema],
    status: {
        type: String,
        enum: ['Draft', 'Pending_Approval', 'Approved', 'Rejected'],
        default: 'Pending_Approval',
        index: true
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvalDate: { type: Date },
    rejectionReason: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

StockAdjustmentSchema.index({ companyId: 1, adjustmentNumber: 1 }, { unique: true });
StockAdjustmentSchema.plugin(tenantPlugin);

StockAdjustmentSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('StockAdjustment', StockAdjustmentSchema);
