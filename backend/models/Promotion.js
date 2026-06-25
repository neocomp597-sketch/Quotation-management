const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const PromotionSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, unique: true, sparse: true, trim: true }, // e.g. Coupon Codes
    promotionType: { type: String, enum: ['Coupon', 'BOGO', 'BundleOffer', 'Seasonal'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    bundles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], // Refers to bundle type products
    customers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
    usageLimit: { type: Number },
    usageCount: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

PromotionSchema.pre('save', function () {
    this.updatedAt = new Date();
});

PromotionSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Promotion', PromotionSchema);
