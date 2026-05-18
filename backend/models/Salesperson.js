const mongoose = require('mongoose');

const SalespersonSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String },
    mobile: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now },
});

SalespersonSchema.index({ status: 1, name: 1 });

const tenantPlugin = require('./plugins/tenantPlugin');
SalespersonSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Salesperson', SalespersonSchema);
