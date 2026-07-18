const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const AuditLogSchema = new mongoose.Schema({
    action: { type: String, required: true, index: true }, // e.g. 'PRICE_CHANGE', 'OVERRIDE_APPROVED', 'CONTRACT_LOCKED'
    entityType: { type: String, required: true, index: true }, // e.g. 'Product', 'PriceBook', 'Quotation'
    entityId: { type: mongoose.Schema.Types.ObjectId },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
    reason: { type: String }
});

AuditLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
