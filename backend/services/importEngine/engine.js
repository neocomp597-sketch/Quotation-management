const mongoose = require('mongoose');
const XLSX = require('xlsx');
const ImportJob = require('../../models/ImportJob');
const ImportJobRow = require('../../models/ImportJobRow');
const { isBlank } = require('./parser');
const { parseOffThread } = require('../../utils/offThreadParse');
const { parseField, toText } = require('./fieldTypes');
const { ImportFileError, ImportJobError } = require('./errors');
const { insertRows, writeRows, yieldToEventLoop } = require('../../utils/importBatch');

/*
 * Shared bulk import engine.
 *
 *   preview   - parse the file, match its columns to the module's fields, check every row
 *   settings  - change the column matching or the import type; every open row is checked again
 *   correct   - fix rows on screen or from the re-uploaded "rows to fix" file
 *   execute   - save the rows that passed, in batches; rows with issues never reach the database
 *
 * Every row keeps its own status (see models/ImportJobRow.js), so one bad row never blocks the
 * others and a retry only touches rows that were not imported yet.
 *
 * A module (see modules/customers.js) describes its fields and, optionally:
 *   resolveParams(raw, { user })          settings chosen on the screen (financial year, price
 *                                          book...); throw ImportJobError when they are invalid
 *   loadContext({ params, user, rows })   lookups for one checking pass, loaded once; `rows` is the
 *                                          parsed data of every row, so codes can be fetched in bulk
 *   validate(data, { context, params })   issues that need lookups or settings; may add resolved
 *                                          values to data (productId...), which are stored and saved
 *   identityKeys(data, { params })        what makes two rows the same record (duplicates)
 *   match(data, context, { params })      the existing record a row updates, else it creates one
 *   modes                                  allowed import types (default: all when match exists)
 *   toCreate / toUpdate                    documents for the default bulkWrite, or
 *   write(plans, ctx)                      custom saving; returns Map(rowId -> error message)
 *   permissions                            [[screenKey, action], ...], any one is enough
 *   afterImport({ user, run, params })    cache invalidation, notifications
 */

// Rows per database call when the job rows are stored or re-checked. Building the documents is
// synchronous, so smaller chunks with a pause between them keep other requests moving.
const ROW_INSERT_CHUNK = 250;
// Rows checked before other requests get a turn (the checks are synchronous).
const CHECK_SLICE = 250;
const WRITE_BATCH_SIZE = 200;
// A run that has not reported progress for this long was interrupted (server restart).
const STALE_RUN_MS = 2 * 60 * 1000;

// Rows the checks are run on again whenever something changes.
const OPEN_STATUSES = ['ready', 'attention', 'blank', 'failed'];
const WRITTEN_STATUSES = ['importing', 'imported'];
const ELIGIBLE_STATUSES = ['ready', 'failed'];

const hasOwn = (obj, key) => Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);

