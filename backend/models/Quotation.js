const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const QuotationSchema = new mongoose.Schema({
    quotationNo: { type: String, required: true },
    quotationNumber: { type: String },
        customerName: { type: String },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    quotationDate: { type: Date, required: true, default: Date.now },
    validTill: { type: Date, required: true },
    salespersonName: { type: String },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    paymentTerms: { type: String },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
        vendorName: { type: String },
        vendorPrice: { type: Number, default: 0 },
        vendorStockAtSelection: { type: Number, default: 0 },
        isVendorAutoSelected: { type: Boolean, default: true },
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
        unitPrice: { type: Number },
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
    ackNo: { type: String },
    ackDate: { type: Date },
    irnNo: { type: String },
    status: { type: String, enum: ['draft', 'final', 'ordered', 'pending_approval', 'rejected'], default: 'draft' },
    convertedAt: { type: Date },
    territory: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clientRequestId: { type: String },
    createdAt: { type: Date, default: Date.now },
});

QuotationSchema.index({ quotationNumber: 1 });
QuotationSchema.index({ customerId: 1 });
QuotationSchema.index({ createdBy: 1 });
QuotationSchema.index({ createdAt: -1 });
QuotationSchema.index({ status: 1 });
QuotationSchema.index({ companyId: 1, quotationNo: 1 }, { unique: true });
QuotationSchema.index({ companyId: 1, quotationNumber: 1 });
QuotationSchema.index(
    { companyId: 1, clientRequestId: 1 },
    { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);
QuotationSchema.index({ customerName: 'text' });
QuotationSchema.index({ territory: 1 });

QuotationSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Quotation', QuotationSchema);
