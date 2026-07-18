const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const voucherItemSchema = new mongoose.Schema({
    srNumber: { type: Number, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    uom: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    taxPercentage: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    serialNumbers: [
        {
            serialNumber: { type: String, required: true },
            assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true }
        }
    ]
});

const voucherSchema = new mongoose.Schema({
    voucherType: { type: String, enum: ['Invoice', 'Purchase', 'Sale Return'], required: true },
    voucherNumber: { type: String, required: true },
    date: { type: Date, required: true },
    vendorName: { type: String },
    customerName: { type: String },
    contactNumber: { type: String },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }, // Optional link to actual vendor
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    referenceVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    items: { type: [voucherItemSchema], required: true },
    totalQty: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    totalTax: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now }
});

voucherSchema.plugin(tenantPlugin);
voucherSchema.index({ companyId: 1, voucherNumber: 1 }, { unique: true });

module.exports = mongoose.model('Voucher', voucherSchema);
