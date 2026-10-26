const XLSX = require('xlsx');
const { tenantStorage } = require('../middlewares/tenantContext');

/*
 * Helpers for the Excel importers in controllers/importController.js.
 *
 * A file is processed in bounded batches: the records a batch refers to are looked up together
 * and its rows are saved with one bulk write, instead of several queries per row. Rows stay
 * independent - a row the database refuses is reported on its own and the others are saved.
 */

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 5000;
// Building and validating documents for a write is synchronous (about 0.3 ms per row), so a
// batch's writes go out in slices of this many documents with a pause in between: one write
// never blocks other requests for long, however large the batch.
const WRITE_SLICE = (() => {
    const value = Number(process.env.IMPORT_WRITE_SLICE || 100);
    return Number.isInteger(value) && value > 0 ? value : 100;
})();

/**
 * Rows per batch. IMPORT_BATCH_SIZE sets it for every importer; IMPORT_BATCH_SIZE_<MODULE>
 * (e.g. IMPORT_BATCH_SIZE_ASSETS) overrides it for one, so each can be tuned from measurements.
 */
const getImportBatchSize = (moduleKey) => {
    const envKey = moduleKey ? `IMPORT_BATCH_SIZE_${String(moduleKey).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}` : '';
    const value = Number((envKey && process.env[envKey]) || process.env.IMPORT_BATCH_SIZE || DEFAULT_BATCH_SIZE);
    return Number.isInteger(value) && value > 0 ? Math.min(value, MAX_BATCH_SIZE) : DEFAULT_BATCH_SIZE;
};

const chunk = (list, size) => {
    const chunks = [];
    for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
    return chunks;
};

/**
 * The first row of the sheet, as sheet_to_json(sheet, { header: 1 })[0] returns it (blank rows
 * count with header: 1), without converting every other row of the file to read it.
 */
const readHeaderRow = (worksheet) => {
    if (!worksheet || !worksheet['!ref']) return [];
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    range.e.r = range.s.r;
    return XLSX.utils.sheet_to_json(worksheet, { header: 1, range })[0] || [];
};

/**
 * Everything the importers read from an upload, in one pass over the file: the rows of every
 * sheet (for the row limit) and the first sheet's rows and header row - the sheet every importer
 * reads, converted as XLSX.utils.sheet_to_json(sheet) does. Runs in the parse worker
 * (enforceImportRowLimit), so it must stay free of database access.
 */
const readUploadSheet = (buffer) => {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const rowCount = workbook.SheetNames.reduce((total, sheetName) => (
        total + XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }).length
    ), 0);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return {
        sheetName,
        rowCount,
        rows: XLSX.utils.sheet_to_json(worksheet),
        headerRow: readHeaderRow(worksheet)
    };
};

/** The upload's first sheet: as the parse worker read it, or read here if that did not happen. */
const readUploadedSheet = (req) => req.importSheet || readUploadSheet(req.file.buffer);

/** Lets requests from other users run between two batches of a long import. */
const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

const collectFailures = (results, failures, offset) => {
    results.forEach((result, index) => {
        if (result) failures.set(offset + index, result.err || result);
    });
};

/**
 * insertMany that keeps going past bad documents. Returns Map(index -> error) of the documents
 * that were not saved (failed validation or refused by the database); every other one was saved.
 * Runs validation and the schema's insertMany hooks (tenant, default branch), but not pre('save').
 * A document already built as `new Model(...)` is not built again.
 * Throws when the outcome is unknown (connection lost), so the caller can report the batch.
 */
const insertRows = async (Model, docs, { bypassBranch = false } = {}) => {
    const failures = new Map();
    const options = { ordered: false, rawResult: true, ...(bypassBranch ? { bypassBranch: true } : {}) };
    // bypassBranch: documents keep the branch they carry (an explicit null stays null). The
    // option alone only reaches the insertMany hook; the validate hook insertMany runs for every
    // document reads the request context, so the insert also runs with the branch bypassed.
    const insert = (slice) => (bypassBranch
        ? tenantStorage.run({ ...(tenantStorage.getStore() || {}), bypassBranch: true }, () => Model.insertMany(slice, options))
        : Model.insertMany(slice, options));
    for (let offset = 0; offset < docs.length; offset += WRITE_SLICE) {
        if (offset) await yieldToEventLoop();
        const slice = docs.slice(offset, offset + WRITE_SLICE);
        const addValidationErrors = (result) => {
            (result?.mongoose?.validationErrors || []).forEach((error) => failures.set(offset + error.index, error));
        };
        try {
            addValidationErrors(await insert(slice));
        } catch (error) {
            if (!Array.isArray(error?.writeErrors)) throw error;
            addValidationErrors(error);
            error.writeErrors.forEach((writeError) => failures.set(offset + writeError.index, writeError.err || writeError));
        }
    }
    return failures;
};

