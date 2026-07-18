const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const VendorSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, default: '' },
        contactPerson: { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, lowercase: true, default: '' },
        address: { type: String, trim: true, default: '' },
        gstin: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

VendorSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Vendor', VendorSchema);
