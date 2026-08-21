const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const StockCountItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    binRack: { type: String, default: '' },
    batchNumber: { type: String, default: '' },
    expectedQty: { type: Number, required: true },
    countedQty: { type: Number, default: 0 },
    varianceQty: { type: Number, default: 0 },
    status: { type: String, enum: ['Match', 'Discrepancy', 'Pending'], default: 'Pending' }
}, { _id: true });

const StockCountSchema = new mongoose.Schema({
    countNumber: { type: String, required: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    categoryFilter: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    scheduledDate: { type: Date, default: Date.now },
    completedDate: { type: Date },
    status: {
        type: String,
        enum: ['Scheduled', 'In_Progress', 'Pending_Review', 'Completed', 'Cancelled'],
        default: 'In_Progress',
        index: true
    },
    items: [StockCountItemSchema],
    countedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    linkedAdjustmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockAdjustment' },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

StockCountSchema.index({ companyId: 1, countNumber: 1 }, { unique: true });
StockCountSchema.plugin(tenantPlugin);

StockCountSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('StockCount', StockCountSchema);
