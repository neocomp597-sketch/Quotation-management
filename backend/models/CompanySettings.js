const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CompanySettingsSchema = new mongoose.Schema({
    // Basic Company Information
    companyName: { type: String, required: true },
    tagline: { type: String, default: '' },

    // Company Logo
    logoUrl: { type: String },

    // Dual Logo Branding & Whitelabeling
    showDualBranding: { type: Boolean, default: true },
    whitelabelAppTitle: { type: String, default: '' },
    primaryBrandColor: { type: String, default: '' },

    // Contact Information
    email: { type: String },
    phone: { type: String },
    website: { type: String },

    // Address Details
    address: {
        line1: { type: String, default: '' },
        line2: { type: String },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' },
        country: { type: String, default: 'India' }
    },

    // Tax Information
    gstin: { type: String },
    pan: { type: String },
    cin: { type: String },

    // Banking Details (for quotations/invoices)
    bankDetails: {
        bankName: { type: String },
        accountName: { type: String },
        accountNumber: { type: String },
        ifscCode: { type: String },
        branchName: { type: String }
    },

    // Authorized Signatory
    authorizedSignatory: {
        name: { type: String, default: '' },
        designation: { type: String },
        signatureImageUrl: { type: String }
    },

    // Default Terms & Conditions
    defaultTerms: { type: String },

    // Quotation prefix settings
    quotationPrefix: { type: String, default: 'ARM/QTN' },

    // User who originally configured these settings
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: { unique: true }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
CompanySettingsSchema.pre('save', async function () {
    this.updatedAt = Date.now();
});

CompanySettingsSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CompanySettings', CompanySettingsSchema);
