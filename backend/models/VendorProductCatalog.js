const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const VendorProductCatalogSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    productName: { type: String, required: true, trim: true },
    brand: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true },
    hsnCode: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    specification: { type: String, default: '' },
    price: { type: Number, default: 0, min: 0 },
    MOQ: { type: Number, default: 1, min: 1 },
    UOM: { type: String, default: 'Nos', trim: true },
    images: [{ type: String }],
    productImageUrl: { type: String, default: '' },
    attachments: [{ type: String }],
    status: { type: String, enum: ['Active', 'Inactive', 'Discontinued'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, {
    timestamps: true
});

VendorProductCatalogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('VendorProductCatalog', VendorProductCatalogSchema);
