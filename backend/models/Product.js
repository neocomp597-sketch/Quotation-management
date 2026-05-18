const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ProductVendorSchema = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
        price: { type: Number, required: true, min: 0.01 },
        stock: { type: Number, required: true, min: 0 },
        isPrimary: { type: Boolean, default: false },
        lastUpdated: { type: Date, default: Date.now }
    },
    { _id: false }
);

const ProductSchema = new mongoose.Schema({
    productCode: { type: String, required: true },
        productName: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    hsnCode: { type: String, required: true },
    gstPercentage: { type: Number, required: true },
    basePrice: { type: Number, required: true },
    mrp: { type: Number, required: true },
    uom: { type: String, required: true },
    productImageUrl: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    mgr1: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr2: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr3: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr4: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr5: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    attributes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attribute' }],
    vendors: { type: [ProductVendorSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

ProductSchema.index({ productName: 1 });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ companyId: 1 });
ProductSchema.index({ updatedAt: -1 });
ProductSchema.index({ status: 1, updatedAt: -1 });
ProductSchema.index({ mgr1: 1, updatedAt: -1 });
ProductSchema.index({ mgr2: 1, updatedAt: -1 });
ProductSchema.index({ productName: 'text', hsnCode: 'text' });
ProductSchema.index({ companyId: 1, productCode: 1 }, { unique: true });

ProductSchema.path('vendors').validate(function (vendors) {
    if (!Array.isArray(vendors) || vendors.length === 0) return true;

    const vendorIds = vendors.map(v => String(v.vendorId));
    const uniqueVendorIds = new Set(vendorIds);
    if (uniqueVendorIds.size !== vendorIds.length) {
        return false;
    }

    const primaryCount = vendors.filter(v => v.isPrimary).length;
    if (primaryCount > 1) {
        return false;
    }

    return true;
}, 'Vendors must be unique and only one vendor can be primary');

ProductSchema.pre('save', function () {
    this.updatedAt = new Date();
});

ProductSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Product', ProductSchema);
