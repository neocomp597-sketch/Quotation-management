const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// One line of a stock audit batch: an SAP B1 item in a warehouse (and bin / batch when SAP
// tracks them), its book quantity, and the physical count recorded against it.
const RESULTS = ['Pending', 'Matched', 'Short', 'Excess'];
const CONDITIONS = ['', 'Good', 'Damaged', 'Expired', 'Obsolete', 'Not Found'];
const MISMATCH_STATUSES = ['', 'Open', 'Under Review', 'Recount Requested', 'Resolved'];
const RESOLUTIONS = [
    '', 'Recount Matched', 'SAP Adjustment Posted', 'Write-off Approved', 'Data Entry Error',
    'Located Elsewhere', 'Pending Inward / Outward', 'Accepted As Is', 'Other'
];

const PersonSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, default: '' },
    email: { type: String, default: '' }
}, { _id: false });

const FollowUpSchema = new mongoose.Schema({
    note: { type: String, trim: true, required: true },
    status: { type: String, default: '' },
    by: { type: PersonSchema, default: () => ({}) },
    at: { type: Date, default: Date.now }
}, { _id: true });

const MismatchSchema = new mongoose.Schema({
    status: { type: String, enum: MISMATCH_STATUSES, default: '' },
    rootCause: { type: String, trim: true, default: '' },
    ownerEmail: { type: String, lowercase: true, trim: true, default: '' },
    resolution: { type: String, enum: RESOLUTIONS, default: '' },
    resolutionNote: { type: String, trim: true, default: '' },
    sapDocRef: { type: String, trim: true, default: '' },
    raisedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: PersonSchema, default: null },
    followUps: [FollowUpSchema]
}, { _id: false });

const StockAuditItemSchema = new mongoose.Schema({
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockAuditBatch', required: true },
    lineNo: { type: Number, default: 0 },

    itemCode: { type: String, required: true, trim: true },
    itemName: { type: String, trim: true, default: '' },
    itemGroup: { type: String, trim: true, default: '' },
    uom: { type: String, trim: true, default: '' },
    warehouseCode: { type: String, trim: true, default: '' },
    warehouseName: { type: String, trim: true, default: '' },
    binLocation: { type: String, trim: true, default: '' },
    batchNumber: { type: String, trim: true, default: '' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    // Identifies the line within the batch: item + warehouse + bin + batch/serial.
    lineKey: { type: String, required: true },

    sapQty: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    sapValue: { type: Number, default: 0 },

    countedQty: { type: Number, default: null },
    countedValue: { type: Number, default: null },
    varianceQty: { type: Number, default: null },
    varianceValue: { type: Number, default: null },
    // |varianceValue|, kept so lines can be sorted by the size of the discrepancy.
    absVarianceValue: { type: Number, default: 0 },
    result: { type: String, enum: RESULTS, default: 'Pending' },

    condition: { type: String, enum: CONDITIONS, default: '' },
    foundLocation: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    countedBy: { type: PersonSchema, default: null },
    countedAt: { type: Date, default: null },
    countRounds: { type: Number, default: 0 },

    mismatch: { type: MismatchSchema, default: () => ({}) },

    // Bumped on every change; a save sent with an older version is refused, so two people
    // counting the same line cannot silently overwrite each other.
    version: { type: Number, default: 0 }
}, { timestamps: true });

StockAuditItemSchema.index({ batchId: 1, lineKey: 1 }, { unique: true });
StockAuditItemSchema.index({ batchId: 1, lineNo: 1 });
StockAuditItemSchema.index({ batchId: 1, result: 1 });
StockAuditItemSchema.index({ batchId: 1, 'mismatch.status': 1 });

StockAuditItemSchema.plugin(tenantPlugin);

const StockAuditItem = mongoose.model('StockAuditItem', StockAuditItemSchema);
StockAuditItem.RESULTS = RESULTS;
StockAuditItem.CONDITIONS = CONDITIONS;
StockAuditItem.MISMATCH_STATUSES = MISMATCH_STATUSES;
StockAuditItem.RESOLUTIONS = RESOLUTIONS;

module.exports = StockAuditItem;