/**
 * bulkWrite that keeps going past bad operations. Returns Map(index -> error) of the operations
 * that failed. bulkWrite skips the tenant plugin's query filters, so every filter must carry
 * companyId itself (inserted documents still get its validate hook, see bypassBranch).
 * Throws when the outcome is unknown.
 */
const writeRows = async (Model, ops, { bypassBranch = false } = {}) => {
    const failures = new Map();
    // bypassBranch: an insertOne keeps the branch it carries. bulkWrite validates inserted
    // documents, and that validate hook would otherwise fill a null branch from the request.
    const write = (slice) => (bypassBranch
        ? tenantStorage.run({ ...(tenantStorage.getStore() || {}), bypassBranch: true }, () => Model.bulkWrite(slice, { ordered: false }))
        : Model.bulkWrite(slice, { ordered: false }));
    for (let offset = 0; offset < ops.length; offset += WRITE_SLICE) {
        if (offset) await yieldToEventLoop();
        const slice = ops.slice(offset, offset + WRITE_SLICE);
        try {
            const result = await write(slice);
            if (Array.isArray(result?.mongoose?.results)) collectFailures(result.mongoose.results, failures, offset);
        } catch (error) {
            if (Array.isArray(error?.mongoose?.results)) collectFailures(error.mongoose.results, failures, offset);
            else if (Array.isArray(error?.writeErrors)) {
                error.writeErrors.forEach((writeError) => failures.set(offset + writeError.index, writeError.err || writeError));
            } else throw error;
        }
    }
    return failures;
};

// How a unique field is called on screen, for duplicate-key messages.
const FIELD_LABELS = {
    externalCode: 'customer code',
    serialNumberKey: 'serial number',
    productCode: 'product code',
    productName: 'product name',
    email: 'email',
    contractNumber: 'contract number',
    tenderNo: 'tender number',
    ticketNo: 'ticket number'
};

/** A database error as a message for the row it belongs to. */
const describeWriteError = (error, label = 'record') => {
    const code = error?.code ?? error?.err?.code;
    const message = error?.errmsg || error?.message || '';
    if (code === 11000 || /E11000/.test(message)) {
        // Bulk write errors carry no keyValue: the fields are read from "dup key: { a: .., b: .. }".
        const keyValue = error?.keyValue || error?.err?.keyValue;
        const keys = keyValue
            ? Object.keys(keyValue)
            : [...((message.match(/dup key: \{(.*)\}/) || [])[1] || '').matchAll(/(\w+):/g)].map((match) => match[1]);
        const fields = keys.filter((key) => key !== 'companyId').map((key) => FIELD_LABELS[key] || key).join(', ');
        return `Another ${label} already has the same ${fields || 'unique value'}.`;
    }
    if (error?.name === 'ValidationError' && error.errors) {
        return Object.values(error.errors).map((item) => item.message).join(' ');
    }
    return message || 'The database did not accept this row.';
};

/**
 * Reserves `count` consecutive numbers of a Counter sequence in one write and returns the first.
 * Same counter document as the one-at-a-time generators, so numbering simply continues.
 */
const reserveSequence = async (filter, count) => {
    if (count <= 0) return null;
    const Counter = require('../models/Counter');
    const counter = await Counter.findOneAndUpdate(
        filter,
        { $inc: { seq: count } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return counter.seq - count + 1;
};

module.exports = {
    DEFAULT_BATCH_SIZE,
    getImportBatchSize,
    chunk,
    readHeaderRow,
    readUploadSheet,
    readUploadedSheet,
    yieldToEventLoop,
    insertRows,
    writeRows,
    describeWriteError,
    reserveSequence
};
