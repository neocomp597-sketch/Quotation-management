const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const PayrollRunSchema = new mongoose.Schema({
    month: { type: String, required: true }, // e.g. "2026-06"
    status: { type: String, enum: ['draft', 'approved', 'locked'], default: 'draft' },
    calculatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lockedAt: { type: Date }
}, { timestamps: true });

PayrollRunSchema.plugin(tenantPlugin);

// Since unique month constraint is per company, we need a compound unique index on companyId and month
PayrollRunSchema.index({ companyId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('PayrollRun', PayrollRunSchema);
