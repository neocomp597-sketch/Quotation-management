const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const PriceBookSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { 
        type: String, 
        enum: ['Standard', 'Customer', 'Region', 'Dealer', 'Project', 'Contract', 'Promotional', 'Opportunity'],
        required: true,
        index: true
    },
    targetId: { type: String, default: '', index: true }, // References Customer ID, Territory ID, Site ID, Contract ID, or Deal ID depending on type
    isActive: { type: Boolean, default: true, index: true },
    validFrom: { type: Date },
    validTo: { type: Date },
    currency: { type: String, default: 'INR' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

PriceBookSchema.pre('save', function () {
    this.updatedAt = new Date();
});

PriceBookSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PriceBook', PriceBookSchema);