const normalizeHeader = (label) => String(label ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const shownText = (value) => (isBlank(value) ? '' : toText(value));

const chunk = (list, size) => {
    const chunks = [];
    for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
    return chunks;
};

// ── Column matching ─────────────────────────────────────────────────────────

/**
 * For each field, the file columns whose heading is one of the field's accepted names, in the
 * field's order. Headings are compared without case, spaces or punctuation ("E-Mail" = "email").
 */
const autoMapColumns = (headers, fields) => {
    const mapping = {};
    fields.forEach((field) => {
        const columns = [];
        (field.aliases || [field.label]).forEach((alias) => {
            const wanted = normalizeHeader(alias);
            if (!wanted) return;
            headers.forEach((header) => {
                if (!header.blank && normalizeHeader(header.label) === wanted && !columns.includes(header.key)) {
                    columns.push(header.key);
                }
            });
        });
        mapping[field.key] = columns;
    });
    return mapping;
};

/** A mapping sent by the screen, limited to the module's fields and the file's columns. */
const sanitizeMapping = (input, headers, fields) => {
    const known = new Set(headers.map((header) => header.key));
    const mapping = {};
    fields.forEach((field) => {
        const wanted = Array.isArray(input?.[field.key]) ? input[field.key] : [];
        mapping[field.key] = [...new Set(wanted.map(String))].filter((key) => known.has(key)).slice(0, 10);
    });
    return mapping;
};

/** The cell a field reads in a row: the first non-blank mapped column, corrections included. */
const cellFor = (row, field, mapping) => {
    if (hasOwn(row.overrides, field.key)) return row.overrides[field.key];
    for (const column of mapping?.[field.key] || []) {
        const value = hasOwn(row.cellEdits, column) ? row.cellEdits[column] : row.values?.[column];
        if (!isBlank(value)) return value;
    }
    return '';
};

const isEdited = (row, field, mapping) => (
    hasOwn(row.overrides, field.key) || (mapping?.[field.key] || []).some((column) => hasOwn(row.cellEdits, column))
);

// ── Row checks ──────────────────────────────────────────────────────────────

/**
 * Checks one row by itself. A blank optional cell is simply left out of `data` - that is what
 * lets an update keep the stored value. Defaults are only applied when a record is created.
 */
const checkRowValues = (module, row, mapping) => {
    const data = {};
    const issues = [];
    let filled = 0;

    module.fields.forEach((field) => {
        const cell = cellFor(row, field, mapping);
        if (isBlank(cell)) return;
        filled++;
        const result = parseField(cell, field);
        if (result.issue) issues.push({ field: field.key, ...result.issue });
        else data[field.key] = result.value;
    });
    if (!filled) return { blank: true };

    const hasIssue = (key) => issues.some((issue) => issue.field === key);
    // Fields that stand in for each other (customer name <-> company name).
    module.fields.forEach((field) => {
        if (field.fallbackFrom && data[field.key] === undefined && !hasIssue(field.key) && data[field.fallbackFrom] !== undefined) {
            data[field.key] = data[field.fallbackFrom];
        }
    });

    module.fields.forEach((field) => {
        if (!field.required || data[field.key] !== undefined || hasIssue(field.key)) return;
        // One message for a pair that stand in for each other.
        if (field.fallbackFrom && issues.some((issue) => issue.code === 'REQUIRED' && issue.field === field.fallbackFrom)) return;
        issues.push({
            field: field.key,
            code: 'REQUIRED',
            message: field.requiredMessage || `${field.label} is required.`,
            hint: field.requiredHint || `Fill in ${field.label} for this row.`
        });
    });

    return { data, issues };
};

/** Import types a module allows; one that never matches existing records can only add. */
const allowedModes = (module) => module.modes || (module.match ? ImportJob.IMPORT_MODES : ['create']);

const identityKeysFor = (module, data, params) => (module.identityKeys ? module.identityKeys(data, { params }) || [] : []);

/**
 * Stable text of the screen settings, so recent imports can be listed per price book, FY...
 * A module whose settings also carry display values (a book's name) lists the keys that
 * identify the setting in `paramsKeyFields`.
 */
const paramsKeyOf = (params = {}, module = {}) => {
    const keys = module.paramsKeyFields || Object.keys(params);
    return JSON.stringify([...keys].sort().map((key) => [key, String(params[key] ?? '')]));
};

/** Reads the upload in a worker thread, so a large file does not hold up other requests. */
const readWorkbook = async (file) => {
    try {
        return await parseOffThread(require.resolve('./parser'), 'parseWorkbook', file.buffer, {
            fileName: file.originalname,
            mimeType: file.mimetype
        });
    } catch (error) {
        // Errors come back from the worker as plain Errors that keep name, code and hint.
        if (error?.name === 'ImportFileError') throw new ImportFileError(error.code, error.message, error.hint);
        throw error;
    }
};

const resolveParams = async (module, raw, user) => (
    module.resolveParams ? (await module.resolveParams(raw || {}, { user })) || {} : {}
);

const withDefaults = (module, data) => {
    const result = { ...data };
    module.fields.forEach((field) => {
        if (field.default !== undefined && result[field.key] === undefined) result[field.key] = field.default;
    });
    return result;
};

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Checks every open row of the job against each other and against the current database.
 *
 * Duplicates: the first row with a given identity (customer code, GSTIN...) wins; later rows
 * with the same identity, or that would update the same existing record, need attention.
 * Rows already written own their identity, so a corrected row can never duplicate them.
 *
 * The module's lookups are loaded once per pass and returned, so an import reuses them.
 */
const validateJobRows = async (job, module, { user, edited = new Set() } = {}) => {
    const rows = await ImportJobRow.find({ jobId: job._id }).sort({ rowNumber: 1 }).lean();
    const params = job.params || {};
    const checks = new Map();
    for (let i = 0; i < rows.length; i++) {
        if (i && i % CHECK_SLICE === 0) await yieldToEventLoop();
        const row = rows[i];
        if (OPEN_STATUSES.includes(row.status)) checks.set(row.rowNumber, checkRowValues(module, row, job.mapping));
    }
    const parsed = [...checks.values()].filter((check) => !check.blank).map((check) => check.data);
    const context = module.loadContext ? await module.loadContext({ params, user, rows: parsed }) : {};

    const identityOwners = new Map();
    const recordOwners = new Map();
    const claim = (rowNumber, keys, recordId) => {
        keys.forEach(({ key }) => {
            if (!identityOwners.has(key)) identityOwners.set(key, rowNumber);
        });
        if (recordId && !recordOwners.has(String(recordId))) recordOwners.set(String(recordId), rowNumber);
    };

    rows.filter((row) => WRITTEN_STATUSES.includes(row.status))
        .forEach((row) => claim(row.rowNumber, identityKeysFor(module, row.data || {}, params), row.recordId || row.matchId));

    const updates = [];
    for (let i = 0; i < rows.length; i++) {
        if (i && i % CHECK_SLICE === 0) await yieldToEventLoop();
        const row = rows[i];
        if (!OPEN_STATUSES.includes(row.status)) continue;

        const checked = checks.get(row.rowNumber);
        let next;
        if (checked.blank) {
            next = { status: 'blank', data: {}, issues: [], action: null, matchId: null, matchLabel: '', error: '' };
        } else {
            const { data } = checked;
            const issues = [...checked.issues];
            // Checks that need lookups or the screen settings (product code exists, FY...).
            if (module.validate) issues.push(...(module.validate(data, { context, params, user, issues }) || []));
            const keys = identityKeysFor(module, data, params);

            const duplicate = keys
                .map((identity) => ({ identity, owner: identityOwners.get(identity.key) }))
                .find(({ owner }) => owner !== undefined && owner !== row.rowNumber);
            if (duplicate) {
                const { identity, owner } = duplicate;
                issues.push({
                    field: identity.field,
                    code: 'DUPLICATE_IN_FILE',
                    message: `Same ${identity.label} as row ${owner}.`,
                    hint: `Only the first row with this ${identity.label} is imported. Change it here, or skip this row.`
                });
            }

            const match = module.match ? module.match(data, context, { params }) : null;
            const matchId = match ? match.record._id : null;
            const matchLabel = match && module.describe ? module.describe(match.record) : '';
            const matchedBy = match?.by ? `same ${match.by}` : '';
            const matchNote = [matchLabel, matchedBy].filter(Boolean).join(', ');
            const recordOwner = matchId ? recordOwners.get(String(matchId)) : undefined;
            if (!duplicate && recordOwner !== undefined && recordOwner !== row.rowNumber) {
                issues.push({
                    field: match.field || '',
                    code: 'DUPLICATE_IN_FILE',
                    message: `Row ${recordOwner} already updates the same ${module.recordLabel}${matchLabel ? ` (${matchLabel})` : ''}.`,
                    hint: `Only the first row for a ${module.recordLabel} is imported. Change this row, or skip it.`
                });
            }
            if (job.mode === 'create' && match) {
                issues.push({
                    field: match.field || '',
                    code: 'ALREADY_EXISTS',
                    message: `This ${module.recordLabel} already exists${matchNote ? ` (${matchNote})` : ''}.`,
                    hint: `This import only adds new ${module.recordLabelPlural}. Skip this row, or choose "Add new and update existing".`
                });
            }
            if (job.mode === 'update' && !match) {
                issues.push({
                    field: keys[0]?.field || '',
                    code: 'NOT_FOUND',
                    message: `No existing ${module.recordLabel} matches this row.`,
                    hint: `This import only updates existing ${module.recordLabelPlural}. Check the ${keys[0]?.label || 'code'}, or choose "Add new and update existing".`
                });
            }

            claim(row.rowNumber, keys, matchId);

            // A row the database refused stays "failed" (with its reason) until it is edited.
            const keepFailed = row.status === 'failed' && !edited.has(row.rowNumber);
            const status = issues.length ? 'attention' : keepFailed ? 'failed' : 'ready';
            next = {
                status,
                data,
                issues,
                action: match ? 'update' : 'create',
                matchId,
                matchLabel: match ? [matchLabel, matchedBy && `(${matchedBy})`].filter(Boolean).join(' ') : '',
                error: status === 'failed' ? row.error || '' : ''
            };
        }

        const changed = row.status !== next.status
            || (row.action ?? null) !== next.action
            || String(row.matchId || '') !== String(next.matchId || '')
            || (row.matchLabel || '') !== next.matchLabel
            || (row.error || '') !== next.error
            || !sameJson(row.issues, next.issues)
            || !sameJson(row.data, next.data);
        if (changed) updates.push({ updateOne: { filter: { _id: row._id }, update: { $set: next } } });
    }

    for (const ops of chunk(updates, ROW_INSERT_CHUNK)) {
        await ImportJobRow.bulkWrite(ops, { ordered: false });
        await yieldToEventLoop();
    }
    return context;
};

/** Recounts the job from its rows, so the summary always matches what is stored. */
const refreshCounts = async (job) => {
    const groups = await ImportJobRow.aggregate([
        { $match: { jobId: new mongoose.Types.ObjectId(String(job._id)) } },
        {
            $group: {
                _id: {
                    status: '$status',
                    action: '$action',
                    duplicate: { $in: ['DUPLICATE_IN_FILE', { $ifNull: ['$issues.code', []] }] }
                },
                count: { $sum: 1 }
            }
        }
    ]);

    const counts = {
        total: 0, blank: job.file?.emptyRows || 0, ready: 0, readyCreate: 0, readyUpdate: 0, attention: 0,
        duplicates: 0, failed: 0, excluded: 0, importing: 0, imported: 0, created: 0, updated: 0
    };
    groups.forEach(({ _id, count }) => {
        if (_id.status === 'blank') {
            counts.blank += count;
            return;
        }
        counts.total += count;
        if (hasOwn(counts, _id.status)) counts[_id.status] += count;
        if (_id.status === 'ready') counts[_id.action === 'update' ? 'readyUpdate' : 'readyCreate'] += count;
        if (_id.status === 'imported') counts[_id.action === 'update' ? 'updated' : 'created'] += count;
        if (_id.status === 'attention' && _id.duplicate) counts.duplicates += count;
    });

    await ImportJob.updateOne({ _id: job._id }, { $set: { counts } });
    job.counts = counts;
    return counts;
};

const assertNotRunning = (job) => {
    if (job.status === 'importing') {
        throw new ImportJobError('ALREADY_RUNNING', 'This import is running right now.', 'Wait for it to finish, then try again.');
    }
};

// ── Preview and settings ────────────────────────────────────────────────────

const sampleFor = (rows, columnKey) => {
    const row = rows.find((candidate) => !isBlank(candidate.values[columnKey]));
    return row ? toText(row.values[columnKey]).slice(0, 80) : '';
};

const createPreview = async ({ module, file, mode, params: rawParams, user }) => {
    // Settings first: a wrong price book or year is reported before the file is read.
    const params = await resolveParams(module, rawParams, user);
    const parsed = await readWorkbook(file);
    const headers = parsed.headers.map((header) => ({ ...header, sample: sampleFor(parsed.rows, header.key) }));
    const modes = allowedModes(module);

    const job = (await ImportJob.create({
        module: module.key,
        mode: modes.includes(mode) ? mode : modes[0],
        params,
        paramsKey: paramsKeyOf(params, module),
        file: {
            name: file.originalname || '',
            size: file.size || file.buffer.length,
            sheetName: parsed.sheetName,
            sheetCount: parsed.sheetCount,
            headerRow: parsed.headerRow,
            emptyRows: parsed.emptyRowCount
        },
        headers,
        mapping: autoMapColumns(headers, module.fields),
        createdBy: { userId: user.id, name: user.name || '' }
    })).toObject();

    try {
        for (const rows of chunk(parsed.rows, ROW_INSERT_CHUNK)) {
            await ImportJobRow.insertMany(rows.map((row) => ({
                jobId: job._id,
                rowNumber: row.rowNumber,
                values: row.values,
                expiresAt: job.expiresAt
            })), { ordered: true });
            await yieldToEventLoop();
        }
        await validateJobRows(job, module, { user });
        await refreshCounts(job);
    } catch (error) {
        await ImportJobRow.deleteMany({ jobId: job._id }).catch(() => {});
        await ImportJob.deleteOne({ _id: job._id }).catch(() => {});
        throw error;
    }
    return job;
};

const updateSettings = async (job, module, { mapping, mode }, { user } = {}) => {
    assertNotRunning(job);
    const set = {};
    if (mapping !== undefined) {
        if ((job.counts?.imported || 0) > 0) {
            throw new ImportJobError(
                'MAPPING_LOCKED',
                'Columns cannot be changed after rows were imported.',
                'Upload the file again to start a new import with different columns.'
            );
        }
        set.mapping = sanitizeMapping(mapping, job.headers, module.fields);
    }
    if (mode !== undefined) {
        if (!allowedModes(module).includes(mode)) throw new ImportJobError('INVALID_MODE', 'This import type is not available here.', '', 400);
        set.mode = mode;
    }
    if (!Object.keys(set).length) return job;

    await ImportJob.updateOne({ _id: job._id }, { $set: set });
    Object.assign(job, set);
    await validateJobRows(job, module, { user });
    await refreshCounts(job);
    return job;
};

// ── Corrections ─────────────────────────────────────────────────────────────

const correctionValue = (value) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    return '';
};

