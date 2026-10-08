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
    // Legacy: MGR 1-5 are no longer written here; reads derive them from `productId`
    // (Product Master is the source of truth, see utils/productMgr.js).
    mgr1: { type: String, default: '' },
    mgr2: { type: String, default: '' },
    mgr3: { type: String, default: '' },
    mgr4: { type: String, default: '' },
    mgr5: { type: String, default: '' },
    indicatorField: { type: String, default: '' },
    projectCode: { type: String, default: '' },
    projectName: { type: String, default: '' },
    transactionType: {
        type: String,
        enum: ['SALE', 'RETURN', 'IMPORT', 'IMPORT_RESELL', 'SINGLE_ENTRY', 'SINGLE_ENTRY_RESELL', 'UPDATE', 'TRANSFER'],
        default: 'SALE'
    },
    status: { type: String, default: 'SOLD' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// Branch that owns this record; filled from the active branch on create and used for branch scoping (see tenantPlugin).
AssetHistorySchema.add({ branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true } });
AssetHistorySchema.plugin(tenantPlugin);

module.exports = mongoose.model('AssetHistory', AssetHistorySchema);
