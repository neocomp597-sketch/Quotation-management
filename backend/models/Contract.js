const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ContractSchema = new mongoose.Schema({
    contractNumber: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    priceBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'PriceBook', index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['Draft', 'Active', 'Expired', 'Terminated', 'Pending Approval', 'Approved', 'Cancelled', 'Renewed'], default: 'Draft', index: true },
    renewalRules: { type: String, default: '' },
    category: { type: String, default: 'Sales Agreement', index: true },
    value: { type: Number, default: 0 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    approvalStatus: { type: String, enum: ['Draft', 'Pending Approval', 'Approved', 'Rejected'], default: 'Draft', index: true },
    currentApprovalStep: { type: Number, default: 0 },
    renewalStatus: { type: String, enum: ['Due in 90 Days', 'Due in 60 Days', 'Due in 30 Days', 'Due in 7 Days', 'Today', 'Renewed', 'Lost'], default: 'Today', index: true },
    complianceStatus: { type: String, enum: ['Compliant', 'Action Required', 'High Risk'], default: 'Compliant', index: true },
    riskScore: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Low', index: true },
    versionNumber: { type: Number, default: 1 },
    signedCopyUrl: { type: String, default: '' },
    signatureStatus: { type: String, enum: ['Not Sent', 'Sent', 'Viewed', 'Signed', 'Rejected'], default: 'Not Sent', index: true },
    lockedPrices: {
        type: Map,
        of: Number,
        default: {} // Key is productId (String), value is locked price (Number)
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ContractSchema.pre('save', function () {
    this.updatedAt = new Date();
});

ContractSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Contract', ContractSchema);
