const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ContractSchema = new mongoose.Schema({
    contractNumber: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    priceBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'PriceBook', index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['Draft', 'Active', 'Expired', 'Terminated'], default: 'Draft', index: true },
    renewalRules: { type: String, default: '' },
    lockedPrices: {
        type: Map,
        of: Number,
        default: {} // Key is productId (String), value is locked price (Number)
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ContractSchema.pre('save', function () {
    this.updatedAt = new Date();
});

ContractSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Contract', ContractSchema);
