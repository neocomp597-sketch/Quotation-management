const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CustomerSchema = new mongoose.Schema({
    // ===== 1. CUSTOMER CODE - Main Field for Import/Export/Edit =====
    externalCode: { 
        type: String, 
        required: true, // Ata required kela
        trim: true,
        uppercase: true,
        index: true 
    },
    // Alias for frontend compatibility - customerCode mhanje externalCode ch
    customerCode: {
        type: String,
        trim: true,
        uppercase: true,
    },
    customerName: { type: String, required: true },
    companyName: { type: String, required: true },
    gstin: { type: String, default: '' },
    billingAddress: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String, // DB madhe rahil, fakt Upload/Add screen varun kadhaycha
    },
    shippingAddress: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
    },
    mobile: String,
    email: String,
    logoUrl: String,
    defaultDiscount: Number,
    territory: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory' },
    pan: { type: String, default: '' },
    outstanding: { type: Number, default: 0 },
    industry: { type: String, default: 'Other' },
    status: { type: String, default: 'Prospect' },
    segment: { type: String, default: 'Retail' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
});

// Auto-sync customerCode with externalCode
CustomerSchema.pre('save', function(next) {
    if (this.externalCode && !this.customerCode) {
        this.customerCode = this.externalCode;
    }
    if (this.customerCode && !this.externalCode) {
        this.externalCode = this.customerCode;
    }
    // Both uppercase trim
    if(this.externalCode) this.externalCode = this.externalCode.trim().toUpperCase();
    if(this.customerCode) this.customerCode = this.customerCode.trim().toUpperCase();
    next();
});

CustomerSchema.index({ mobile: 1 });
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ gstin: 1 });
CustomerSchema.index({ customerName: 1 });
CustomerSchema.index({ companyName: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ createdBy: 1, createdAt: -1 });
CustomerSchema.index({ companyId: 1, mobile: 1 });
CustomerSchema.index({ companyId: 1, email: 1 });
CustomerSchema.index({ territory: 1 });
CustomerSchema.index({ territory: 1, createdAt: -1 });
CustomerSchema.index({ owner: 1 });
CustomerSchema.index({ status: 1 });
CustomerSchema.index({ segment: 1 });
CustomerSchema.index({ industry: 1 });
CustomerSchema.index({ externalCode: 1, companyId: 1 }, { unique: true, sparse: true }); // Customer Code unique per company

CustomerSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Customer', CustomerSchema);
