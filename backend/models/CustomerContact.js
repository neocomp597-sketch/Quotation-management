const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CustomerContactSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    contactName: { type: String, required: true, trim: true },
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
    mobileNo: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    isPrimary: { type: Boolean, default: false },
    status: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

CustomerContactSchema.pre('save', function () {
    this.updatedAt = new Date();
});

CustomerContactSchema.index({ companyId: 1, customerId: 1, contactName: 1 });
CustomerContactSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CustomerContact', CustomerContactSchema);
