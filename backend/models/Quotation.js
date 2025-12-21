const mongoose = require('mongoose');

const QuotationSchema = new mongoose.Schema({
    quotationNo: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    quotationDate: { type: Date, required: true, default: Date.now },
    validTill: { type: Date, required: true },
    salespersonName: { type: String },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    paymentTerms: { type: String },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
        productSnapshot: {
            productName: String,
            productCode: String,
            hsnCode: String,
            gstPercentage: Number,
            uom: String,
            productImageUrl: String
        },
        quantity: { type: Number, required: true },
        rate: { type: Number, required: true },
        discountPercent: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        taxableAmount: { type: Number, required: true },
        gstAmount: { type: Number, required: true },
        lineTotal: { type: Number, required: true },
    }],
    subtotal: { type: Number, required: true },
    totalDiscount: { type: Number, required: true },
    gstBreakup: {
        cgst: { type: Number, default: 0 },
        sgst: { type: Number, default: 0 },
        igst: { type: Number, default: 0 },
    },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    termsTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'TermsTemplate' },
    customTerms: { type: String },
    status: { type: String, enum: ['draft', 'final'], default: 'draft' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Quotation', QuotationSchema);
