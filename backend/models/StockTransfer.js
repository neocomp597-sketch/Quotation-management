const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const StockTransferItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    batchNumber: { type: String, default: '' },
    qtyRequested: { type: Number, required: true, min: 1 },
    qtyDispatched: { type: Number, default: 0, min: 0 },
    qtyReceived: { type: Number, default: 0, min: 0 },
    uom: { type: String, default: 'Pcs' },
    serialNumbers: [{ type: String }]
}, { _id: true });

const StockTransferSchema = new mongoose.Schema({
    transferNumber: { type: String, required: true },
    fromWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    toWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    requestDate: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date },
    dispatchDate: { type: Date },
    receivedDate: { type: Date },
    items: [StockTransferItemSchema],
    status: {
        type: String,
        enum: ['Draft', 'Pending_Approval', 'Approved', 'Dispatched', 'Partially_Received', 'Completed', 'Rejected', 'Cancelled'],
        default: 'Pending_Approval',
        index: true
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

StockTransferSchema.index({ companyId: 1, transferNumber: 1 }, { unique: true });
StockTransferSchema.plugin(tenantPlugin);

StockTransferSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('StockTransfer', StockTransferSchema);
