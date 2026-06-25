const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const SalesOrderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productSnapshot: {
        productName: String,
        productCode: String,
        hsnCode: String,
        gstPercentage: Number,
        uom: String
    },
    quantity: { type: Number, required: true },
    rate: { type: Number, required: true }, // The agreed price per unit (after hierarchy calculation)
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
    selectedOptions: { type: mongoose.Schema.Types.Mixed, default: {} } // Captured configuration options
}, { _id: false });

const SalesOrderSchema = new mongoose.Schema({
    orderNumber: { type: String, required: true, index: true },
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String },
    items: [SalesOrderItemSchema],
    subtotal: { type: Number, required: true },
    totalDiscount: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    status: { type: String, enum: ['Draft', 'Confirmed', 'Processing', 'Completed', 'Cancelled'], default: 'Draft', index: true },
    orderDate: { type: Date, default: Date.now },
    deliveryDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

SalesOrderSchema.pre('save', function () {
    this.updatedAt = new Date();
});

SalesOrderSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SalesOrder', SalesOrderSchema);
