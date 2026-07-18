const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const phoneRegex = /^\+?[0-9()\-\s]{7,20}$/;

const ContactSchema = new mongoose.Schema(
    {
        contactId: { type: String, trim: true, default: '' },
        contactName: { type: String, required: true, trim: true },
        company: { type: String, trim: true, default: '' },
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
        designation: { type: String, trim: true, default: '' },
        customerType: {
            type: String,
            enum: ['', 'Customer', 'Prospect', 'Vendor', 'Partner'],
            default: ''
        },
        lastInteractionDate: { type: Date, default: null },
        notes: { type: String, trim: true, default: '' }
    },
    { timestamps: true }
);

ContactSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Contact', ContactSchema);
