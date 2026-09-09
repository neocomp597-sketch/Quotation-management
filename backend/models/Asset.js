const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const AssetSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerNameStr: { type: String, default: '' },
    customerPostalCode: { type: String, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    serialNumber: { type: String, required: true },
    status: {
        type: String,
        enum: ['IN_STOCK', 'ALLOCATED', 'SOLD', 'RETURNED', 'RETURN', 'SCRAPPED'],
        default: 'IN_STOCK'
    },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    invoiceNumber: { type: String, default: '' },
    invoiceDate: { type: Date },
    saleDate: { type: Date },
    warrantyStart: { type: Date },
    warrantyEnd: { type: Date },
    assignedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    installationDate: { type: Date, default: Date.now },
    location: { type: String, default: '' },
    mgr1: { type: String, default: '' },
    mgr2: { type: String, default: '' },
    mgr3: { type: String, default: '' },
    mgr4: { type: String, default: '' },
    mgr5: { type: String, default: '' },
    indicatorField: { type: String, default: '' },
    returnReason: { type: String, default: '' },
    returnedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

AssetSchema.index({ customerId: 1, serialNumber: 1 });
AssetSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Asset', AssetSchema);
