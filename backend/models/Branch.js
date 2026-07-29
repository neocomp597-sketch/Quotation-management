const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const BranchSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    branchPrefix: { 
        type: String, 
        required: true, 
        trim: true, 
        uppercase: true,
        minlength: 2,
        maxlength: 5
    },
    address: { type: String, default: '' },
    country: { type: String, default: 'India', trim: true },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    stateShortCode: { type: String, uppercase: true, default: '' },
    countryDialCode: { type: String, default: '+91', trim: true },
    pincode: { type: String, default: '' },
    contactNo: { type: String, default: '' },
    email: { type: String, default: '' },
    gstNo: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    managerName: { type: String, default: '' },
    startEmployeeSeq: { type: Number, default: 1001 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

BranchSchema.pre('save', function() {
    this.updatedAt = new Date();
});

BranchSchema.index({ companyId: 1, code: 1 }, { unique: true });
BranchSchema.index({ companyId: 1, branchPrefix: 1 }, { unique: true });

BranchSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Branch', BranchSchema);
