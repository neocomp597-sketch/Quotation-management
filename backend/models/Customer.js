const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    customerName: { type: String, required: true },
    companyName: { type: String, required: true },
    gstin: { type: String, required: true },
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
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Customer', CustomerSchema);
