const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const TenderSchema = new mongoose.Schema({
    tenderNo: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Submitted', 'Won', 'Lost', 'Pending Approval'],
        default: 'Active',
        index: true
    },
    value: {
        type: Number,
        required: true,
        default: 0
    },
    submissionDate: {
        type: Date
    },
    deadlineDate: {
        type: Date,
        required: true
    },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    description: {
        type: String,
        trim: true
    },
    activities: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        action: String,
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Scoped unique index per company
TenderSchema.index({ companyId: 1, tenderNo: 1 }, { unique: true });
TenderSchema.index({ companyId: 1, status: 1 });
TenderSchema.index({ companyId: 1, customerId: 1 });
TenderSchema.index({ companyId: 1, ownerId: 1 });

TenderSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Tender', TenderSchema);
