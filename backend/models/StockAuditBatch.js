const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// A stock audit batch: one physical count of SAP Business One stock. The lines live in
// StockAuditItem and every change is written to StockAuditLog.
const AUDIT_TYPES = ['Perpetual', 'Cycle Count', 'Full Physical', 'Spot Check'];
const BATCH_STATUSES = ['Draft', 'In Progress', 'Under Review', 'Completed', 'Cancelled'];

const PersonSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, default: '' },
    email: { type: String, default: '' }
}, { _id: false });

const StockAuditBatchSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    // Lower-cased name: batch names are unique per company regardless of case.
    nameKey: { type: String, required: true },
    auditType: { type: String, enum: AUDIT_TYPES, default: 'Perpetual' },
    description: { type: String, trim: true, default: '' },

    // Where the SAP B1 stock came from and as of when (the count is compared with it).
    sapReference: { type: String, trim: true, default: '' },
    sapSnapshotAt: { type: Date, default: null },
    scopeSource: { type: String, enum: ['Excel', 'Manual', 'API', ''], default: '' },

    plannedStart: { type: Date, default: null },
    plannedEnd: { type: Date, default: null },

    status: { type: String, enum: BATCH_STATUSES, default: 'Draft', index: true },
    statusReason: { type: String, trim: true, default: '' },

    createdBy: { type: PersonSchema, default: () => ({}) },
    // Access by email, so a person can be added before their portal account exists.
    viewerEmails: [{ type: String, lowercase: true, trim: true }],
    auditorEmails: [{ type: String, lowercase: true, trim: true }],

    startedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: PersonSchema, default: null },
    cancelledAt: { type: Date, default: null },

    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }
}, { timestamps: true });

StockAuditBatchSchema.index({ companyId: 1, nameKey: 1 }, { unique: true });
StockAuditBatchSchema.index({ companyId: 1, viewerEmails: 1 });
StockAuditBatchSchema.index({ companyId: 1, auditorEmails: 1 });
StockAuditBatchSchema.index({ companyId: 1, 'createdBy.userId': 1 });

// Access is granted per batch by email, so batches are not filtered by the active branch;
// branchId only records where the batch was created.
StockAuditBatchSchema.plugin(tenantPlugin, { branchScoped: false });

const StockAuditBatch = mongoose.model('StockAuditBatch', StockAuditBatchSchema);
StockAuditBatch.AUDIT_TYPES = AUDIT_TYPES;
StockAuditBatch.BATCH_STATUSES = BATCH_STATUSES;

module.exports = StockAuditBatch;
