const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// One bulk import: an uploaded file, how its columns map to the module's fields, and the
// outcome. The rows live in ImportJobRow, so a job can be reviewed, corrected and retried
// without uploading the whole file again (see services/importEngine).
const JOB_STATUSES = ['previewed', 'importing', 'finished'];
const IMPORT_MODES = ['upsert', 'create', 'update'];
const JOB_RETENTION_DAYS = 30;

const CountsSchema = new mongoose.Schema({
    total: { type: Number, default: 0 },
    blank: { type: Number, default: 0 },
    ready: { type: Number, default: 0 },
    readyCreate: { type: Number, default: 0 },
    readyUpdate: { type: Number, default: 0 },
    attention: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    excluded: { type: Number, default: 0 },
    importing: { type: Number, default: 0 },
    imported: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 }
}, { _id: false });

const RunSchema = new mongoose.Schema({
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    attempted: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    // Rows that no longer passed the checks when the run started (data changed since the preview).
    held: { type: Number, default: 0 },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const ImportJobSchema = new mongoose.Schema({
    module: { type: String, required: true, index: true },
    mode: { type: String, enum: IMPORT_MODES, default: 'upsert' },
    // Settings chosen on the screen (financial year, price book...) and their stable text,
    // which lists recent imports per setting.
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    paramsKey: { type: String, default: '[]' },
    status: { type: String, enum: JOB_STATUSES, default: 'previewed', index: true },

    file: {
        name: { type: String, default: '' },
        size: { type: Number, default: 0 },
        sheetName: { type: String, default: '' },
        sheetCount: { type: Number, default: 1 },
        headerRow: { type: Number, default: 1 },
        // Completely empty lines between the records; only counted.
        emptyRows: { type: Number, default: 0 }
    },
    // Columns of the file: key is the spreadsheet column letter, label the header text,
    // sample the first value in the column (shown when matching columns).
    headers: [{
        _id: false,
        key: { type: String, required: true },
        label: { type: String, default: '' },
        blank: { type: Boolean, default: false },
        sample: { type: String, default: '' }
    }],
    // { fieldKey: [columnKey, ...] } - the first non-blank column in the list gives the value.
    mapping: { type: mongoose.Schema.Types.Mixed, default: {} },

    counts: { type: CountsSchema, default: () => ({}) },
    // Live progress of the run in flight, polled by the screen.
    progress: {
        total: { type: Number, default: 0 },
        processed: { type: Number, default: 0 }
    },
    runs: { type: [RunSchema], default: [] },
    lockedAt: { type: Date, default: null },
    heartbeatAt: { type: Date, default: null },

    createdBy: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, default: '' }
    },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    expiresAt: { type: Date, default: () => new Date(Date.now() + JOB_RETENTION_DAYS * 86400000) }
}, { timestamps: true });

ImportJobSchema.index({ companyId: 1, module: 1, 'createdBy.userId': 1, paramsKey: 1, createdAt: -1 });
ImportJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// A job belongs to the person who uploaded it, whichever branch they switch to afterwards;
// branchId only records where it was started.
ImportJobSchema.plugin(tenantPlugin, { branchScoped: false });

const ImportJob = mongoose.model('ImportJob', ImportJobSchema);
ImportJob.JOB_STATUSES = JOB_STATUSES;
ImportJob.IMPORT_MODES = IMPORT_MODES;
ImportJob.JOB_RETENTION_DAYS = JOB_RETENTION_DAYS;

module.exports = ImportJob;
