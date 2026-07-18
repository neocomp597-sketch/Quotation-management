const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const MGRSchema = new mongoose.Schema({
    mgrType: { type: String, enum: ['MGR1', 'MGR2', 'MGR3', 'MGR4', 'MGR5'], required: true },
    code: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

// Since the combination of type and code should likely be unique
MGRSchema.index({ companyId: 1, mgrType: 1, code: 1 }, { unique: true });
MGRSchema.index({ mgrType: 1, createdAt: -1 });
MGRSchema.index({ status: 1, mgrType: 1 });

MGRSchema.plugin(tenantPlugin);

module.exports = mongoose.model('MGR', MGRSchema);