/**
 * Applies corrections: [{ rowNumber, values: { field: value }, exclude: true|false }].
 *
 * Only values that differ from what the row shows now count as corrections (a re-uploaded file
 * sends every column back). A correction goes into the cell of the field's own (first) column;
 * a field with no column in the file keeps it by field. Imported rows are never touched. Every
 * open row is then checked again, because fixing one row can resolve a duplicate in another.
 */
const correctRows = async (job, module, corrections = [], { user } = {}) => {
    assertNotRunning(job);
    const numbers = corrections.map((correction) => Number(correction?.rowNumber)).filter(Number.isInteger);
    const rows = await ImportJobRow.find({ jobId: job._id, rowNumber: { $in: numbers } }).lean();
    const byNumber = new Map(rows.map((row) => [row.rowNumber, row]));
    const fieldsByKey = new Map(module.fields.map((field) => [field.key, field]));

    const applyValues = (row, values) => {
        const cellEdits = { ...(row.cellEdits || {}) };
        const overrides = { ...(row.overrides || {}) };
        let changed = false;
        Object.entries(values).forEach(([key, value]) => {
            const field = fieldsByKey.get(key);
            if (!field) return;
            const next = correctionValue(value);
            // Compared with the row before this correction: a re-uploaded file repeats the old
            // shipping pincode next to the corrected billing one, and that must not undo it.
            if (shownText(next) === shownText(cellFor(row, field, job.mapping))) return;
            const column = job.mapping?.[key]?.[0];
            if (column) cellEdits[column] = next;
            else overrides[key] = next;
            changed = true;
        });
        return changed ? { cellEdits, overrides } : null;
    };

    const ops = [];
    const edited = new Set();
    const skipped = [];
    corrections.forEach((correction) => {
        const rowNumber = Number(correction?.rowNumber);
        const row = byNumber.get(rowNumber);
        if (!row) {
            skipped.push({ rowNumber, reason: 'not_found' });
            return;
        }
        if (WRITTEN_STATUSES.includes(row.status)) {
            skipped.push({ rowNumber, reason: 'already_imported' });
            return;
        }

        const set = {};
        if (correction.values && typeof correction.values === 'object') {
            Object.assign(set, applyValues(row, correction.values) || {});
        }
        if (correction.exclude === true && row.status !== 'excluded') set.status = 'excluded';
        // Back into the checks below.
        else if (correction.exclude === false && row.status === 'excluded') set.status = 'attention';

        if (Object.keys(set).length) {
            edited.add(rowNumber);
            ops.push({ updateOne: { filter: { _id: row._id }, update: { $set: set } } });
        }
    });

    for (const batch of chunk(ops, ROW_INSERT_CHUNK)) {
        await ImportJobRow.bulkWrite(batch, { ordered: false });
    }
    await validateJobRows(job, module, { user, edited });
    await refreshCounts(job);
    return { edited: [...edited], skipped };
};

