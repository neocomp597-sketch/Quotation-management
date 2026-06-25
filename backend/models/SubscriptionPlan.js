const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const SubscriptionPlanSchema = new mongoose.Schema({
    planName: { type: String, required: true, trim: true },
    billingCycle: { type: String, enum: ['Monthly', 'Quarterly', 'Yearly', 'UsageBased'], required: true },
    price: { type: Number, required: true, min: 0 },
    setupFee: { type: Number, default: 0 },
    renewalPrice: { type: Number },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

SubscriptionPlanSchema.pre('save', function () {
    this.updatedAt = new Date();
});

SubscriptionPlanSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
