const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const phoneRegex = /^\+?[0-9()\-\s]{7,20}$/;

const ContactSchema = new mongoose.Schema(
    {
        contactId: { type: String, trim: true, default: '' },
        contactName: { type: String, required: true, trim: true },
        firstName: { type: String, trim: true, default: '' },
        lastName: { type: String, trim: true, default: '' },
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
        department: { type: String, trim: true, default: '' },
        industry: { type: String, trim: true, default: '' },
        gstin: {
            type: String,
            trim: true,
            default: '',
            validate: {
                validator: function (val) {
                    if (!val) return true;
                    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val.toUpperCase());
                },
                message: 'Invalid GSTIN format'
            }
        },
        website: { type: String, trim: true, default: '' },
        alternatePhone: { type: String, trim: true, default: '' },
        whatsappNumber: { type: String, trim: true, default: '' },
        alternateEmail: {
            type: String,
            trim: true,
            lowercase: true,
            default: '',
            validate: {
                validator: function (value) {
                    if (!value) return true;
                    return /^\S+@\S+\.\S+$/.test(value);
                },
                message: 'Invalid alternate email format'
            }
        },
        officePhone: { type: String, trim: true, default: '' },
        dob: {
            type: Date,
            default: null,
            validate: {
                validator: function (val) {
                    if (!val) return true;
                    return new Date(val) <= new Date();
                },
                message: 'Date of Birth cannot be in the future'
            }
        },
        anniversaryDate: {
            type: Date,
            default: null,
            validate: {
                validator: function (val) {
                    if (!val) return true;
                    return new Date(val) <= new Date();
                },
                message: 'Anniversary Date cannot be in the future'
            }
        },
        bloodGroup: { type: String, trim: true, default: '' },
        gender: { type: String, enum: ['', 'Male', 'Female', 'Other'], default: '' },
        maritalStatus: { type: String, enum: ['', 'Single', 'Married', 'Divorced', 'Widowed'], default: '' },
        customerType: {
            type: String,
            enum: ['', 'Customer', 'Prospect', 'Vendor', 'Partner'],
            default: ''
        },
        country: { type: String, trim: true, default: 'India' },
        state: { type: String, trim: true, default: '' },
        city: { type: String, trim: true, default: '' },
        pincode: {
            type: String,
            trim: true,
            default: '',
            validate: {
                validator: function (val) {
                    if (!val) return true;
                    return /^\d{6}$/.test(val);
                },
                message: 'PIN Code must be 6 numeric digits'
            }
        },
        addressLine1: { type: String, trim: true, default: '' },
        addressLine2: { type: String, trim: true, default: '' },
        lastInteractionDate: { type: Date, default: null },
        notes: { type: String, trim: true, default: '' }
    },
    { timestamps: true }
);

ContactSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Contact', ContactSchema);