const ROW_REF_LABEL = 'Row ref';

/** Reads a corrected "rows to fix" file (exportRows) back into the same job. */
const applyCorrectionFile = async (job, module, file, { user } = {}) => {
    const parsed = await readWorkbook(file);
    const refHeader = parsed.headers.find((header) => normalizeHeader(header.label) === normalizeHeader(ROW_REF_LABEL));
    if (!refHeader) {
        throw new ImportFileError(
            'NO_ROW_REF',
            `This file has no "${ROW_REF_LABEL}" column, so its rows cannot be matched to this import.`,
            'Upload the file you downloaded with "Download rows to fix" and keep its first column as it is.'
        );
    }
    const columns = module.fields
        .map((field) => ({
            field,
            header: parsed.headers.find((header) => normalizeHeader(header.label) === normalizeHeader(field.label))
        }))
        .filter(({ header }) => header);
    if (!columns.length) {
        throw new ImportFileError('NO_FIELDS', 'None of the columns in this file belong to this import.', 'Keep the column headings of the downloaded file unchanged.');
    }

    const corrections = parsed.rows
        .map((row) => {
            const values = {};
            columns.forEach(({ field, header }) => {
                values[field.key] = hasOwn(row.values, header.key) ? row.values[header.key] : '';
            });
            return { rowNumber: Number(toText(row.values[refHeader.key] ?? '')), values };
        })
        .filter((correction) => Number.isInteger(correction.rowNumber) && correction.rowNumber > 0);

    const result = await correctRows(job, module, corrections, { user });
    return { ...result, received: parsed.rows.length };
};

