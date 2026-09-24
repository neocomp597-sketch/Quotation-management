const mongoose = require('mongoose');

// Drafts may be saved incomplete, so most fields are lenient here; services/bomService.js validateBOM
// enforces the full rules before a BOM can be submitted for approval.
const tenantPlugin = require('./plugins/tenantPlugin');

const COMPONENT_TYPES = ['Raw Material', 'Bought Out', 'Sub-Assembly', 'Consumable', 'Packing Material', 'Semi-Finished', 'Service', 'Other'];
const STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Active', 'Revision Required', 'Obsolete'];
const APPROVAL_STAGES = ['Checked', 'Engineering', 'Finance', 'Management'];
// The first two match the form's two file pickers; the rest can be chosen when attaching from the view page.
const ATTACHMENT_CATEGORIES = ['Drawing / Specification', 'Reference Document', 'Datasheet', 'Engineering Document', 'Approval Document', 'Other'];

const ComponentSchema = new mongoose.Schema({
    level: { type: Number, default: 1 },
    componentCode: { type: String, trim: true, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    description: { type: String, trim: true, default: '' },
    componentType: { type: String, enum: COMPONENT_TYPES, default: 'Raw Material' },
    materialGroup: { type: String, trim: true, default: '' },
    qty: { type: Number, default: null },
    uom: { type: String, trim: true, default: '' },
    scrapPercent: { type: Number, default: 0 },
    // qty grossed up for scrap: qty x (1 + scrap% / 100)
    totalQty: { type: Number, default: 0 },
    operationNo: { type: String, trim: true, default: '' },
    mandatory: { type: Boolean, default: true },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    remarks: { type: String, trim: true, default: '' }
}, { _id: true });

const OperationSchema = new mongoose.Schema({
    operationNo: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    workCenter: { type: String, trim: true, default: '' },
    backflush: { type: Boolean, default: false },
    manualIssue: { type: Boolean, default: false },
    remarks: { type: String, trim: true, default: '' }
}, { _id: true });

const AttachmentSchema = new mongoose.Schema({
    category: { type: String, enum: ATTACHMENT_CATEGORIES, default: 'Other' },
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

// Every status change, approval and edit is appended here; it doubles as approval and revision history.
const HistorySchema = new mongoose.Schema({
    action: { type: String, required: true },
    stage: { type: String, default: '' },
    fromStatus: { type: String, default: '' },
    toStatus: { type: String, default: '' },
    remarks: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, default: '' },
    at: { type: Date, default: Date.now }
}, { _id: false });

const BOMSchema = new mongoose.Schema({
    bomNumber: { type: String, required: true },
    bomType: { type: String, trim: true, default: 'Manufacturing' },

    // A "family" is one FG + plant + alternative; each family has numbered revisions.
    familyKey: { type: String, required: true },
    fgItemCode: { type: String, required: true, trim: true },
    fgProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    fgDescription: { type: String, trim: true, default: '' },
    fgVersion: { type: String, trim: true, default: '' },
    productCategory: { type: String, trim: true, default: '' },
    // Named plantId (not branchId) so the tenant plugin does not branch-scope engineering BOMs.
    plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    plantName: { type: String, trim: true, default: '' },
    productionUnit: { type: String, trim: true, default: '' },
    alternativeBom: { type: String, trim: true, default: '' },
    bomUsage: { type: String, trim: true, default: 'Production' },
    baseQty: { type: Number, default: 1 },
    baseUom: { type: String, trim: true, default: '' },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },

    revisionNo: { type: Number, required: true, min: 1 },
    revision: { type: String, required: true },
    previousRevisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'BOM', default: null },
    revisionReason: { type: String, trim: true, default: '' },

    status: { type: String, enum: STATUSES, default: 'Draft' },
    currentStage: { type: String, enum: [...APPROVAL_STAGES, ''], default: '' },
    approvals: {
        type: [{
            stage: { type: String, enum: APPROVAL_STAGES },
            by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            byName: String,
            at: Date,
            remarks: String,
            _id: false
        }],
        default: []
    },
    submittedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },

    components: { type: [ComponentSchema], default: [] },
    operations: { type: [OperationSchema], default: [] },
    attachments: { type: [AttachmentSchema], default: [] },

    cost: {
        material: { type: Number, default: 0 },
        scrap: { type: Number, default: 0 },
        packing: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },

    remarks: { type: String, trim: true, default: '' },
    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    preparedByName: { type: String, default: '' },
    department: { type: String, trim: true, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    history: { type: [HistorySchema], default: [] }
}, { timestamps: true, optimisticConcurrency: true });

// The BOM number is shared by all revisions of one FG/plant/alternative.
BOMSchema.index({ companyId: 1, bomNumber: 1, revisionNo: 1 }, { unique: true });
BOMSchema.index({ companyId: 1, familyKey: 1, revisionNo: 1 }, { unique: true });
BOMSchema.index({ companyId: 1, fgItemCode: 1, status: 1 });
BOMSchema.index({ companyId: 1, status: 1, updatedAt: -1 });

BOMSchema.plugin(tenantPlugin);

const BOM = mongoose.model('BOM', BOMSchema);

module.exports = BOM;
module.exports.COMPONENT_TYPES = COMPONENT_TYPES;
module.exports.STATUSES = STATUSES;
module.exports.APPROVAL_STAGES = APPROVAL_STAGES;
module.exports.ATTACHMENT_CATEGORIES = ATTACHMENT_CATEGORIES;
