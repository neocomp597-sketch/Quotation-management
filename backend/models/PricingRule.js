const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const SlabConditionSchema = new mongoose.Schema({
    minQty: { type: Number, required: true, min: 0 },
    maxQty: { type: Number, required: true, min: 0 },
    value: { type: Number, required: true }, // The rate value, discount percent, or markup percent
    type: { type: String, enum: ['price', 'discountPercent', 'markupPercent'], default: 'price' }
}, { _id: false });

const PricingRuleSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    ruleType: { 
        type: String, 
        enum: ['Quantity', 'Volume', 'Slab', 'CustomerGroup', 'Industry', 'Territory', 'DynamicMargin'], 
        required: true,
        index: true
    },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
    customerGroup: { type: String, index: true }, // 'Retail', 'Dealer', 'Distributor', 'Corporate', 'Government'
    industry: { type: String, index: true }, // 'Construction', 'Manufacturing', 'Mining', 'Agriculture'
    territoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', index: true },
    
    conditions: [SlabConditionSchema], // Used for Quantity, Volume, and Slab rules

    // For Dynamic Margin Pricing
    markupPercent: { type: Number, default: 0 }, // e.g. Cost + 10%, 15%, 20%
    
    isActive: { type: Boolean, default: true, index: true },
    validFrom: { type: Date },
    validTo: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

PricingRuleSchema.pre('save', function () {
    this.updatedAt = new Date();
});

PricingRuleSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PricingRule', PricingRuleSchema);
