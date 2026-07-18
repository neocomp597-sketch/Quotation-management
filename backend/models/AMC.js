const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const AMCSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    contractNo: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    visitsAllowed: { type: Number, default: 4 },
    visitsUsed: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Expired'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

AMCSchema.index({ customerId: 1, status: 1 });
AMCSchema.plugin(tenantPlugin);

module.exports = mongoose.model('AMC', AMCSchema);
