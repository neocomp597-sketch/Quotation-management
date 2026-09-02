const mongoose = require('mongoose');

const RcaWhySchema = new mongoose.Schema({
    whyNo: { type: Number, required: true },
    analysis: { type: String, default: '' }
}, { _id: false });

const CapaSchema = new mongoose.Schema({
    actionType: { type: String, default: 'Corrective' },
    action: { type: String, default: '' },
    responsiblePerson: { type: String, default: '' },
    targetDate: { type: Date, default: null },
    status: { type: String, enum: ['Open', 'In Progress', 'Completed'], default: 'Open' }
}, { _id: false });

const CSMRcaReportSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: false },
    rcaNumber: { type: String, required: true },
    date: { type: Date, default: Date.now },
    department: { type: String, default: 'Quality' },
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    status: { type: String, enum: ['Open', 'In Progress', 'Closed', 'Resolved'], default: 'Open' },
    problemStatement: { type: String, default: '' },
    impact: { type: String, default: '' },
    fiveWhys: {
        type: [RcaWhySchema],
        default: [
            { whyNo: 1, analysis: '' },
            { whyNo: 2, analysis: '' },
            { whyNo: 3, analysis: '' },
            { whyNo: 4, analysis: '' },
            { whyNo: 5, analysis: '' }
        ]
    },
    category: { type: String, default: 'Man / People' },
    rootCause: { type: String, default: '' },
    capaActions: {
        type: [CapaSchema],
        default: [
            { actionType: 'Corrective', action: '', responsiblePerson: '', targetDate: null, status: 'Open' },
            { actionType: 'Preventive', action: '', responsiblePerson: '', targetDate: null, status: 'Open' }
        ]
    },
    verificationDate: { type: Date, default: null },
    effectiveness: { type: String, enum: ['Effective', 'Partially Effective', 'Not Effective'], default: 'Effective' },
    verificationRemarks: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

CSMRcaReportSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('CSMRcaReport', CSMRcaReportSchema);
