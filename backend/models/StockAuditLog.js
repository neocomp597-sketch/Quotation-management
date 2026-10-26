const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// Audit trail of a stock audit batch: who changed what, from which value to which, and when.
const StockAuditLogSchema = new mongoose.Schema({
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockAuditBatch', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockAuditItem', default: null },
    itemCode: { type: String, default: '' },
    action: { type: String, required: true },
    changes: [{
        _id: false,
        field: String,
        from: mongoose.Schema.Types.Mixed,
        to: mongoose.Schema.Types.Mixed
    }],
    note: { type: String, default: '' },
    user: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, default: '' },
        email: { type: String, default: '' }
    },
    at: { type: Date, default: Date.now }
});

StockAuditLogSchema.index({ batchId: 1, at: -1 });
StockAuditLogSchema.index({ batchId: 1, itemId: 1, at: -1 });

StockAuditLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('StockAuditLog', StockAuditLogSchema);
