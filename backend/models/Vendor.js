const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const phoneRegex = /^\+?[0-9()\-\s]{7,20}$/;

const VendorSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        contactPerson: { type: String, trim: true, default: '' },
        phone: {
            type: String,
            trim: true,
            default: '',
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    return phoneRegex.test(value);
                },
                message: 'Invalid phone number format'
            }
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: '',
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    return /^\S+@\S+\.\S+$/.test(value);
                },
                message: 'Invalid email format'
            }
        },
        address: { type: String, trim: true, default: '' },
        gstin: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

VendorSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Vendor', VendorSchema);
