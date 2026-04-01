const mongoose = require('mongoose');

const voucherItemSchema = new mongoose.Schema({
    srNumber: { type: Number, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    uom: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    taxPercentage: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 }
});

const voucherSchema = new mongoose.Schema({
    voucherType: { type: String, enum: ['Purchase', 'Sale Return'], required: true },
    voucherNumber: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    vendorName: { type: String, required: true },
    contactNumber: { type: String },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }, // Optional link to actual vendor
    items: { type: [voucherItemSchema], required: true },
    totalQty: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    totalTax: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Voucher', voucherSchema);
