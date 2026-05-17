const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    externalCode: { type: String, default: '', index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanySettings' },
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
});

CustomerSchema.index({ mobile: 1 });
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ gstin: 1 });
CustomerSchema.index({ companyId: 1 });
CustomerSchema.index({ customerName: 1 });
CustomerSchema.index({ companyName: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ createdBy: 1, createdAt: -1 });
CustomerSchema.index({ companyId: 1, mobile: 1 });
CustomerSchema.index({ companyId: 1, email: 1 });
CustomerSchema.index({ territory: 1 });
CustomerSchema.index({ territory: 1, createdAt: -1 });

module.exports = mongoose.model('Customer', CustomerSchema);
