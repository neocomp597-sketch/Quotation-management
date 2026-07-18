const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const PayrollAuditLogSchema = new mongoose.Schema({
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorEmail: { type: String, required: true },
    action: { type: String, required: true }, // e.g. "EMPLOYEE_CREATED", "STRUCTURE_UPDATED", "RUN_LOCKED"
    details: { type: String, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetType: { type: String }
}, { timestamps: true });

PayrollAuditLogSchema.plugin(tenantPlugin);

// Index for query sorting/filtering
PayrollAuditLogSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('PayrollAuditLog', PayrollAuditLogSchema);
