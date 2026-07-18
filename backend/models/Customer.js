const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CustomerSchema = new mongoose.Schema({
    externalCode: { type: String, default: '', index: true },
        customerName: { type: String, required: true },
    companyName: { type: String, required: true },
    gstin: { type: String, default: '' },
    billingAddress: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
    },
    shippingAddress: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
    },
    mobile: String,
    email: String,
    logoUrl: String,
    defaultDiscount: Number,
    territory: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory' },
    pan: { type: String, default: '' },
    outstanding: { type: Number, default: 0 },
    industry: { type: String, default: 'Other' },
    status: { type: String, default: 'Prospect' },
    segment: { type: String, default: 'Retail' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
});

CustomerSchema.index({ mobile: 1 });
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ gstin: 1 });
CustomerSchema.index({ customerName: 1 });
CustomerSchema.index({ companyName: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ createdBy: 1, createdAt: -1 });
CustomerSchema.index({ companyId: 1, mobile: 1 });
CustomerSchema.index({ companyId: 1, email: 1 });
CustomerSchema.index({ territory: 1 });
CustomerSchema.index({ territory: 1, createdAt: -1 });
CustomerSchema.index({ owner: 1 });
CustomerSchema.index({ status: 1 });
CustomerSchema.index({ segment: 1 });
CustomerSchema.index({ industry: 1 });

CustomerSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Customer', CustomerSchema);
