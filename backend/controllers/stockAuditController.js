const mongoose = require('mongoose');
const XLSX = require('xlsx');
const StockAuditBatch = require('../models/StockAuditBatch');
const StockAuditItem = require('../models/StockAuditItem');
const StockAuditLog = require('../models/StockAuditLog');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const { mergeUserPermissions, hasPermission } = require('../config/authorization');
const { getRolePermissions, toPlainObject } = require('../middlewares/permissionMiddleware');
const { isSuperAdminRole } = require('../middlewares/authMiddleware');
const { formatDate, formatDateTime } = require('../utils/dateFormat');

// Stock audit of SAP Business One stock. A batch holds the SAP book quantities of the items in
// scope (imported from an SAP B1 Excel export or sent by an integration as JSON), auditors
// record physical counts against them, and every mismatch is reviewed until it is resolved.
//
// Access is per batch: the creator and company admins manage it, auditors (by email) count
// and follow up mismatches, viewers (by email) only read. Creating a batch needs the
// 'inventory_sap_audit' permission.

const CREATE_PERMISSION = 'inventory_sap_audit';
const COUNTABLE = ['In Progress', 'Under Review'];
const SCOPE_EDITABLE = ['Draft', 'In Progress'];
const CLOSED = ['Completed', 'Cancelled'];
const OPEN_MISMATCH = ['Open', 'Under Review', 'Recount Requested'];
const MAX_IMPORT_ROWS = 20000;
const QTY_EPSILON = 0.0005;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const TYPE_PREFIX = { Perpetual: 'perpetual', 'Cycle Count': 'cycle', 'Full Physical': 'physical', 'Spot Check': 'spot' };
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _.\-()/&]{2,79}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();
const round = (value, digits) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};
const qty = (value) => round(value, 3);
const money = (value) => round(value, 2);
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isId = (value) => mongoose.Types.ObjectId.isValid(value);
const toDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};
// "1,234.50" from an Excel cell, a number, or blank (null).
const toNumber = (value) => {
    if (value === null || value === undefined || text(value) === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    const n = Number(text(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
};

const person = (req) => ({ userId: req.user.id, name: req.user.name || '', email: lower(req.user.email) });
const isAdminUser = (user) => ['admin', 'Admin'].includes(user?.role) || isSuperAdminRole(user?.role);

const fail = (res, status, message, extra = {}) => res.status(status).json({ message, ...extra });

const canCreateBatches = async (user) => {
    if (isAdminUser(user)) return true;
    const rolePermissions = await getRolePermissions(String(user.companyId), user.role);
    const permissions = mergeUserPermissions(user.role, rolePermissions, toPlainObject(user.customPermissions));
    return hasPermission(permissions, CREATE_PERMISSION, 'create');
};

// owner: creator and admins - settings, scope, access, status, resolving mismatches
// auditor: records counts and follows up mismatches; viewer: read only
const roleIn = (batch, user) => {
    if (isAdminUser(user)) return 'owner';
    if (batch.createdBy?.userId && String(batch.createdBy.userId) === String(user.id)) return 'owner';
    const email = lower(user.email);
    if (email && (batch.auditorEmails || []).includes(email)) return 'auditor';
    if (email && (batch.viewerEmails || []).includes(email)) return 'viewer';
    return null;
};

const capabilitiesOf = (role, batch) => ({
    role,
    canManage: role === 'owner' && !CLOSED.includes(batch.status),
    canManageAccess: role === 'owner',
    canEditScope: role === 'owner' && SCOPE_EDITABLE.includes(batch.status),
    canCount: ['owner', 'auditor'].includes(role) && COUNTABLE.includes(batch.status),
    canReview: ['owner', 'auditor'].includes(role) && COUNTABLE.includes(batch.status),
    canResolve: role === 'owner' && COUNTABLE.includes(batch.status),
    canChangeStatus: role === 'owner'
});

const visibleFilter = (user) => {
    if (isAdminUser(user)) return {};
    const email = lower(user.email);
    const or = [{ 'createdBy.userId': user.id }];
    if (email) or.push({ viewerEmails: email }, { auditorEmails: email });
    return { $or: or };
};

// Loads the batch the request names and the caller's role in it. Batches the caller cannot
// see answer 404, the same as batches that do not exist.
const loadBatch = async (req, res) => {
    if (!isId(req.params.id)) {
        fail(res, 404, 'Audit batch not found');
        return null;
    }
    const batch = await StockAuditBatch.findById(req.params.id);
    const role = batch ? roleIn(batch, req.user) : null;
    if (!batch || !role) {
        fail(res, 404, 'Audit batch not found');
        return null;
    }
    return { batch, role, can: capabilitiesOf(role, batch) };
};

const writeLog = (req, batch, action, { item = null, changes = [], note = '' } = {}) => StockAuditLog.create({
    companyId: batch.companyId,
    batchId: batch._id,
    itemId: item?._id || null,
    itemCode: item?.itemCode || '',
    action,
    changes,
    note,
    user: person(req),
    at: new Date()
});

// Field-by-field differences, for the audit trail.
const diff = (before, after, fields) => fields
    .filter(field => String(before[field] ?? '') !== String(after[field] ?? ''))
    .map(field => ({ field, from: before[field] ?? null, to: after[field] ?? null }));

// In-app notification for the portal users behind these emails. Written without a branch so
// it shows whichever branch the person is working in.
const notifyEmails = async (req, batch, emails, title, message) => {
    try {
        const list = [...new Set(emails.map(lower).filter(Boolean))].filter(e => e !== lower(req.user.email));
        if (!list.length) return;
        const users = await User.find({
            companyId: req.user.companyId,
            email: { $in: list.map(e => new RegExp(`^${escapeRegex(e)}$`, 'i')) }
        }).select('_id').lean();
        if (!users.length) return;
        const docs = users.map(u => {
            const doc = new Notification({ userId: u._id, companyId: req.user.companyId, title, message, type: 'StockAudit', relatedId: batch._id, branchId: null });
            doc.$locals.bypassBranch = true;
            return doc;
        });
        await Notification.insertMany(docs, { bypassBranch: true });
    } catch (error) {
        console.error('[StockAudit] Notification failed:', error.message);
    }
};

// ---------------------------------------------------------------------------------------------
// Batch names
// ---------------------------------------------------------------------------------------------

// perpetual_audit_22.OCT.2026 for today in India time.
const defaultName = (auditType) => {
    const d = new Date(Date.now() + 330 * 60000);
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${TYPE_PREFIX[auditType] || 'perpetual'}_audit_${day}.${MONTHS[d.getUTCMonth()]}.${d.getUTCFullYear()}`;
};

const nameTaken = async (name, exceptId = null) => {
    const filter = { nameKey: lower(name) };
    if (exceptId) filter._id = { $ne: exceptId };
    return Boolean(await StockAuditBatch.exists(filter));
};

// The name itself when free, else name_2, name_3 ...
const freeName = async (base) => {
    if (!(await nameTaken(base))) return base;
    const taken = await StockAuditBatch.find({ nameKey: new RegExp(`^${escapeRegex(lower(base))}_\\d+$`) }).select('nameKey').lean();
    const used = new Set(taken.map(b => b.nameKey));
    let n = 2;
    while (used.has(lower(`${base}_${n}`))) n += 1;
    return `${base}_${n}`;
};

const validateName = (name) => {
    if (!name) return 'Batch name is required.';
    if (!NAME_RE.test(name)) return 'Batch name must be 3-80 characters: letters, numbers, spaces and _ . - ( ) / &.';
    return null;
};

// ---------------------------------------------------------------------------------------------
// Lines: parsing SAP rows, computing results
// ---------------------------------------------------------------------------------------------

// Column names accepted for each field: our template, SAP B1 field names (OITW / OITM / OBIN /
// OBTN) and the captions SAP prints in its Inventory Status / Warehouse reports.
const FIELD_ALIASES = {
    itemCode: ['itemcode', 'itemno', 'itemnumber', 'item', 'sku', 'productcode', 'materialcode', 'code'],
    itemName: ['itemname', 'itemdescription', 'description', 'dscription', 'itemdesc', 'productname', 'name'],
    itemGroup: ['itemgroup', 'itmsgrpnam', 'groupname', 'group'],
    uom: ['uom', 'unit', 'inventoryuom', 'invntryuom', 'uomcode', 'unitofmeasure'],
    warehouseCode: ['warehousecode', 'whscode', 'whs', 'warehouse', 'warehouseno', 'location'],
    warehouseName: ['warehousename', 'whsname'],
    binLocation: ['binlocation', 'bincode', 'bin', 'binloc', 'rack', 'binrack'],
    batchNumber: ['batchnumber', 'batchnum', 'batch', 'distnumber', 'serialnumber', 'serial', 'batchserial', 'lotnumber', 'lot'],
    sapQty: ['sapqty', 'sapquantity', 'instock', 'onhand', 'bookqty', 'systemqty', 'stockqty', 'quantity', 'qty', 'stock'],
    unitPrice: ['unitprice', 'avgprice', 'averageprice', 'itemcost', 'unitcost', 'price', 'cost', 'rate'],
    sapValue: ['sapvalue', 'stockvalue', 'totalvalue', 'inventoryvalue', 'value', 'amount']
};
const headerKey = (header) => lower(header).replace(/[^a-z0-9]/g, '');
const ALIAS_LOOKUP = Object.entries(FIELD_ALIASES).reduce((map, [field, aliases]) => {
    [field.toLowerCase(), ...aliases].forEach(alias => { if (!map.has(alias)) map.set(alias, field); });
    return map;
}, new Map());

const lineKeyOf = (line) => [line.itemCode, line.warehouseCode, line.binLocation, line.batchNumber].map(lower).join('|');

// One SAP row (any of the accepted column names) as a line, or { error }.
const parseRow = (raw) => {
    const values = {};
    Object.entries(raw || {}).forEach(([header, value]) => {
        const field = ALIAS_LOOKUP.get(headerKey(header));
        if (field && (values[field] === undefined || text(values[field]) === '')) values[field] = value;
    });

    const line = {
        itemCode: text(values.itemCode),
        itemName: text(values.itemName),
        itemGroup: text(values.itemGroup),
        uom: text(values.uom),
        warehouseCode: text(values.warehouseCode),
        warehouseName: text(values.warehouseName),
        binLocation: text(values.binLocation),
        batchNumber: text(values.batchNumber)
    };
    if (!line.itemCode) return { error: 'Item code is missing' };

    const sapQty = toNumber(values.sapQty);
    if (sapQty === null) return { error: 'SAP quantity is missing' };
    if (Number.isNaN(sapQty)) return { error: `SAP quantity "${text(values.sapQty)}" is not a number` };

    let unitPrice = toNumber(values.unitPrice);
    const sapValue = toNumber(values.sapValue);
    if (Number.isNaN(unitPrice)) return { error: `Unit price "${text(values.unitPrice)}" is not a number` };
    if (Number.isNaN(sapValue)) return { error: `Stock value "${text(values.sapValue)}" is not a number` };
    if (unitPrice === null && sapValue !== null && sapQty) unitPrice = sapValue / sapQty;
    if (unitPrice !== null && unitPrice < 0) return { error: 'Unit price cannot be negative' };

    line.sapQty = qty(sapQty);
    line.unitPrice = round(unitPrice || 0, 4);
    line.sapValue = sapValue !== null && unitPrice === null ? money(sapValue) : money(line.sapQty * line.unitPrice);
    line.lineKey = lineKeyOf(line);
    return { line, hasPrice: unitPrice !== null };
};

// SAP data to refresh on an existing line: the quantity, and the other fields only where the
// row has a value, so a sheet without (say) a price column does not wipe the price.
const refreshFields = (line, hasPrice, current) => {
    const fields = { sapQty: line.sapQty };
    ['itemName', 'itemGroup', 'uom', 'warehouseName'].forEach(f => { if (line[f]) fields[f] = line[f]; });
    const unitPrice = hasPrice ? line.unitPrice : current.unitPrice || 0;
    if (hasPrice) fields.unitPrice = unitPrice;
    fields.sapValue = money(line.sapQty * unitPrice);
    return fields;
};

// Result of counting `countedQty` against the line's SAP quantity.
const countResult = (line, countedQty) => {
    if (countedQty === null) {
        return { countedQty: null, countedValue: null, varianceQty: null, varianceValue: null, absVarianceValue: 0, result: 'Pending' };
    }
    const varianceQty = qty(countedQty - line.sapQty);
    const varianceValue = money(varianceQty * (line.unitPrice || 0));
    let result = 'Matched';
    if (varianceQty < -QTY_EPSILON) result = 'Short';
    else if (varianceQty > QTY_EPSILON) result = 'Excess';
    return {
        countedQty: qty(countedQty),
        countedValue: money(countedQty * (line.unitPrice || 0)),
        varianceQty: result === 'Matched' ? 0 : varianceQty,
        varianceValue: result === 'Matched' ? 0 : varianceValue,
        absVarianceValue: result === 'Matched' ? 0 : Math.abs(varianceValue),
        result
    };
};

// ---------------------------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------------------------

const SUMMARY_GROUP = {
    lines: { $sum: 1 },
    counted: { $sum: { $cond: [{ $ne: ['$result', 'Pending'] }, 1, 0] } },
    matched: { $sum: { $cond: [{ $eq: ['$result', 'Matched'] }, 1, 0] } },
    short: { $sum: { $cond: [{ $eq: ['$result', 'Short'] }, 1, 0] } },
    excess: { $sum: { $cond: [{ $eq: ['$result', 'Excess'] }, 1, 0] } },
    openMismatches: { $sum: { $cond: [{ $in: ['$mismatch.status', OPEN_MISMATCH] }, 1, 0] } },
    recountRequested: { $sum: { $cond: [{ $eq: ['$mismatch.status', 'Recount Requested'] }, 1, 0] } },
    resolvedMismatches: { $sum: { $cond: [{ $eq: ['$mismatch.status', 'Resolved'] }, 1, 0] } },
    sapQty: { $sum: '$sapQty' },
    countedQty: { $sum: { $ifNull: ['$countedQty', 0] } },
    sapValue: { $sum: '$sapValue' },
    countedSapValue: { $sum: { $cond: [{ $ne: ['$result', 'Pending'] }, '$sapValue', 0] } },
    countedValue: { $sum: { $ifNull: ['$countedValue', 0] } },
    varianceValue: { $sum: { $ifNull: ['$varianceValue', 0] } },
    shortValue: { $sum: { $cond: [{ $eq: ['$result', 'Short'] }, { $ifNull: ['$varianceValue', 0] }, 0] } },
    excessValue: { $sum: { $cond: [{ $eq: ['$result', 'Excess'] }, { $ifNull: ['$varianceValue', 0] }, 0] } },
    shortQty: { $sum: { $cond: [{ $eq: ['$result', 'Short'] }, { $ifNull: ['$varianceQty', 0] }, 0] } },
    excessQty: { $sum: { $cond: [{ $eq: ['$result', 'Excess'] }, { $ifNull: ['$varianceQty', 0] }, 0] } }
};

const finishSummary = (row = {}) => {
    const lines = row.lines || 0;
    const counted = row.counted || 0;
    const mismatched = (row.short || 0) + (row.excess || 0);
    return {
        lines,
        counted,
        pending: lines - counted,
        matched: row.matched || 0,
        short: row.short || 0,
        excess: row.excess || 0,
        mismatched,
        openMismatches: row.openMismatches || 0,
        recountRequested: row.recountRequested || 0,
        resolvedMismatches: row.resolvedMismatches || 0,
        progressPct: lines ? round((counted / lines) * 100, 1) : 0,
        accuracyPct: counted ? round(((row.matched || 0) / counted) * 100, 1) : null,
        sapQty: qty(row.sapQty),
        countedQty: qty(row.countedQty),
        shortQty: qty(row.shortQty),
        excessQty: qty(row.excessQty),
        sapValue: money(row.sapValue),
        countedSapValue: money(row.countedSapValue),
        countedValue: money(row.countedValue),
        varianceValue: money(row.varianceValue),
        shortValue: money(row.shortValue),
        excessValue: money(row.excessValue),
        grossVarianceValue: money(Math.abs(row.shortValue || 0) + Math.abs(row.excessValue || 0))
    };
};

const summariesFor = async (batchIds) => {
    if (!batchIds.length) return new Map();
    const rows = await StockAuditItem.aggregate([
        { $match: { batchId: { $in: batchIds.map(id => new mongoose.Types.ObjectId(String(id))) } } },
        { $group: { _id: '$batchId', ...SUMMARY_GROUP } }
    ]);
    return new Map(rows.map(r => [String(r._id), finishSummary(r)]));
};

const summaryOf = async (batchId) => (await summariesFor([batchId])).get(String(batchId)) || finishSummary();

const batchView = (batch, role, summary) => {
    const obj = batch.toObject ? batch.toObject() : batch;
    return { ...obj, access: capabilitiesOf(role, obj), summary };
};

// ---------------------------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------------------------

exports.getMeta = async (req, res) => {
    try {
        res.json({
            canCreate: await canCreateBatches(req.user),
            auditTypes: StockAuditBatch.AUDIT_TYPES,
            statuses: StockAuditBatch.BATCH_STATUSES,
            conditions: StockAuditItem.CONDITIONS.filter(Boolean),
            mismatchStatuses: StockAuditItem.MISMATCH_STATUSES.filter(Boolean),
            resolutions: StockAuditItem.RESOLUTIONS.filter(Boolean),
            columns: Object.keys(FIELD_ALIASES)
        });
    } catch (error) {
        fail(res, 500, 'Error loading stock audit settings: ' + error.message);
    }
};

// Batches the caller can open that are still running (for the sidebar entry).
exports.getAssignedCount = async (req, res) => {
    try {
        const count = await StockAuditBatch.countDocuments({ ...visibleFilter(req.user), status: { $nin: ['Cancelled'] } });
        res.json({ count });
    } catch (error) {
        fail(res, 500, 'Error counting audit batches: ' + error.message);
    }
};

exports.checkName = async (req, res) => {
    try {
        const auditType = StockAuditBatch.AUDIT_TYPES.includes(req.query.auditType) ? req.query.auditType : 'Perpetual';
        const name = text(req.query.name) || defaultName(auditType);
        const exceptId = isId(req.query.exceptId) ? req.query.exceptId : null;
        const invalid = validateName(name);
        const available = !invalid && !(await nameTaken(name, exceptId));
        res.json({
            name,
            available,
            message: invalid || (available ? '' : 'A batch with this name already exists.'),
            suggestion: available ? name : await freeName(invalid ? defaultName(auditType) : name)
        });
    } catch (error) {
        fail(res, 500, 'Error checking batch name: ' + error.message);
    }
};

exports.getBatches = async (req, res) => {
    try {
        const filter = { ...visibleFilter(req.user) };
        if (StockAuditBatch.BATCH_STATUSES.includes(req.query.status)) filter.status = req.query.status;
        const search = text(req.query.search);
        if (search) {
            const regex = new RegExp(escapeRegex(search), 'i');
            filter.$and = [{ $or: [{ name: regex }, { description: regex }, { sapReference: regex }, { 'createdBy.name': regex }] }];
        }
        const batches = await StockAuditBatch.find(filter).sort({ createdAt: -1 }).limit(500).lean();
        const summaries = await summariesFor(batches.map(b => b._id));
        res.json(batches.map(b => batchView(b, roleIn(b, req.user), summaries.get(String(b._id)) || finishSummary())));
    } catch (error) {
        fail(res, 500, 'Error loading audit batches: ' + error.message);
    }
};

exports.getBatch = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        res.json(batchView(ctx.batch, ctx.role, await summaryOf(ctx.batch._id)));
    } catch (error) {
        fail(res, 500, 'Error loading audit batch: ' + error.message);
    }
};

// Emails from a list or a comma / semicolon / newline separated string. Returns { emails, invalid }.
const parseEmails = (input) => {
    const parts = Array.isArray(input) ? input : String(input || '').split(/[\s,;]+/);
    const emails = [];
    const invalid = [];
    parts.map(lower).filter(Boolean).forEach(e => {
        if (!EMAIL_RE.test(e)) invalid.push(e);
        else if (!emails.includes(e)) emails.push(e);
    });
    return { emails, invalid };
};

// Viewer and auditor lists from the request; someone in both lists is an auditor.
const accessFromBody = (body) => {
    const viewers = parseEmails(body.viewerEmails);
    const auditors = parseEmails(body.auditorEmails);
    const invalid = [...viewers.invalid, ...auditors.invalid];
    return {
        invalid,
        auditorEmails: auditors.emails,
        viewerEmails: viewers.emails.filter(e => !auditors.emails.includes(e))
    };
};

const BATCH_FIELDS = ['name', 'auditType', 'description', 'sapReference', 'sapSnapshotAt', 'plannedStart', 'plannedEnd'];

const batchFieldsFromBody = (body) => ({
    name: text(body.name),
    auditType: StockAuditBatch.AUDIT_TYPES.includes(body.auditType) ? body.auditType : 'Perpetual',
    description: text(body.description),
    sapReference: text(body.sapReference),
    sapSnapshotAt: toDate(body.sapSnapshotAt),
    plannedStart: toDate(body.plannedStart),
    plannedEnd: toDate(body.plannedEnd)
});

const validateBatchFields = (fields) => {
    const nameError = validateName(fields.name);
    if (nameError) return nameError;
    if (fields.plannedStart && fields.plannedEnd && fields.plannedEnd < fields.plannedStart) {
        return 'Planned end date cannot be before the planned start date.';
    }
    return null;
};

const isDuplicateKeyError = (error) => error?.code === 11000;

exports.createBatch = async (req, res) => {
    try {
        if (!(await canCreateBatches(req.user))) {
            return fail(res, 403, `Access denied. Requires '${CREATE_PERMISSION}' permission.`);
        }
        const fields = batchFieldsFromBody(req.body || {});
        const invalidField = validateBatchFields(fields);
        if (invalidField) return fail(res, 400, invalidField);
        if (await nameTaken(fields.name)) {
            return fail(res, 409, `A batch named "${fields.name}" already exists.`, { suggestion: await freeName(fields.name) });
        }
        const access = accessFromBody(req.body || {});
        if (access.invalid.length) return fail(res, 400, `Invalid email address: ${access.invalid.join(', ')}`);

        let batch;
        try {
            batch = await StockAuditBatch.create({
                ...fields,
                nameKey: lower(fields.name),
                viewerEmails: access.viewerEmails,
                auditorEmails: access.auditorEmails,
                createdBy: person(req)
            });
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                return fail(res, 409, `A batch named "${fields.name}" already exists.`, { suggestion: await freeName(fields.name) });
            }
            throw error;
        }

        await writeLog(req, batch, 'Batch created', {
            note: [
                `Type: ${batch.auditType}`,
                access.auditorEmails.length ? `Auditors: ${access.auditorEmails.join(', ')}` : '',
                access.viewerEmails.length ? `Viewers: ${access.viewerEmails.join(', ')}` : ''
            ].filter(Boolean).join('\n')
        });
        await notifyEmails(req, batch, access.auditorEmails, 'Stock audit assigned',
            `${req.user.name || 'A colleague'} added you as an auditor on stock audit batch "${batch.name}".`);
        await notifyEmails(req, batch, access.viewerEmails, 'Stock audit shared',
            `${req.user.name || 'A colleague'} shared stock audit batch "${batch.name}" with you (view only).`);

        res.status(201).json(batchView(batch, 'owner', finishSummary()));
    } catch (error) {
        fail(res, 500, 'Error creating audit batch: ' + error.message);
    }
};

exports.updateBatch = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch, can } = ctx;
        if (!can.canManage) return fail(res, 403, 'Only the batch owner can edit an open batch.');

        const fields = batchFieldsFromBody({ ...batch.toObject(), ...req.body });
        const invalidField = validateBatchFields(fields);
        if (invalidField) return fail(res, 400, invalidField);
        if (lower(fields.name) !== batch.nameKey && await nameTaken(fields.name, batch._id)) {
            return fail(res, 409, `A batch named "${fields.name}" already exists.`, { suggestion: await freeName(fields.name) });
        }

        const before = batch.toObject();
        Object.assign(batch, fields, { nameKey: lower(fields.name) });
        try {
            await batch.save();
        } catch (error) {
            if (isDuplicateKeyError(error)) return fail(res, 409, `A batch named "${fields.name}" already exists.`);
            throw error;
        }
        const changes = diff(before, batch.toObject(), BATCH_FIELDS);
        if (changes.length) await writeLog(req, batch, 'Batch details updated', { changes });
        res.json(batchView(batch, ctx.role, await summaryOf(batch._id)));
    } catch (error) {
        fail(res, 500, 'Error updating audit batch: ' + error.message);
    }
};

// Viewer / auditor emails with the portal account (if any) behind each.
exports.getAccess = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch } = ctx;
        const emails = [...batch.auditorEmails, ...batch.viewerEmails];
        const users = emails.length
            ? await User.find({ companyId: req.user.companyId, email: { $in: emails.map(e => new RegExp(`^${escapeRegex(e)}$`, 'i')) } })
                .select('name email role').lean()
            : [];
        const byEmail = new Map(users.map(u => [lower(u.email), u]));
        const member = (email, role) => ({ email, role, name: byEmail.get(email)?.name || '', hasAccount: byEmail.has(email) });
        res.json({
            owner: batch.createdBy,
            members: [
                ...batch.auditorEmails.map(e => member(e, 'auditor')),
                ...batch.viewerEmails.map(e => member(e, 'viewer'))
            ]
        });
    } catch (error) {
        fail(res, 500, 'Error loading batch access: ' + error.message);
    }
};

exports.updateAccess = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch, can } = ctx;
        if (!can.canManageAccess) return fail(res, 403, 'Only the batch owner can change who has access.');

        const access = accessFromBody(req.body || {});
        if (access.invalid.length) return fail(res, 400, `Invalid email address: ${access.invalid.join(', ')}`);

        const added = (next, prev) => next.filter(e => !prev.includes(e));
        const removed = (next, prev) => prev.filter(e => !next.includes(e));
        const changes = [];
        const record = (field, prev, next) => {
            added(next, prev).forEach(e => changes.push({ field, from: null, to: e }));
            removed(next, prev).forEach(e => changes.push({ field, from: e, to: null }));
        };
        const prevAuditors = [...batch.auditorEmails];
        const prevViewers = [...batch.viewerEmails];
        record('auditor', prevAuditors, access.auditorEmails);
        record('viewer', prevViewers, access.viewerEmails);

        batch.auditorEmails = access.auditorEmails;
        batch.viewerEmails = access.viewerEmails;
        await batch.save();

        if (changes.length) {
            await writeLog(req, batch, 'Access updated', { changes });
            await notifyEmails(req, batch, added(access.auditorEmails, prevAuditors), 'Stock audit assigned',
                `${req.user.name || 'A colleague'} added you as an auditor on stock audit batch "${batch.name}".`);
            await notifyEmails(req, batch, added(access.viewerEmails, [...prevViewers, ...prevAuditors]), 'Stock audit shared',
                `${req.user.name || 'A colleague'} shared stock audit batch "${batch.name}" with you (view only).`);
        }
        return exports.getAccess(req, res);
    } catch (error) {
        fail(res, 500, 'Error updating batch access: ' + error.message);
    }
};

// Portal users of the company, for picking people to share a batch with.
exports.searchUsers = async (req, res) => {
    try {
        if (!(await canCreateBatches(req.user))) return res.json([]);
        const search = text(req.query.search);
        const filter = { companyId: req.user.companyId, role: { $nin: ['vendor', 'SUPER_ADMIN', 'super_admin'] } };
        if (search) {
            const regex = new RegExp(escapeRegex(search), 'i');
            filter.$or = [{ name: regex }, { email: regex }];
        }
        const users = await User.find(filter).select('name email').sort({ name: 1 }).limit(20).lean();
        res.json(users.map(u => ({ name: u.name, email: lower(u.email) })));
    } catch (error) {
        fail(res, 500, 'Error searching users: ' + error.message);
    }
};

const STATUS_ACTIONS = {
    start: { from: ['Draft'], to: 'In Progress', label: 'Audit started' },
    submit: { from: ['In Progress'], to: 'Under Review', label: 'Counting submitted for review' },
    complete: { from: ['Under Review'], to: 'Completed', label: 'Audit completed' },
    reopen: { from: ['Under Review', 'Completed'], to: 'In Progress', label: 'Audit reopened', needsReason: true },
    cancel: { from: ['Draft', 'In Progress', 'Under Review'], to: 'Cancelled', label: 'Audit cancelled', needsReason: true }
};

exports.changeStatus = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch, can } = ctx;
        if (!can.canChangeStatus) return fail(res, 403, 'Only the batch owner can change the batch status.');

        const action = STATUS_ACTIONS[req.body?.action];
        if (!action) return fail(res, 400, 'Unknown action.');
        if (!action.from.includes(batch.status)) {
            return fail(res, 400, `A batch that is ${batch.status} cannot be moved to ${action.to}.`);
        }
        const reason = text(req.body?.reason);
        if (action.needsReason && !reason) return fail(res, 400, 'Please give a reason.');

        const summary = await summaryOf(batch._id);
        if (req.body.action === 'start' && !summary.lines) {
            return fail(res, 400, 'Add the items to audit (import the SAP stock) before starting.');
        }
        if (['submit', 'complete'].includes(req.body.action) && summary.pending) {
            return fail(res, 400, `${summary.pending} line${summary.pending > 1 ? 's are' : ' is'} not counted yet.`);
        }
        if (req.body.action === 'complete' && summary.openMismatches) {
            return fail(res, 400, `${summary.openMismatches} mismatch${summary.openMismatches > 1 ? 'es are' : ' is'} not resolved yet.`);
        }

        const from = batch.status;
        const now = new Date();
        batch.status = action.to;
        batch.statusReason = reason;
        if (req.body.action === 'start') batch.startedAt = batch.startedAt || now;
        if (req.body.action === 'submit') batch.submittedAt = now;
        if (req.body.action === 'complete') {
            batch.completedAt = now;
            batch.completedBy = person(req);
        }
        if (req.body.action === 'reopen') {
            batch.completedAt = null;
            batch.completedBy = null;
        }
        if (req.body.action === 'cancel') batch.cancelledAt = now;
        await batch.save();

        await writeLog(req, batch, action.label, { changes: [{ field: 'status', from, to: action.to }], note: reason });
        if (req.body.action === 'start') {
            await notifyEmails(req, batch, batch.auditorEmails, 'Stock audit started',
                `Counting is open on stock audit batch "${batch.name}" (${summary.lines} lines).`);
        }
        res.json(batchView(batch, ctx.role, summary));
    } catch (error) {
        fail(res, 500, 'Error changing batch status: ' + error.message);
    }
};

exports.deleteBatch = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch, role } = ctx;
        if (role !== 'owner') return fail(res, 403, 'Only the batch owner can delete a batch.');
        if (batch.status !== 'Draft') return fail(res, 400, 'Only a Draft batch can be deleted. Cancel it instead.');
        if (await StockAuditItem.exists({ batchId: batch._id, result: { $ne: 'Pending' } })) {
            return fail(res, 400, 'This batch has counts recorded. Cancel it instead.');
        }
        await StockAuditItem.deleteMany({ batchId: batch._id });
        await StockAuditLog.deleteMany({ batchId: batch._id });
        await batch.deleteOne();
        res.json({ message: 'Batch deleted' });
    } catch (error) {
        fail(res, 500, 'Error deleting audit batch: ' + error.message);
    }
};

// ---------------------------------------------------------------------------------------------
// Scope (lines)
// ---------------------------------------------------------------------------------------------

const productIdsByCode = async (codes) => {
    const unique = [...new Set(codes.filter(Boolean))];
    if (!unique.length) return new Map();
    const products = await Product.find({ productCode: { $in: unique } }).select('_id productCode').lean();
    return new Map(products.map(p => [lower(p.productCode), p._id]));
};

/**
 * Adds SAP stock lines to a batch. Body: { rows: [...], mode, fileName, source }
 *   rows  - objects keyed by column name (SAP B1 export headers or our template). Each row may
 *           carry `_row`, its row number in the sheet, for error messages.
 *   mode  - append: add new lines, skip ones already in the batch (default)
 *           update: also refresh SAP data on existing lines that are not counted yet
 *           replace: remove every line first (only while nothing is counted)
 *   dryRun - true: report what the import would do, with the columns recognised and the
 *           first lines as read, without changing anything
 */
exports.importItems = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch, can } = ctx;
        if (!can.canEditScope) return fail(res, 403, 'Items can be added only by the batch owner while the batch is Draft or In Progress.');

        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const mode = ['append', 'update', 'replace'].includes(req.body?.mode) ? req.body.mode : 'append';
        const dryRun = req.body?.dryRun === true;
        if (!rows.length) return fail(res, 400, 'No rows to import.');
        if (rows.length > MAX_IMPORT_ROWS) return fail(res, 400, `At most ${MAX_IMPORT_ROWS} rows can be imported at a time.`);

        if (mode === 'replace' && await StockAuditItem.exists({ batchId: batch._id, result: { $ne: 'Pending' } })) {
            return fail(res, 400, 'Counts are already recorded in this batch, so its lines cannot be replaced. Use append or update.');
        }

        const errors = [];
        const seen = new Set();
        const lines = [];
        rows.forEach((raw, index) => {
            const rowNo = Number(raw?._row) || index + 2;
            const { line, hasPrice, error } = parseRow(raw);
            if (error) return errors.push({ row: rowNo, message: error });
            if (seen.has(line.lineKey)) {
                return errors.push({ row: rowNo, message: `Duplicate of an earlier row (${line.itemCode}${line.warehouseCode ? ` @ ${line.warehouseCode}` : ''})` });
            }
            seen.add(line.lineKey);
            lines.push({ ...line, rowNo, hasPrice });
        });
        const recognised = [...new Set(rows.slice(0, 50).flatMap(r => Object.keys(r || {}))
            .map(h => ALIAS_LOOKUP.get(headerKey(h))).filter(Boolean))];
        if (!lines.length) {
            return fail(res, 400, 'None of the rows could be imported.', { errors: errors.slice(0, 500), columns: recognised });
        }
        if (mode === 'replace' && !dryRun) await StockAuditItem.deleteMany({ batchId: batch._id });

        const existing = mode === 'replace' ? [] : await StockAuditItem.find({ batchId: batch._id, lineKey: { $in: lines.map(l => l.lineKey) } })
            .select('lineKey result sapQty unitPrice countedQty')
            .lean();
        const existingByKey = new Map(existing.map(e => [e.lineKey, e]));
        const productIds = await productIdsByCode(lines.map(l => lower(l.itemCode)));
        const last = await StockAuditItem.findOne({ batchId: batch._id }).sort({ lineNo: -1 }).select('lineNo').lean();
        let lineNo = last?.lineNo || 0;

        const inserts = [];
        const updates = [];
        let skipped = 0;
        lines.forEach(line => {
            const { rowNo, hasPrice, ...data } = line;
            const productId = productIds.get(lower(line.itemCode)) || null;
            const current = existingByKey.get(line.lineKey);
            if (!current) {
                lineNo += 1;
                inserts.push({ ...data, productId, lineNo, batchId: batch._id, companyId: batch.companyId });
                return;
            }
            if (mode !== 'update') {
                skipped += 1;
                return errors.push({ row: rowNo, message: `Already in this batch (${line.itemCode}) - skipped`, skipped: true });
            }
            if (current.result !== 'Pending') {
                skipped += 1;
                return errors.push({ row: rowNo, message: `Already counted (${line.itemCode}) - SAP data not changed`, skipped: true });
            }
            const fields = refreshFields(data, hasPrice, current);
            if (productId) fields.productId = productId;
            updates.push({ updateOne: { filter: { _id: current._id, result: 'Pending' }, update: { $set: fields, $inc: { version: 1 } } } });
        });

        const failed = errors.filter(e => !e.skipped).length;
        if (dryRun) {
            return res.json({
                dryRun: true,
                columns: recognised,
                added: inserts.length,
                updated: updates.length,
                skipped,
                rejected: failed,
                replaces: mode === 'replace' ? await StockAuditItem.countDocuments({ batchId: batch._id }) : 0,
                errors: errors.slice(0, 500),
                sample: lines.slice(0, 8).map(({ rowNo, lineKey, hasPrice, ...line }) => ({ row: rowNo, ...line }))
            });
        }

        if (inserts.length) await StockAuditItem.insertMany(inserts, { ordered: false });
        if (updates.length) await StockAuditItem.bulkWrite(updates, { ordered: false });

        const source = req.body?.source === 'API' ? 'API' : 'Excel';
        if (inserts.length || updates.length) {
            batch.scopeSource = batch.scopeSource && batch.scopeSource !== source ? batch.scopeSource : source;
            if (req.body?.sapSnapshotAt && toDate(req.body.sapSnapshotAt)) batch.sapSnapshotAt = toDate(req.body.sapSnapshotAt);
            await batch.save();
        }
        await writeLog(req, batch, mode === 'replace' ? 'Scope replaced' : 'Items imported', {
            note: [
                text(req.body?.fileName) && `File: ${text(req.body.fileName)}`,
                `${inserts.length} added`,
                updates.length && `${updates.length} updated`,
                skipped && `${skipped} skipped`,
                failed && `${failed} rejected`
            ].filter(Boolean).join(' · ')
        });

        res.json({
            added: inserts.length,
            updated: updates.length,
            skipped,
            rejected: failed,
            errors: errors.slice(0, 500),
            summary: await summaryOf(batch._id)
        });
    } catch (error) {
        fail(res, 500, 'Error importing items: ' + error.message);
    }
};

exports.addItem = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch, can } = ctx;
        if (!can.canEditScope) return fail(res, 403, 'Items can be added only by the batch owner while the batch is Draft or In Progress.');

        const { line, error } = parseRow(req.body || {});
        if (error) return fail(res, 400, error);
        if (await StockAuditItem.exists({ batchId: batch._id, lineKey: line.lineKey })) {
            return fail(res, 409, 'This item (same warehouse, bin and batch) is already in the batch.');
        }
        const last = await StockAuditItem.findOne({ batchId: batch._id }).sort({ lineNo: -1 }).select('lineNo').lean();
        const productIds = await productIdsByCode([lower(line.itemCode)]);
        const item = await StockAuditItem.create({
            ...line,
            productId: productIds.get(lower(line.itemCode)) || null,
            lineNo: (last?.lineNo || 0) + 1,
            batchId: batch._id,
            companyId: batch.companyId
        });
        if (!batch.scopeSource) {
            batch.scopeSource = 'Manual';
            await batch.save();
        }
        await writeLog(req, batch, 'Item added', { item, note: `SAP qty ${item.sapQty}${item.uom ? ` ${item.uom}` : ''}` });
        res.status(201).json(item);
    } catch (error) {
        if (isDuplicateKeyError(error)) return fail(res, 409, 'This item (same warehouse, bin and batch) is already in the batch.');
        fail(res, 500, 'Error adding item: ' + error.message);
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch, can } = ctx;
        if (!can.canEditScope) return fail(res, 403, 'Items can be removed only by the batch owner while the batch is Draft or In Progress.');
        if (!isId(req.params.itemId)) return fail(res, 404, 'Line not found');
        const item = await StockAuditItem.findOne({ _id: req.params.itemId, batchId: batch._id });
        if (!item) return fail(res, 404, 'Line not found');
        if (item.result !== 'Pending') return fail(res, 400, 'This line has a count recorded, so it cannot be removed.');
        await item.deleteOne();
        await writeLog(req, batch, 'Item removed', { item, note: `${item.itemName || ''} · SAP qty ${item.sapQty}`.trim() });
        res.json({ message: 'Line removed' });
    } catch (error) {
        fail(res, 500, 'Error removing item: ' + error.message);
    }
};

const ITEM_FILTERS = {
    pending: { result: 'Pending' },
    counted: { result: { $ne: 'Pending' } },
    matched: { result: 'Matched' },
    mismatched: { result: { $in: ['Short', 'Excess'] } },
    short: { result: 'Short' },
    excess: { result: 'Excess' },
    open: { 'mismatch.status': { $in: OPEN_MISMATCH } },
    recount: { 'mismatch.status': 'Recount Requested' },
    resolved: { 'mismatch.status': 'Resolved' },
    // Everything that ever needed a decision: mismatches still open or already resolved.
    review: { 'mismatch.status': { $in: [...OPEN_MISMATCH, 'Resolved'] } }
};
const ITEM_SORTS = {
    line: { lineNo: 1 },
    code: { itemCode: 1, lineNo: 1 },
    variance: { absVarianceValue: -1, lineNo: 1 },
    recent: { countedAt: -1, lineNo: 1 },
    location: { warehouseCode: 1, binLocation: 1, itemCode: 1 }
};

const itemFilter = (batchId, query) => {
    const filter = { batchId, ...(ITEM_FILTERS[query.filter] || {}) };
    if (text(query.warehouse)) filter.warehouseCode = text(query.warehouse);
    if (text(query.condition)) filter.condition = text(query.condition);
    if (text(query.countedBy)) filter['countedBy.email'] = lower(query.countedBy);
    const search = text(query.search);
    if (search) {
        const regex = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ itemCode: regex }, { itemName: regex }, { binLocation: regex }, { batchNumber: regex }, { itemGroup: regex }];
    }
    return filter;
};

exports.getItems = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch } = ctx;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const filter = itemFilter(batch._id, req.query);
        const [items, total, warehouses] = await Promise.all([
            StockAuditItem.find(filter).sort(ITEM_SORTS[req.query.sort] || ITEM_SORTS.line).skip((page - 1) * limit).limit(limit).lean(),
            StockAuditItem.countDocuments(filter),
            StockAuditItem.distinct('warehouseCode', { batchId: batch._id })
        ]);
        res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), warehouses: warehouses.filter(Boolean).sort() });
    } catch (error) {
        fail(res, 500, 'Error loading audit lines: ' + error.message);
    }
};

const COUNT_FIELDS = ['countedQty', 'condition', 'foundLocation', 'remarks', 'result'];

// Records (or corrects, or clears with countedQty: null) the physical count of one line.
exports.recordCount = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch, can } = ctx;
        if (!can.canCount) {
            return fail(res, 403, COUNTABLE.includes(batch.status)
                ? 'You have view-only access to this batch.'
                : `Counting is closed: the batch is ${batch.status}.`);
        }
        if (!isId(req.params.itemId)) return fail(res, 404, 'Line not found');
        const item = await StockAuditItem.findOne({ _id: req.params.itemId, batchId: batch._id }).lean();
        if (!item) return fail(res, 404, 'Line not found');

        const body = req.body || {};
        if (body.version !== undefined && Number(body.version) !== item.version) {
            return fail(res, 409, `This line was changed by ${item.countedBy?.name || 'someone else'} meanwhile. Check the latest count and save again.`, { item });
        }

        const condition = body.condition !== undefined ? text(body.condition) : item.condition;
        if (!StockAuditItem.CONDITIONS.includes(condition)) return fail(res, 400, 'Unknown condition.');
        let countedQty = body.countedQty !== undefined ? toNumber(body.countedQty) : item.countedQty;
        if (countedQty === null && condition === 'Not Found' && body.countedQty !== undefined) countedQty = 0;
        if (Number.isNaN(countedQty)) return fail(res, 400, 'Counted quantity must be a number.');
        if (countedQty !== null && countedQty < 0) return fail(res, 400, 'Counted quantity cannot be negative.');

        const counted = countResult(item, countedQty);
        const qtyChanged = String(item.countedQty ?? '') !== String(counted.countedQty ?? '');
        const now = new Date();
        const by = person(req);
        const set = {
            ...counted,
            condition,
            foundLocation: body.foundLocation !== undefined ? text(body.foundLocation) : item.foundLocation,
            remarks: body.remarks !== undefined ? text(body.remarks) : item.remarks
        };
        if (qtyChanged) {
            set.countedBy = counted.result === 'Pending' ? null : by;
            set.countedAt = counted.result === 'Pending' ? null : now;
        }

        // A changed count moves the mismatch along: a new or recounted discrepancy is (re)opened,
        // a recount that now agrees with SAP closes it.
        const mismatch = { ...(item.mismatch || {}), followUps: [...(item.mismatch?.followUps || [])] };
        const mismatchBefore = mismatch.status || '';
        if (qtyChanged) {
            if (['Short', 'Excess'].includes(counted.result)) {
                if (!mismatch.status || mismatch.status === 'Resolved') {
                    if (mismatch.status === 'Resolved') {
                        mismatch.followUps.push({ note: `Count changed to ${counted.countedQty} (SAP ${item.sapQty}) after resolution - reopened.`, status: 'Open', by, at: now });
                    }
                    Object.assign(mismatch, { status: 'Open', raisedAt: now, resolution: '', resolutionNote: '', resolvedAt: null, resolvedBy: null });
                } else {
                    if (mismatch.status === 'Recount Requested') mismatch.status = 'Under Review';
                    mismatch.followUps.push({ note: `Recounted: ${counted.countedQty} (SAP ${item.sapQty}) - still ${counted.result.toLowerCase()}.`, status: mismatch.status, by, at: now });
                }
            } else if (OPEN_MISMATCH.includes(mismatch.status)) {
                if (counted.result === 'Matched') {
                    const note = `Recounted: ${counted.countedQty} matches SAP.`;
                    Object.assign(mismatch, { status: 'Resolved', resolution: 'Recount Matched', resolutionNote: note, resolvedAt: now, resolvedBy: by });
                    mismatch.followUps.push({ note, status: 'Resolved', by, at: now });
                } else {
                    mismatch.followUps.push({ note: 'Count cleared for a recount.', status: mismatch.status, by, at: now });
                }
            }
        }
        set.mismatch = mismatch;

        const update = { $set: set, $inc: { version: 1 } };
        if (qtyChanged && counted.result !== 'Pending') update.$inc.countRounds = 1;
        const saved = await StockAuditItem.findOneAndUpdate({ _id: item._id, version: item.version }, update, { new: true }).lean();
        if (!saved) {
            const latest = await StockAuditItem.findById(item._id).lean();
            return fail(res, 409, 'This line was changed by someone else meanwhile. Check the latest count and save again.', { item: latest });
        }

        const changes = diff(item, saved, COUNT_FIELDS);
        if (mismatchBefore !== (saved.mismatch?.status || '')) {
            changes.push({ field: 'mismatch', from: mismatchBefore || null, to: saved.mismatch?.status || null });
        }
        if (changes.length) {
            let action = 'Count updated';
            if (item.countedQty === null && saved.countedQty !== null) action = 'Count recorded';
            else if (saved.countedQty === null && item.countedQty !== null) action = 'Count cleared';
            else if (!qtyChanged) action = 'Audit details updated';
            await writeLog(req, batch, action, { item: saved, changes });
        }
        res.json(saved);
    } catch (error) {
        fail(res, 500, 'Error recording count: ' + error.message);
    }
};

const MISMATCH_FIELDS = ['status', 'rootCause', 'ownerEmail', 'resolution', 'resolutionNote', 'sapDocRef'];

// Review and follow-up of a discrepancy: status, root cause, owner, resolution and notes.
exports.updateMismatch = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch, can } = ctx;
        if (!can.canReview) {
            return fail(res, 403, COUNTABLE.includes(batch.status)
                ? 'You have view-only access to this batch.'
                : `Mismatch review is closed: the batch is ${batch.status}.`);
        }
        if (!isId(req.params.itemId)) return fail(res, 404, 'Line not found');
        const item = await StockAuditItem.findOne({ _id: req.params.itemId, batchId: batch._id }).lean();
        if (!item) return fail(res, 404, 'Line not found');
        const before = item.mismatch || {};
        if (!['Short', 'Excess'].includes(item.result) && !before.status) {
            return fail(res, 400, 'This line has no mismatch to review.');
        }

        const body = req.body || {};
        if (body.version !== undefined && Number(body.version) !== item.version) {
            return fail(res, 409, 'This line was changed by someone else meanwhile. Reload it and try again.', { item });
        }

        const next = {
            status: body.status !== undefined ? text(body.status) : before.status,
            rootCause: body.rootCause !== undefined ? text(body.rootCause) : before.rootCause || '',
            ownerEmail: body.ownerEmail !== undefined ? lower(body.ownerEmail) : before.ownerEmail || '',
            resolution: body.resolution !== undefined ? text(body.resolution) : before.resolution || '',
            resolutionNote: body.resolutionNote !== undefined ? text(body.resolutionNote) : before.resolutionNote || '',
            sapDocRef: body.sapDocRef !== undefined ? text(body.sapDocRef) : before.sapDocRef || ''
        };
        if (!StockAuditItem.MISMATCH_STATUSES.includes(next.status) || !next.status) return fail(res, 400, 'Unknown mismatch status.');
        if (!StockAuditItem.RESOLUTIONS.includes(next.resolution)) return fail(res, 400, 'Unknown resolution.');
        if (next.ownerEmail && !EMAIL_RE.test(next.ownerEmail)) return fail(res, 400, 'Follow-up owner must be an email address.');

        const resolving = next.status === 'Resolved' && before.status !== 'Resolved';
        const reopening = before.status === 'Resolved' && next.status !== 'Resolved';
        if ((resolving || reopening) && !can.canResolve) {
            return fail(res, 403, 'Only the batch owner can resolve or reopen a mismatch.');
        }
        if (next.status === 'Resolved') {
            if (!next.resolution) return fail(res, 400, 'Choose how the mismatch was resolved.');
            if (next.resolution === 'Recount Matched' && item.result !== 'Matched') {
                return fail(res, 400, 'The latest count still differs from SAP. Record the recount first.');
            }
            if (['Other', 'Accepted As Is', 'Write-off Approved'].includes(next.resolution) && !next.resolutionNote) {
                return fail(res, 400, 'Add a resolution note for this resolution.');
            }
        } else if (reopening) {
            Object.assign(next, { resolution: '', resolutionNote: '' });
        }

        const note = text(body.note);
        const changes = diff(before, next, MISMATCH_FIELDS);
        if (!changes.length && !note) return fail(res, 400, 'Nothing to update.');

        const now = new Date();
        const by = person(req);
        const followUps = [...(before.followUps || [])];
        if (note || changes.some(c => c.field === 'status')) {
            followUps.push({ note: note || `Status changed to ${next.status}.`, status: next.status, by, at: now });
        }
        const mismatch = {
            ...before,
            ...next,
            raisedAt: before.raisedAt || now,
            resolvedAt: next.status === 'Resolved' ? (resolving ? now : before.resolvedAt) : null,
            resolvedBy: next.status === 'Resolved' ? (resolving ? by : before.resolvedBy) : null,
            followUps
        };

        const saved = await StockAuditItem.findOneAndUpdate(
            { _id: item._id, version: item.version },
            { $set: { mismatch }, $inc: { version: 1 } },
            { new: true }
        ).lean();
        if (!saved) {
            const latest = await StockAuditItem.findById(item._id).lean();
            return fail(res, 409, 'This line was changed by someone else meanwhile. Reload it and try again.', { item: latest });
        }
        await writeLog(req, batch, resolving ? 'Mismatch resolved' : reopening ? 'Mismatch reopened' : note && !changes.length ? 'Follow-up added' : 'Mismatch updated', {
            item: saved,
            changes: changes.map(c => ({ ...c, field: `mismatch.${c.field}` })),
            note
        });
        res.json(saved);
    } catch (error) {
        fail(res, 500, 'Error updating mismatch: ' + error.message);
    }
};

// ---------------------------------------------------------------------------------------------
// Dashboard, activity, export
// ---------------------------------------------------------------------------------------------

exports.getDashboard = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const batchId = ctx.batch._id;
        const match = { $match: { batchId } };
        const [overall, byWarehouse, byAuditor, byCondition, byMismatch, byResolution, daily, topVariances] = await Promise.all([
            StockAuditItem.aggregate([match, { $group: { _id: null, ...SUMMARY_GROUP } }]),
            StockAuditItem.aggregate([
                match,
                { $group: { _id: '$warehouseCode', warehouseName: { $first: '$warehouseName' }, ...SUMMARY_GROUP } },
                { $sort: { _id: 1 } }
            ]),
            StockAuditItem.aggregate([
                { $match: { batchId, result: { $ne: 'Pending' } } },
                {
                    $group: {
                        _id: '$countedBy.email',
                        name: { $last: '$countedBy.name' },
                        lines: { $sum: 1 },
                        matched: { $sum: { $cond: [{ $eq: ['$result', 'Matched'] }, 1, 0] } },
                        lastCountAt: { $max: '$countedAt' }
                    }
                },
                { $sort: { lines: -1 } }
            ]),
            StockAuditItem.aggregate([
                { $match: { batchId, condition: { $nin: ['', null] } } },
                { $group: { _id: '$condition', lines: { $sum: 1 } } },
                { $sort: { lines: -1 } }
            ]),
            StockAuditItem.aggregate([
                { $match: { batchId, 'mismatch.status': { $nin: ['', null] } } },
                { $group: { _id: '$mismatch.status', lines: { $sum: 1 }, value: { $sum: { $ifNull: ['$absVarianceValue', 0] } } } }
            ]),
            StockAuditItem.aggregate([
                { $match: { batchId, 'mismatch.status': 'Resolved' } },
                { $group: { _id: '$mismatch.resolution', lines: { $sum: 1 } } },
                { $sort: { lines: -1 } }
            ]),
            StockAuditItem.aggregate([
                { $match: { batchId, countedAt: { $ne: null } } },
                // Day in India time.
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$countedAt', timezone: 'Asia/Kolkata' } }, lines: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            StockAuditItem.find({ batchId, result: { $in: ['Short', 'Excess'] } })
                .sort({ absVarianceValue: -1, lineNo: 1 })
                .limit(10)
                .lean()
        ]);

        res.json({
            summary: finishSummary(overall[0]),
            byWarehouse: byWarehouse.map(w => ({ warehouseCode: w._id || '', warehouseName: w.warehouseName || '', ...finishSummary(w) })),
            byAuditor: byAuditor.map(a => ({
                email: a._id || '',
                name: a.name || a._id || 'Unknown',
                lines: a.lines,
                matched: a.matched,
                accuracyPct: a.lines ? round((a.matched / a.lines) * 100, 1) : null,
                lastCountAt: a.lastCountAt
            })),
            byCondition: byCondition.map(c => ({ condition: c._id, lines: c.lines })),
            byMismatchStatus: byMismatch.map(m => ({ status: m._id, lines: m.lines, value: money(m.value) })),
            byResolution: byResolution.map(r => ({ resolution: r._id || 'Not set', lines: r.lines })),
            daily: daily.map(d => ({ day: d._id, lines: d.lines })),
            topVariances
        });
    } catch (error) {
        fail(res, 500, 'Error loading audit dashboard: ' + error.message);
    }
};

exports.getLogs = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const filter = { batchId: ctx.batch._id };
        if (isId(req.query.itemId)) filter.itemId = req.query.itemId;
        const [logs, total] = await Promise.all([
            StockAuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            StockAuditLog.countDocuments(filter)
        ]);
        res.json({ logs, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (error) {
        fail(res, 500, 'Error loading audit trail: ' + error.message);
    }
};

const sheetFrom = (rows, widths) => {
    const sheet = XLSX.utils.json_to_sheet(rows);
    if (widths) sheet['!cols'] = widths.map(wch => ({ wch }));
    return sheet;
};

// The whole batch as a workbook: summary, every line, mismatches with follow-ups, audit trail.
exports.exportBatch = async (req, res) => {
    try {
        const ctx = await loadBatch(req, res);
        if (!ctx) return;
        const { batch } = ctx;
        const [summary, items, logs] = await Promise.all([
            summaryOf(batch._id),
            StockAuditItem.find({ batchId: batch._id }).sort({ lineNo: 1 }).lean(),
            StockAuditLog.find({ batchId: batch._id }).sort({ at: 1 }).limit(20000).lean()
        ]);

        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheetFrom([
            ['Batch', batch.name], ['Type', batch.auditType], ['Status', batch.status],
            ['SAP reference', batch.sapReference], ['SAP stock as of', formatDateTime(batch.sapSnapshotAt, '')],
            ['Planned', `${formatDate(batch.plannedStart, '')} - ${formatDate(batch.plannedEnd, '')}`],
            ['Created by', `${batch.createdBy?.name || ''} ${batch.createdBy?.email ? `<${batch.createdBy.email}>` : ''}`.trim()],
            ['Created on', formatDateTime(batch.createdAt, '')], ['Completed on', formatDateTime(batch.completedAt, '')],
            [], ['Lines', summary.lines], ['Counted', summary.counted], ['Pending', summary.pending],
            ['Matched', summary.matched], ['Short', summary.short], ['Excess', summary.excess],
            ['Open mismatches', summary.openMismatches], ['Resolved mismatches', summary.resolvedMismatches],
            ['Accuracy %', summary.accuracyPct ?? ''], ['SAP value', summary.sapValue], ['Counted value', summary.countedValue],
            ['Short value', summary.shortValue], ['Excess value', summary.excessValue], ['Net variance value', summary.varianceValue]
        ].map(([label, value]) => ({ Field: label ?? '', Value: value ?? '' })), [24, 48]), 'Summary');

        XLSX.utils.book_append_sheet(book, sheetFrom(items.map(i => ({
            'Line': i.lineNo,
            'Item Code': i.itemCode,
            'Item Name': i.itemName,
            'Item Group': i.itemGroup,
            'UoM': i.uom,
            'Warehouse': i.warehouseCode,
            'Warehouse Name': i.warehouseName,
            'Bin': i.binLocation,
            'Batch / Serial': i.batchNumber,
            'SAP Qty': i.sapQty,
            'Unit Price': i.unitPrice,
            'SAP Value': i.sapValue,
            'Counted Qty': i.countedQty ?? '',
            'Counted Value': i.countedValue ?? '',
            'Variance Qty': i.varianceQty ?? '',
            'Variance Value': i.varianceValue ?? '',
            'Result': i.result,
            'Condition': i.condition,
            'Found At': i.foundLocation,
            'Remarks': i.remarks,
            'Counted By': i.countedBy?.name || '',
            'Counted On': formatDateTime(i.countedAt, ''),
            'Count Rounds': i.countRounds,
            'Mismatch Status': i.mismatch?.status || '',
            'Resolution': i.mismatch?.resolution || ''
        })), [6, 16, 32, 14, 8, 12, 18, 12, 14, 10, 10, 12, 11, 12, 11, 12, 10, 11, 14, 28, 18, 20, 8, 16, 22]), 'Lines');

        const mismatches = items.filter(i => i.mismatch?.status);
        XLSX.utils.book_append_sheet(book, sheetFrom(mismatches.map(i => ({
            'Item Code': i.itemCode,
            'Item Name': i.itemName,
            'Warehouse': i.warehouseCode,
            'Bin': i.binLocation,
            'SAP Qty': i.sapQty,
            'Counted Qty': i.countedQty ?? '',
            'Variance Qty': i.varianceQty ?? '',
            'Variance Value': i.varianceValue ?? '',
            'Result': i.result,
            'Status': i.mismatch.status,
            'Root Cause': i.mismatch.rootCause,
            'Follow-up Owner': i.mismatch.ownerEmail,
            'Resolution': i.mismatch.resolution,
            'Resolution Note': i.mismatch.resolutionNote,
            'SAP Document': i.mismatch.sapDocRef,
            'Resolved By': i.mismatch.resolvedBy?.name || '',
            'Resolved On': formatDateTime(i.mismatch.resolvedAt, ''),
            'Follow-ups': (i.mismatch.followUps || []).map(f => `${formatDateTime(f.at, '')} ${f.by?.name || ''}: ${f.note}`).join('\n')
        })), [16, 32, 12, 12, 10, 11, 11, 12, 10, 16, 28, 24, 22, 32, 16, 18, 20, 60]), 'Mismatches');

        XLSX.utils.book_append_sheet(book, sheetFrom(logs.map(l => ({
            'When': formatDateTime(l.at, ''),
            'User': l.user?.name || '',
            'Email': l.user?.email || '',
            'Action': l.action,
            'Item Code': l.itemCode,
            'Changes': (l.changes || []).map(c => `${c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`).join('\n'),
            'Note': l.note
        })), [20, 20, 26, 24, 16, 48, 40]), 'Audit Trail');

        const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
        const fileName = `${batch.name.replace(/[^A-Za-z0-9_.-]+/g, '_')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(buffer);
    } catch (error) {
        fail(res, 500, 'Error exporting audit batch: ' + error.message);
    }
};
