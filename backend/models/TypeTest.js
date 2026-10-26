const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const TYPE_TEST_STATUSES = ['Not Started', 'In Progress', 'Valid', 'Expired', 'Renewal In Progress'];
const RENEWAL_STATUSES = ['Not Due', 'Upcoming', 'In Progress', 'Submitted', 'Renewed', 'Overdue'];
const TEST_RESULTS = ['Pending', 'Pass', 'Fail', 'Not Applicable'];
const DEFAULT_LEAD_DAYS = [180, 90, 30];

// One certificate issued by the external testing agency. The current one lives on the
// record itself; superseded ones are closed and moved into certificateHistory.
const CertificateSchema = new mongoose.Schema({
    certificateNo: { type: String, trim: true, default: '' },
    documentUrl: { type: String, trim: true, default: '' },
    testingAgency: { type: String, trim: true, default: '' },
    issueDate: { type: Date },
    testCompletionDate: { type: Date },
    validUntil: { type: Date },
    remarks: { type: String, trim: true, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closeReason: { type: String, trim: true, default: '' }
}, { _id: true });

// Reminder dates are derived from validUntil and the lead times; sentAt marks the ones
// the scheduler has already notified so each fires once per certificate.
const ReminderSchema = new mongoose.Schema({
    leadDays: { type: Number, required: true },
    remindOn: { type: Date, required: true },
    sentAt: { type: Date, default: null }
}, { _id: false });

const TypeTestSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    modelName: { type: String, trim: true, default: '' },
    testName: { type: String, trim: true, default: 'Type Test' },
    testStandard: { type: String, trim: true, default: '' },
    testingAgency: { type: String, trim: true, default: '' },
    testResult: { type: String, enum: TEST_RESULTS, default: 'Pending' },
    testStartDate: { type: Date },

    status: { type: String, enum: TYPE_TEST_STATUSES, default: 'Not Started', index: true },

    // Current certificate
    currentCertificate: { type: CertificateSchema, default: null },
    certificateHistory: { type: [CertificateSchema], default: [] },

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    backupOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    reminderLeadDays: { type: [Number], default: () => [...DEFAULT_LEAD_DAYS] },
    reminders: { type: [ReminderSchema], default: [] },
    expiryNotifiedAt: { type: Date, default: null },

    renewalStatus: { type: String, enum: RENEWAL_STATUSES, default: 'Not Due' },
    nextAction: { type: String, trim: true, default: '' },
    nextActionDate: { type: Date },

    // Discontinued products are made inactive so they stop generating reminders.
    isActive: { type: Boolean, default: true, index: true },
    inactiveReason: { type: String, trim: true, default: '' },
    inactiveAt: { type: Date },

    remarks: { type: String, trim: true, default: '' },
    activities: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        action: String,
        note: String,
        timestamp: { type: Date, default: Date.now }
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// A product / model can carry several type tests (e.g. temperature rise, short circuit).
TypeTestSchema.index({ companyId: 1, productId: 1, modelName: 1, testName: 1 }, { unique: true });
TypeTestSchema.index({ companyId: 1, 'currentCertificate.validUntil': 1 });
TypeTestSchema.index({ companyId: 1, ownerId: 1 });
TypeTestSchema.index({ isActive: 1, 'reminders.remindOn': 1 });

TypeTestSchema.plugin(tenantPlugin);

const TypeTest = mongoose.model('TypeTest', TypeTestSchema);
TypeTest.TYPE_TEST_STATUSES = TYPE_TEST_STATUSES;
TypeTest.RENEWAL_STATUSES = RENEWAL_STATUSES;
TypeTest.TEST_RESULTS = TEST_RESULTS;
TypeTest.DEFAULT_LEAD_DAYS = DEFAULT_LEAD_DAYS;

module.exports = TypeTest;
