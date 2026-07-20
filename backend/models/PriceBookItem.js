const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const PriceBookItemSchema = new mongoose.Schema({
    priceBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'PriceBook', required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    basePrice: { type: Number, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

PriceBookItemSchema.index({ priceBookId: 1, productId: 1 }, { unique: true });

PriceBookItemSchema.pre('save', function () {
    this.updatedAt = new Date();
});

PriceBookItemSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PriceBookItem', PriceBookItemSchema);
