const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// One spreadsheet row of an ImportJob, with its own outcome:
//   ready      - passes every check and will be imported
//   attention  - has issues the user has to fix (missing required value, bad number, duplicate...)
//   blank      - every mapped cell is empty; ignored, not counted as a failure
//   excluded   - the user chose to skip it
//   importing  - being written right now; recordId is reserved before the write so an
//                interrupted import can be reconciled without creating duplicates
//   imported   - saved; recordId is the created or updated record
//   failed     - passed the checks but the database refused it; retried on the next import
const ROW_STATUSES = ['ready', 'attention', 'blank', 'excluded', 'importing', 'imported', 'failed'];

const IssueSchema = new mongoose.Schema({
    field: { type: String, default: '' },
    // Stable code (REQUIRED, INVALID_NUMBER, DUPLICATE_IN_FILE...) so the screen can format it.
    code: { type: String, required: true },
    message: { type: String, required: true },
    hint: { type: String, default: '' }
}, { _id: false });

const ImportJobRowSchema = new mongoose.Schema({
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportJob', required: true },
    // The row number the user sees in Excel.
    rowNumber: { type: Number, required: true },
    // Non-blank cells of the original row, keyed by column letter.
    values: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Corrections made on screen or by re-uploading the rows to fix. A correction replaces the
    // cell of the field's column, as editing the file would, so fields reading the same column
    // (billing and shipping pincode both read "Pincode") see it too: cellEdits by column letter.
    // A field with no column in the file keeps its correction in overrides, by field.
    cellEdits: { type: mongoose.Schema.Types.Mixed, default: {} },
    overrides: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Normalised values by field, as they will be saved.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    issues: { type: [IssueSchema], default: [] },
    status: { type: String, enum: ROW_STATUSES, default: 'ready' },
    action: { type: String, enum: ['create', 'update', null], default: null },
    // Existing record the row updates (upsert / update modes).
    matchId: { type: mongoose.Schema.Types.ObjectId, default: null },
    matchLabel: { type: String, default: '' },
    recordId: { type: mongoose.Schema.Types.ObjectId, default: null },
    error: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
    importedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }
});

ImportJobRowSchema.index({ jobId: 1, rowNumber: 1 }, { unique: true });
ImportJobRowSchema.index({ jobId: 1, status: 1, rowNumber: 1 });
ImportJobRowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

ImportJobRowSchema.plugin(tenantPlugin, { branchScoped: false });

const ImportJobRow = mongoose.model('ImportJobRow', ImportJobRowSchema);
ImportJobRow.ROW_STATUSES = ROW_STATUSES;

module.exports = ImportJobRow;
