const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ApprovalRuleSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    triggerType: { type: String, enum: ['Discount', 'PriceOverride', 'Contract'], required: true, index: true },
    minDiscountPercent: { type: Number, default: 0 },
    maxDiscountPercent: { type: Number, default: 100 },
    approverRole: { type: String, enum: ['SalesManager', 'RegionalManager', 'Director'], required: true },
    isActive: { type: Boolean, default: true }
});

ApprovalRuleSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ApprovalRule', ApprovalRuleSchema);
