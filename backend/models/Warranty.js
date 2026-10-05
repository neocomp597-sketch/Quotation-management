const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const WarrantySchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    purchaseDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    serialNumber: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Expired'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

WarrantySchema.index({ customerId: 1, productId: 1 });
// Branch that owns this record; copied from the ticket / customer on create and used for branch scoping (see tenantPlugin).
WarrantySchema.add({ branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true } });
WarrantySchema.plugin(tenantPlugin);

module.exports = mongoose.model('Warranty', WarrantySchema);
