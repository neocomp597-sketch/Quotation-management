const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const AssetHistorySchema = new mongoose.Schema({
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    serialNumber: { type: String, required: true },
    productCode: { type: String, default: '' },
    productName: { type: String, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerCode: { type: String, default: '' },
    customerName: { type: String, default: '' },
    customerPostalCode: { type: String, default: '' },
    customerMobile: { type: String, default: '' },
    invoiceNumber: { type: String, default: '' },
    saleDate: { type: Date },
    returnDate: { type: Date },
    returnReason: { type: String, default: '' },
    location: { type: String, default: '' },
    mgr1: { type: String, default: '' },
    mgr2: { type: String, default: '' },
    mgr3: { type: String, default: '' },
    mgr4: { type: String, default: '' },
    mgr5: { type: String, default: '' },
    indicatorField: { type: String, default: '' },
    transactionType: {
        type: String,
        enum: ['SALE', 'RETURN', 'IMPORT', 'SINGLE_ENTRY', 'UPDATE'],
        default: 'SALE'
    },
    status: { type: String, default: 'SOLD' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

AssetHistorySchema.plugin(tenantPlugin);

module.exports = mongoose.model('AssetHistory', AssetHistorySchema);
