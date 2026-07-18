const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CompetitorPriceSchema = new mongoose.Schema({
    competitorName: { type: String, required: true, trim: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    competitorPrice: { type: Number, required: true, min: 0 },
    marketPrice: { type: Number, min: 0 },
    observedDate: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

CompetitorPriceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CompetitorPrice', CompetitorPriceSchema);
