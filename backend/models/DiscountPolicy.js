const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const DiscountPolicySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['FestiveOffer', 'NewCustomer', 'Government', 'Volume', 'Custom'], required: true },
    discountType: { type: String, enum: ['Percentage', 'Amount'], required: true },
    value: { type: Number, required: true, min: 0 },
    validFrom: { type: Date },
    validTo: { type: Date },
    stackable: { type: Boolean, default: false }, // If true, can stack with other discount policies
    customerGroups: [{ type: String }], // 'Retail', 'Dealer', 'Distributor', 'Corporate', 'Government'
    minimumOrderValue: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

DiscountPolicySchema.pre('save', function () {
    this.updatedAt = new Date();
});

DiscountPolicySchema.plugin(tenantPlugin);

module.exports = mongoose.model('DiscountPolicy', DiscountPolicySchema);