/** The rows that still need attention as an Excel file to correct and upload again. */
const exportRows = async (job, module, { statuses = ['attention', 'failed'] } = {}) => {
    const rows = await ImportJobRow.find({ jobId: job._id, status: { $in: statuses } }).sort({ rowNumber: 1 }).lean();
    const exportCell = (value) => (isBlank(value) ? '' : value instanceof Date ? toText(value) : value);
    const whatToFix = (row) => [
        ...(row.issues || []).map((issue) => [issue.message, issue.hint].filter(Boolean).join(' ')),
        row.error
    ].filter(Boolean).join(' | ');

    const sheet = XLSX.utils.aoa_to_sheet([
        [ROW_REF_LABEL, ...module.fields.map((field) => (field.required ? `${field.label} *` : field.label)), 'What to fix'],
        ...rows.map((row) => [
            row.rowNumber,
            ...module.fields.map((field) => exportCell(cellFor(row, field, job.mapping))),
            whatToFix(row)
        ])
    ]);
    sheet['!cols'] = [{ wch: 9 }, ...module.fields.map((field) => ({ wch: Math.max(14, field.label.length + 4) })), { wch: 70 }];

    const notes = XLSX.utils.aoa_to_sheet([
        ['How to use this file'],
        ['1', 'Correct the values in the rows below. The "What to fix" column says what each row needs.'],
        ['2', `Keep the "${ROW_REF_LABEL}" column: it links each line to the row of your original file.`],
        ['3', 'Upload this file with "Upload corrected file" in the same import. Only these rows are checked again.'],
        ['4', 'Rows you delete from this file stay as they are. Rows already imported are never imported twice.'],
        ['', '* = required']
    ]);
    notes['!cols'] = [{ wch: 6 }, { wch: 110 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Rows to fix');
    XLSX.utils.book_append_sheet(workbook, notes, 'How to use');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

// ── Import ──────────────────────────────────────────────────────────────────

const describeSaveError = (error, module) => {
    const code = error?.code ?? error?.err?.code;
    const message = error?.errmsg || error?.message || '';
    if (code === 11000 || /E11000/.test(message)) {
        // Bulk write errors carry no keyPattern/keyValue: the fields are read from "dup key: { a: .. }".
        const keys = error?.keyPattern || error?.err?.keyPattern || error?.keyValue || error?.err?.keyValue
            || Object.fromEntries([...((message.match(/dup key: \{(.*)\}/) || [])[1] || '').matchAll(/(\w+):/g)].map((match) => [match[1], 1]));
        const labels = Object.keys(keys)
            .filter((key) => key !== 'companyId')
            .map((key) => module.fields.find((field) => field.key === key)?.label || key)
            .join(', ');
        return `Another ${module.recordLabel} already has the same ${labels || 'unique value'}, so this row was not saved.`;
    }
    if (error?.name === 'ValidationError' && error.errors) {
        return Object.values(error.errors).map((item) => item.message).join(' ');
    }
    return `The database did not accept this row: ${message || 'unknown error'}.`;
};

/**
 * The default way of saving a batch: one bulkWrite of module.toCreate / module.toUpdate.
 * Returns Map(rowId -> error message) for the rows that were not saved.
 */
const defaultWrite = async (module, plans, { user, companyId, params }) => {
    const errors = new Map();
    const creates = [];
    const updates = [];
    plans.forEach((plan) => {
        try {
            if (plan.action === 'create') {
                creates.push({ plan, doc: { ...module.toCreate(plan.data, { user, params }), _id: plan.recordId, companyId } });
            } else {
                updates.push({
                    plan,
                    op: { updateOne: { filter: { _id: plan.recordId, companyId }, update: { $set: module.toUpdate(plan.data, { user, params }) } } }
                });
            }
        } catch (error) {
            errors.set(plan.rowId, describeSaveError(error, module));
        }
    });

    // Each new document is built and validated once, and written in slices with a pause in
    // between (utils/importBatch). Throws when the outcome is unknown: the caller reconciles.
    (await insertRows(module.model, creates.map(({ doc }) => doc), { bypassBranch: true })).forEach((error, index) => {
        errors.set(creates[index].plan.rowId, describeSaveError(error, module));
    });
    (await writeRows(module.model, updates.map(({ op }) => op))).forEach((error, index) => {
        errors.set(updates[index].plan.rowId, describeSaveError(error, module));
    });

    if (updates.length) {
        // An update whose record was deleted after the checks matched nothing.
        const updated = updates.map(({ plan }) => plan).filter((plan) => !errors.has(plan.rowId));
        if (updated.length) {
            const found = await module.model.find({ _id: { $in: updated.map((plan) => plan.recordId) } })
                .select('_id')
                .setOptions({ bypassBranch: true })
                .lean();
            const foundIds = new Set(found.map((doc) => String(doc._id)));
            updated.forEach((plan) => {
                if (!foundIds.has(String(plan.recordId))) {
                    errors.set(plan.rowId, `This ${module.recordLabel} was deleted while the import was running.`);
                }
            });
        }
    }
    return errors;
};

/**
 * Writes one batch. The record id of every row is stored on the row before the write, so if
 * the process stops halfway, reconcileWrittenRows can tell exactly which rows were saved.
 *
 * A module with its own `write(plans, ctx)` (sequences, history records, login accounts...)
 * gets plans of { rowId, rowNumber, action, recordId, data } and must create new records with
 * _id = recordId. It returns Map(rowId -> error message); throwing means the outcome of the
 * whole batch is unknown, and the caller reconciles it.
 */
const writeBatch = async (module, rows, { user, companyId, params, context }) => {
    const plans = rows.map((row) => {
        const action = row.matchId ? 'update' : 'create';
        return {
            row,
            rowId: String(row._id),
            rowNumber: row.rowNumber,
            action,
            recordId: row.matchId || new mongoose.Types.ObjectId(),
            data: action === 'create' ? withDefaults(module, row.data || {}) : row.data || {}
        };
    });
    await ImportJobRow.bulkWrite(plans.map(({ row, action, recordId }) => ({
        updateOne: {
            filter: { _id: row._id },
            update: { $set: { status: 'importing', action, recordId, error: '' }, $inc: { attempts: 1 } }
        }
    })), { ordered: false });

    let errors;
    if (module.write) {
        const answer = await module.write(
            plans.map(({ rowId, rowNumber, action, recordId, data }) => ({ rowId, rowNumber, action, recordId, data })),
            { user, companyId, params, context }
        );
        errors = answer instanceof Map ? answer : new Map(Object.entries(answer || {}));
    } else {
        errors = await defaultWrite(module, plans, { user, companyId, params });
    }

    const outcome = { created: 0, updated: 0, failed: 0 };
    const importedAt = new Date();
    await ImportJobRow.bulkWrite(plans.map(({ row, rowId, action }) => {
        const error = errors.get(rowId);
        if (error) {
            outcome.failed++;
            return { updateOne: { filter: { _id: row._id }, update: { $set: { status: 'failed', error, recordId: null } } } };
        }
        outcome[action === 'create' ? 'created' : 'updated']++;
        return { updateOne: { filter: { _id: row._id }, update: { $set: { status: 'imported', importedAt, error: '' } } } };
    }), { ordered: false });
    return outcome;
};

const INTERRUPTED_CREATE = 'The import was interrupted before this row was saved. Import again to retry it.';
const INTERRUPTED_UPDATE = 'The import was interrupted while this row was being saved. Import again to apply it (repeating it is safe).';

/** Settles rows left "importing" by an interrupted run: saved rows become imported, the rest failed. */
const reconcileWrittenRows = async (job, module) => {
    const rows = await ImportJobRow.find({ jobId: job._id, status: 'importing' }).select('_id action recordId').lean();
    if (!rows.length) return 0;

    const createIds = rows.filter((row) => row.action === 'create' && row.recordId).map((row) => row.recordId);
    const saved = createIds.length
        ? await module.model.find({ _id: { $in: createIds } }).select('_id').setOptions({ bypassBranch: true }).lean()
        : [];
    const savedIds = new Set(saved.map((doc) => String(doc._id)));

    await ImportJobRow.bulkWrite(rows.map((row) => {
        if (row.action === 'create' && savedIds.has(String(row.recordId))) {
            return { updateOne: { filter: { _id: row._id }, update: { $set: { status: 'imported', importedAt: new Date(), error: '' } } } };
        }
        const error = row.action === 'create' ? INTERRUPTED_CREATE : INTERRUPTED_UPDATE;
        return { updateOne: { filter: { _id: row._id }, update: { $set: { status: 'failed', error, ...(row.action === 'create' ? { recordId: null } : {}) } } } };
    }), { ordered: false });
    return rows.length;
};

/** A job left "importing" by a server restart is settled when it is next opened. */
const reconcileIfStale = async (job, module) => {
    if (job.status !== 'importing') return job;
    const lastSeen = new Date(job.heartbeatAt || job.lockedAt || 0).getTime();
    if (Date.now() - lastSeen < STALE_RUN_MS) return job;

    await reconcileWrittenRows(job, module);
    const released = await ImportJob.findOneAndUpdate(
        { _id: job._id, status: 'importing', heartbeatAt: job.heartbeatAt },
        { $set: { status: 'finished', lockedAt: null, heartbeatAt: null, 'progress.processed': job.progress?.total || 0 } },
        { new: true, lean: true }
    );
    const current = released || await ImportJob.findById(job._id).lean();
    await refreshCounts(current);
    return current;
};

/**
 * Imports every row that passed the checks. Only one run per job at a time: the job is claimed
 * atomically, so a second click (or a second tab) gets "already running" instead of a second
 * import. The checks run again first, because the data may have changed since the preview.
 */
const executeJob = async (jobId, module, { user }) => {
    const startedAt = new Date();
    const job = await ImportJob.findOneAndUpdate(
        { _id: jobId, status: { $ne: 'importing' } },
        { $set: { status: 'importing', lockedAt: startedAt, heartbeatAt: startedAt, progress: { total: 0, processed: 0 } } },
        { new: true, lean: true }
    );
    if (!job) {
        throw new ImportJobError('ALREADY_RUNNING', 'This import is already running.', 'Wait for it to finish - the screen updates by itself.');
    }

    const run = { startedAt, attempted: 0, created: 0, updated: 0, failed: 0, held: 0, userId: user.id };
    const before = { created: job.counts?.created || 0, updated: job.counts?.updated || 0 };
    let runError = null;
    try {
        const eligibleBefore = await ImportJobRow.countDocuments({ jobId: job._id, status: { $in: ELIGIBLE_STATUSES } });
        const context = await validateJobRows(job, module, { user });
        const rows = await ImportJobRow.find({ jobId: job._id, status: { $in: ELIGIBLE_STATUSES } })
            .sort({ rowNumber: 1 })
            .lean();
        run.attempted = rows.length;
        run.held = Math.max(eligibleBefore - rows.length, 0);
        await ImportJob.updateOne({ _id: job._id }, { $set: { heartbeatAt: new Date(), 'progress.total': rows.length } });

        let processed = 0;
        for (const batch of chunk(rows, WRITE_BATCH_SIZE)) {
            const outcome = await writeBatch(module, batch, { user, companyId: job.companyId, params: job.params || {}, context });
            run.created += outcome.created;
            run.updated += outcome.updated;
            run.failed += outcome.failed;
            processed += batch.length;
            await ImportJob.updateOne({ _id: job._id }, { $set: { heartbeatAt: new Date(), 'progress.processed': processed } });
        }
    } catch (error) {
        console.error(`Import ${job._id} stopped:`, error);
        runError = error;
        await reconcileWrittenRows(job, module).catch((reconcileError) => console.error('Import reconcile failed:', reconcileError));
    } finally {
        run.finishedAt = new Date();
        const counted = await refreshCounts(job).catch((countError) => console.error('Import recount failed:', countError));
        if (counted) {
            // From the rows, so rows an interrupted batch still saved are included.
            run.created = Math.max(counted.created - before.created, 0);
            run.updated = Math.max(counted.updated - before.updated, 0);
        }
        await ImportJob.updateOne(
            { _id: job._id },
            { $set: { status: 'finished', lockedAt: null, heartbeatAt: null }, $push: { runs: run } }
        );
    }

    if (run.created + run.updated > 0 && module.afterImport) {
        await module.afterImport({ user, run, params: job.params || {} }).catch((error) => console.error('Import follow-up failed:', error));
    }

    const finished = await ImportJob.findById(job._id).lean();
    return {
        job: finished,
        run,
        error: runError ? 'The import stopped before every row was saved. The rows that were saved are kept; import again to retry the rest.' : null
    };
};

// ── Reading ─────────────────────────────────────────────────────────────────

const publicField = (field) => ({
    key: field.key,
    label: field.label,
    required: Boolean(field.required),
    type: field.type || 'text',
    description: field.description || '',
    options: field.options || undefined,
    min: field.min,
    max: field.max,
    fallbackFrom: field.fallbackFrom || undefined
});

const describeModule = (module) => ({
    key: module.key,
    label: module.label,
    recordLabel: module.recordLabel,
    recordLabelPlural: module.recordLabelPlural,
    modes: allowedModes(module),
    fields: module.fields.map(publicField)
});

const serializeJob = (job, module) => ({
    id: String(job._id),
    module: describeModule(module),
    mode: job.mode,
    params: job.params || {},
    // How the screen settings read for people ("FY 2026-27", "Price book: Retail 2026").
    paramsLabel: module.describeParams ? module.describeParams(job.params || {}) || '' : '',
    status: job.status,
    file: job.file,
    headers: job.headers || [],
    mapping: job.mapping || {},
    counts: job.counts || {},
    progress: job.progress || { total: 0, processed: 0 },
    lastRun: job.runs?.length ? job.runs[job.runs.length - 1] : null,
    runCount: job.runs?.length || 0,
    createdBy: job.createdBy?.name || '',
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
});

const serializeRow = (row, module, mapping) => {
    const raw = {};
    const values = {};
    module.fields.forEach((field) => {
        raw[field.key] = shownText(cellFor(row, field, mapping));
        // The value as it will be saved (trimmed, GSTIN in capitals, name filled from company...).
        values[field.key] = row.data && row.data[field.key] !== undefined ? shownText(row.data[field.key]) : raw[field.key];
    });
    return {
        rowNumber: row.rowNumber,
        status: row.status,
        action: row.action,
        matchLabel: row.matchLabel || '',
        issues: row.issues || [],
        error: row.error || '',
        values,
        raw,
        edited: module.fields.filter((field) => isEdited(row, field, mapping)).map((field) => field.key)
    };
};

const ROW_FILTERS = {
    ready: ['ready'],
    attention: ['attention', 'failed'],
    imported: ['imported'],
    excluded: ['excluded'],
    blank: ['blank'],
    all: ['ready', 'attention', 'failed', 'excluded', 'importing', 'imported']
};

const listRows = async (job, module, { filter = 'all', page = 1, limit = 50 } = {}) => {
    const statuses = ROW_FILTERS[filter] || ROW_FILTERS.all;
    const query = { jobId: job._id, status: { $in: statuses } };
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const [rows, total] = await Promise.all([
        ImportJobRow.find(query).sort({ rowNumber: 1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
        ImportJobRow.countDocuments(query)
    ]);
    return { rows: rows.map((row) => serializeRow(row, module, job.mapping)), total, page: safePage, limit: safeLimit };
};

module.exports = {
    ImportJobError,
    ImportFileError,
    autoMapColumns,
    sanitizeMapping,
    checkRowValues,
    createPreview,
    updateSettings,
    correctRows,
    applyCorrectionFile,
    exportRows,
    executeJob,
    reconcileIfStale,
    refreshCounts,
    listRows,
    serializeJob,
    describeModule,
    resolveParams,
    paramsKeyOf,
    allowedModes,
    ROW_FILTERS
};
