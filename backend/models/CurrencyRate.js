const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CurrencyRateSchema = new mongoose.Schema({
    fromCurrency: { type: String, required: true, default: 'INR' },
    toCurrency: { type: String, required: true }, // e.g. 'USD', 'AED'
    rate: { type: Number, required: true },
    effectiveDate: { type: Date, default: Date.now, index: true },
    createdAt: { type: Date, default: Date.now }
});

CurrencyRateSchema.index({ fromCurrency: 1, toCurrency: 1, effectiveDate: -1 });

CurrencyRateSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CurrencyRate', CurrencyRateSchema);
