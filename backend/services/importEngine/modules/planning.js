const mongoose = require('mongoose');
const Planning = require('../../../models/Planning');
const Customer = require('../../../models/Customer');
const Product = require('../../../models/Product');
const MGR = require('../../../models/MGR');
const { toText } = require('../fieldTypes');
const { ImportJobError } = require('../errors');
const { parseDateText } = require('../../../utils/dateFormat');
const { invalidatePlanningCaches } = require('../../../utils/cacheInvalidation');

// Planning import (importController.importPlanning). The screen sends the financial year it
// shows ({ financialYear: '2026-27' }); every row is a planning entry of that year, in the
// branch selected in the header. A row updates the entry with the same customer, product,
// month and MGR 1 (in that branch), else it adds one - the same match the original importer's
// upsert made. Column names are the ones the original importer read, in the same order.

const PLANNING_STATUS_OPTIONS = ['Budget', 'Firm', 'MFC', 'B & B', 'Others', 'Order Received', 'Invoice', 'Lost', 'Parked'];
const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const CALENDAR_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LOOKUP_CHUNK = 1000;
const ENTRY_LABEL = 'customer, product, month and MGR 1';

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const lookupKey = (value) => cleanText(value).toUpperCase();
const chunk = (list, size) => {
    const parts = [];
    for (let i = 0; i < list.length; i += size) parts.push(list.slice(i, i + size));
    return parts;
};

// ── Financial year ──────────────────────────────────────────────────────────

/** "2026-27", "2026-2027", "26-27", "2026/27", "FY 2026-27" -> "2026-27" (as the Planning screen). */
const normalizeFinancialYear = (value) => {
    const text = cleanText(value).replace(/^FY\s*[:-]?\s*/i, '');
    const match = text.replace(/[\s\-/]+/g, '-').match(/^(\d{2,4})-(\d{2,4})$/);
    if (!match) return text;
    let [, start, end] = match;
    if (start.length === 2) start = `20${start}`;
    if (end.length === 4) end = end.slice(-2);
    return `${start}-${end}`;
};

const isValidFinancialYear = (fy) => {
    const match = /^(\d{4})-(\d{2})$/.exec(fy || '');
    return Boolean(match) && (Number(match[1]) + 1) % 100 === Number(match[2]);
};

const currentFinancialYearStart = () => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
};

const isPreviousYear = (fy) => Number(String(fy).slice(0, 4)) < currentFinancialYearStart();

/** The twelve months of a financial year: Apr-26 ... Mar-27, month 1 = April (as the screen saves). */
const monthsOf = (fy) => {
    const start = Number(fy.slice(0, 4));
    return FY_MONTHS.map((name, index) => {
        const year = index < 9 ? start : start + 1;
        return { name, year, month: index + 1, label: `${name}-${String(year).slice(-2)}` };
    });
};

const isAdminUser = (user) => {
    const role = String(user?.role || '');
    return ['admin', 'Admin'].includes(role) || ['super_admin', 'superadmin'].includes(role.toLowerCase());
};

/**
 * The previous-year rule of the Planning screen (planning_edit_prev_year): admins always,
 * others only with the "Edit Previous Year Entries" permission - from their role or their own
 * permissions, as the screen decides whether to let them edit.
 */
const canChangePreviousYears = async (user) => {
    if (!user) return false;
    if (isAdminUser(user)) return true;
    // Required here, not at the top: the middleware loads models and the redis cache.
    const { getEffectivePermissions } = require('../../../middlewares/permissionMiddleware');
    const { hasPermission } = require('../../../config/authorization');
    const permissions = await getEffectivePermissions({ user });
    return hasPermission(permissions, 'planning_edit_prev_year', 'view');
};

// ── Month & Year cells ──────────────────────────────────────────────────────

/*
 * The month of a row arrives as text ("Apr-26", "April 2026", "04/2026", "15/04/2026"), as an
 * Excel date cell, or as an Excel date number. None of the shared field types reads all three
 * (a date cell would be turned into text first and, on a server in India time, SheetJS's
 * date cells sit one millisecond before midnight - "1 Apr" would read as 31 Mar), so this
 * module reads the field itself (field.parse). It gives a calendar month, "Apr-2026" (or just
 * "Apr" when the cell has no year); validate() then checks it belongs to the chosen financial year.
 */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
// Excel date numbers from 1927 to 2173; a smaller or larger number is not a date.
const SERIAL_MIN = 10000;
const SERIAL_MAX = 100000;

const monthToken = (year, monthIndex) => `${CALENDAR_MONTHS[monthIndex]}-${year}`;
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
// "Apr", "April", "Sept" - the start of a month's name, at least three letters.
const monthIndexOf = (name) => {
    const word = String(name).toLowerCase();
    return word.length < 3 ? -1 : MONTH_NAMES.findIndex((month) => month.startsWith(word));
};
const fullYear = (text) => (text.length === 2 ? 2000 + Number(text) : Number(text));

const fromSerial = (serial) => {
    const date = new Date(EXCEL_EPOCH_MS + Math.floor(serial) * 86400000);
    return monthToken(date.getUTCFullYear(), date.getUTCMonth());
};

const fromNumbers = (year, month) => {
    const index = Number(month) - 1;
    return index >= 0 && index < 12 ? monthToken(Number(year), index) : null;
};

const fromText = (text) => {
    let match = /^([a-z]{3,9})\.?$/i.exec(text);
    if (match) {
        const index = monthIndexOf(match[1]);
        return index < 0 ? null : CALENDAR_MONTHS[index];
    }
    match = /^([a-z]{3,9})\.?[\s\-/.,']*(\d{2}|\d{4})$/i.exec(text);
    if (match) {
        const index = monthIndexOf(match[1]);
        return index < 0 ? null : monthToken(fullYear(match[2]), index);
    }
    match = /^(\d{4})[\s\-/.]+([a-z]{3,9})\.?$/i.exec(text);
    if (match) {
        const index = monthIndexOf(match[2]);
        return index < 0 ? null : monthToken(Number(match[1]), index);
    }
    // "04/2026" or "2026-04"
    match = /^(\d{1,2})[\s\-/.](\d{4})$/.exec(text);
    if (match) return fromNumbers(match[2], match[1]);
    match = /^(\d{4})[-/.](\d{1,2})$/.exec(text);
    if (match) return fromNumbers(match[1], match[2]);
    if (/^\d{5}(\.\d+)?$/.test(text)) {
        const serial = Number(text);
        return serial >= SERIAL_MIN && serial < SERIAL_MAX ? fromSerial(serial) : null;
    }
    const date = parseDateText(text);
    if (!date || Number.isNaN(date.getTime())) return null;
    // Day-first text comes back as UTC midnight; other text Date understands as local time.
    const utcMidnight = date.getTime() % 86400000 === 0;
    return utcMidnight ? monthToken(date.getUTCFullYear(), date.getUTCMonth()) : monthToken(date.getFullYear(), date.getMonth());
};

const parseMonthCell = (raw, field) => {
    let token = null;
    if (raw instanceof Date) {
        if (!Number.isNaN(raw.getTime())) {
            // SheetJS builds date cells in local time, a few ms off: round to the minute.
            const local = new Date(Math.round(raw.getTime() / 60000) * 60000);
            token = monthToken(local.getFullYear(), local.getMonth());
        }
    } else if (typeof raw === 'number') {
        token = raw >= SERIAL_MIN && raw < SERIAL_MAX ? fromSerial(raw) : null;
    } else {
        token = fromText(toText(raw));
    }
    if (!token) {
        return {
            issue: {
                code: 'INVALID_MONTH',
                message: `${field.label} "${toText(raw)}" could not be read as a month.`,
                hint: 'Write the month and year like Apr-26.'
            }
        };
    }
    return { value: token };
};


/** The month of the financial year a parsed cell names, or null. */
const resolveMonth = (token, months) => {
    const [name, year] = String(token).split('-');
    return months.find((month) => month.name === name && (year === undefined || month.year === Number(year))) || null;
};

const shownMonth = (token) => {
    const [name, year] = String(token).split('-');
    return year === undefined ? name : `${name}-${String(year).slice(-2)}`;
};

// ── Fields ──────────────────────────────────────────────────────────────────

const FIELDS = [
    {
        key: 'financialYear', label: 'Financial Year',
        aliases: ['Financial Year', 'financialYear', 'FY'],
        description: 'Optional. When filled in, it must be the financial year chosen on the Planning screen.'
    },
    {
        key: 'monthYear', label: 'Month & Year', required: true, parse: parseMonthCell,
        aliases: ['Month & Year', 'monthYear', 'Month', 'month'],
        description: 'A month of the chosen financial year, for example Apr-26. Dates and "April 2026" are read too.',
        requiredMessage: 'Month & Year is missing.',
        requiredHint: 'Fill in the month of this entry, for example Apr-26.'
    },
    {
        key: 'customer', label: 'Customer Code', required: true,
        aliases: ['Customer Code', 'customerCode', 'Customer Name', 'customerName', 'Company Name', 'companyName'],
        description: 'The customer code, or the customer or company name, as in the Customer Master.',
        requiredMessage: 'Customer is missing.',
        requiredHint: 'Fill in the customer code (or the customer name).'
    },
    {
        key: 'product', label: 'Product Code', required: true,
        aliases: ['Product Code', 'productCode', 'Product Name', 'productName'],
        description: 'The product code, or the product name, as in the Product Master.',
        requiredMessage: 'Product is missing.',
        requiredHint: 'Fill in the product code (or the product name).'
    },
    {
        key: 'qty', label: 'Qty', required: true, type: 'number', min: 0,
        aliases: ['Qty', 'qty', 'Quantity'],
        requiredMessage: 'Qty is missing.',
        requiredHint: 'Fill in the quantity (0 or more).'
    },
    {
        key: 'value', label: 'Value', required: true, type: 'number', min: 0,
        aliases: ['Value', 'value'],
        description: 'Value of one unit. Total value = Qty x Value.',
        requiredMessage: 'Value is missing.',
        requiredHint: 'Fill in the value of one unit (0 or more).'
    },
    {
        key: 'mgr1', label: 'MGR 1', required: true,
        aliases: ['MGR 1', 'MGR1', 'mgrCode', 'mgrCode1'],
        description: 'An MGR 1 code from the MGR Master (SBU).',
        requiredMessage: 'MGR 1 is missing.',
        requiredHint: 'Fill in the MGR 1 code from the MGR Master.'
    },
    {
        key: 'mgr2', label: 'MGR 2',
        aliases: ['MGR 2', 'MGR2', 'mgrCode2'],
        description: 'Optional. An MGR 2 code from the MGR Master (segment).'
    },
    {
        key: 'status', label: 'Status', required: true, type: 'option', options: PLANNING_STATUS_OPTIONS,
        aliases: ['Status', 'status'],
        requiredMessage: 'Status is missing.',
        requiredHint: `Use one of: ${PLANNING_STATUS_OPTIONS.join(', ')}.`
    }
];

// ── Lookups ─────────────────────────────────────────────────────────────────

const distinctValues = (rows, key) => [...new Set(rows.map((row) => cleanText(row[key])).filter(Boolean))];

/**
 * Records whose `fields` equal one of `values` (ignoring case), in one query per 1000 values.
 * Map: value in capitals -> record, the first field in `fields` winning (a customer code before
 * a customer name before a company name), and the oldest record for the same field.
 */
const findByValues = async (model, fields, values, { select, filter = {} }) => {
    const byField = new Map(fields.map((field) => [field, new Map()]));
    for (const part of chunk(values, LOOKUP_CHUNK)) {
        const docs = await model.find({ ...filter, $or: fields.map((field) => ({ [field]: { $in: part } })) })
            .collation({ locale: 'en', strength: 2 })
            .select(select)
            .sort({ _id: 1 })
            .lean();
        docs.forEach((doc) => {
            fields.forEach((field) => {
                const key = lookupKey(doc[field]);
                if (key && !byField.get(field).has(key)) byField.get(field).set(key, doc);
            });
        });
    }
    const found = new Map();
    values.forEach((value) => {
        const key = lookupKey(value);
        const field = fields.find((candidate) => byField.get(candidate).has(key));
        if (field) found.set(key, byField.get(field).get(key));
    });
    return found;
};

const entryKey = ({ customerId, productId, monthYear, mgrCode }) => (
    customerId && productId && monthYear && mgrCode ? `${customerId}|${productId}|${monthYear}|${mgrCode}` : ''
);

/** Existing entries of the year in the import's branch, for the customers and products of the file. */
const loadExistingEntries = async ({ params, months, customers, products }) => {
    const existing = new Map();
    const customerIds = [...new Set([...customers.values()].map((doc) => String(doc._id)))];
    const productIds = [...new Set([...products.values()].map((doc) => String(doc._id)))];
    if (!customerIds.length || !productIds.length) return existing;

    // The branch is given explicitly (the one the import was started in), so the request's
    // branch filter is not added on top; tenantPlugin still limits it to the company.
    const branchId = params.branchId ? new mongoose.Types.ObjectId(params.branchId) : null;
    for (const part of chunk(customerIds, LOOKUP_CHUNK)) {
        const entries = await Planning.find({
            monthYear: { $in: months.map((month) => month.label) },
            branchId,
            customerId: { $in: part },
            productId: { $in: productIds }
        })
            .select('customerId productId monthYear mgrCode customerName productName')
            .sort({ _id: 1 })
            .setOptions({ bypassBranch: true })
            .lean();
        entries.forEach((entry) => {
            const key = entryKey(entry);
            if (key && !existing.has(key)) existing.set(key, entry);
        });
    }
    return existing;
};

const notFound = (field, label, value, hint) => ({
    field,
    code: 'NOT_FOUND',
    message: `${label} "${value}" was not found.`,
    hint
});

module.exports = {
    key: 'planning',
    label: 'Planning',
    recordLabel: 'planning entry',
    recordLabelPlural: 'planning entries',
    permissionKey: 'planning_screen',
    // Same as the original route (config/apiPermissions.js: importRule('planning', 'planning_screen')).
    permissions: [['planning_screen', 'create']],
    model: Planning,
    fields: FIELDS,

    /**
     * { financialYear } from the screen. The branch is the one selected in the header when the
     * file is uploaded, so the preview and the import work on the same branch.
     */
    async resolveParams(raw, { user }) {
        const typed = cleanText(raw?.financialYear);
        if (!typed) {
            throw new ImportJobError('FY_REQUIRED', 'Choose the financial year to import into.', 'Pick the financial year on the Planning screen, then upload the file again.', 400);
        }
        const financialYear = normalizeFinancialYear(typed);
        if (!isValidFinancialYear(financialYear)) {
            throw new ImportJobError('INVALID_FY', `"${typed}" is not a financial year.`, 'Use the format 2026-27.', 400);
        }
        if (isPreviousYear(financialYear) && !(await canChangePreviousYears(user))) {
            throw new ImportJobError(
                'PREVIOUS_YEAR_LOCKED',
                `You cannot import into FY ${financialYear} because it is a previous financial year.`,
                'Choose the current financial year, or ask your administrator for the "Edit Previous Year Entries" permission.',
                403
            );
        }
        const branchId = user?.activeBranchId && mongoose.isValidObjectId(String(user.activeBranchId)) ? String(user.activeBranchId) : null;
        return { financialYear, branchId };
    },

    describeParams(params) {
        return params.financialYear ? `FY ${params.financialYear}` : '';
    },

    async loadContext({ params, user, rows }) {
        const months = monthsOf(params.financialYear);
        // Scoped to the company (customers also to the branches of the request) by tenantPlugin.
        const [customers, products, mgr1, mgr2, allowed] = await Promise.all([
            findByValues(Customer, ['externalCode', 'customerName', 'companyName'], distinctValues(rows, 'customer'), { select: 'externalCode customerName companyName' }),
            findByValues(Product, ['productCode', 'productName'], distinctValues(rows, 'product'), { select: 'productCode productName' }),
            findByValues(MGR, ['code'], distinctValues(rows, 'mgr1'), { select: 'code mgrType', filter: { mgrType: 'MGR1' } }),
            findByValues(MGR, ['code'], distinctValues(rows, 'mgr2'), { select: 'code mgrType', filter: { mgrType: 'MGR2' } }),
            // Checked again for the import itself: permissions may have changed since the preview.
            isPreviousYear(params.financialYear) ? canChangePreviousYears(user) : true
        ]);
        const existing = await loadExistingEntries({ params, months, customers, products });
        return { months, customers, products, mgr1, mgr2, existing, yearLocked: !allowed };
    },

    validate(data, { context, params }) {
        const issues = [];
        const fy = params.financialYear;

        if (context.yearLocked) {
            issues.push({
                field: '',
                code: 'PREVIOUS_YEAR_LOCKED',
                message: `You cannot import into FY ${fy} because it is a previous financial year.`,
                hint: 'Ask your administrator for the "Edit Previous Year Entries" permission.'
            });
        }

        if (data.financialYear !== undefined) {
            const rowYear = normalizeFinancialYear(data.financialYear);
            if (!isValidFinancialYear(rowYear)) {
                issues.push({ field: 'financialYear', code: 'INVALID_FY', message: `Financial Year "${data.financialYear}" is not a financial year.`, hint: `Write it like ${fy}, or leave it blank.` });
            } else if (rowYear !== fy) {
                issues.push({
                    field: 'financialYear',
                    code: 'OTHER_FY',
                    message: `This row is for FY ${rowYear}, but this import is for FY ${fy}.`,
                    hint: `Change the Financial Year to ${fy}, or import this row with FY ${rowYear} chosen on the Planning screen.`
                });
            } else {
                data.financialYear = rowYear;
            }
        }

        if (data.monthYear !== undefined) {
            const month = resolveMonth(data.monthYear, context.months);
            if (month) {
                data.monthYear = month.label;
                data.month = month.month;
            } else {
                issues.push({
                    field: 'monthYear',
                    code: 'OTHER_FY',
                    message: `${shownMonth(data.monthYear)} is not a month of FY ${fy}.`,
                    hint: `Use a month from ${context.months[0].label} to ${context.months[11].label}, or import this row with its own financial year chosen.`
                });
            }
        }

        if (data.customer !== undefined) {
            const customer = context.customers.get(lookupKey(data.customer));
            if (customer) {
                data.customerId = customer._id;
                data.customerName = customer.companyName || customer.customerName;
            } else {
                issues.push(notFound('customer', 'Customer', data.customer, 'Check the customer code (or name) against the Customer Master, or add the customer there first.'));
            }
        }

        if (data.product !== undefined) {
            const product = context.products.get(lookupKey(data.product));
            if (product) {
                data.productId = product._id;
                data.productName = product.productName;
            } else {
                issues.push(notFound('product', 'Product', data.product, 'Check the product code (or name) against the Product Master, or add the product there first.'));
            }
        }

        if (data.mgr1 !== undefined) {
            const mgr = context.mgr1.get(lookupKey(data.mgr1));
            if (mgr) {
                data.mgr1 = mgr.code;
                data.mgrCode = mgr.code;
            } else {
                issues.push(notFound('mgr1', 'MGR 1', data.mgr1, 'Use an MGR 1 code from the MGR Master, or add it there first.'));
            }
        }

        if (data.mgr2 !== undefined) {
            const mgr = context.mgr2.get(lookupKey(data.mgr2));
            if (mgr) {
                data.mgr2 = mgr.code;
                data.mgrCode2 = mgr.code;
            } else {
                issues.push(notFound('mgr2', 'MGR 2', data.mgr2, 'Use an MGR 2 code from the MGR Master, leave it blank, or add it there first.'));
            }
        }

        return issues;
    },

    /** One entry per customer, product, month and MGR 1 - what the original importer's upsert matched on. */
    identityKeys(data) {
        const key = data.month ? entryKey(data) : '';
        return key ? [{ key: `entry:${key}`, field: 'customer', label: ENTRY_LABEL }] : [];
    },

    match(data, context) {
        const key = data.month ? entryKey(data) : '';
        const record = key ? context.existing.get(key) : null;
        return record ? { record, by: ENTRY_LABEL, field: 'customer' } : null;
    },

    describe(record) {
        return [record.monthYear, record.customerName, record.productName].filter(Boolean).join(' · ');
    },

    toCreate(data, { user, params }) {
        return {
            financialYear: params.financialYear,
            monthYear: data.monthYear,
            month: data.month,
            customerId: data.customerId,
            customerName: data.customerName,
            productId: data.productId,
            productName: data.productName,
            qty: data.qty,
            value: data.value,
            totalValue: data.qty * data.value,
            mgrCode: data.mgrCode,
            mgrCode2: data.mgrCode2 || '',
            status: data.status,
            createdBy: user?.id || null,
            // bulkWrite skips tenantPlugin, which would otherwise fill in the active branch.
            branchId: params.branchId ? new mongoose.Types.ObjectId(params.branchId) : null
        };
    },

    /** Every required value is in the row; a blank MGR 2 keeps the stored one. */
    toUpdate(data, { params }) {
        const set = {
            financialYear: params.financialYear,
            month: data.month,
            customerName: data.customerName,
            productName: data.productName,
            qty: data.qty,
            value: data.value,
            totalValue: data.qty * data.value,
            status: data.status
        };
        if (data.mgrCode2 !== undefined) set.mgrCode2 = data.mgrCode2;
        return set;
    },

    async afterImport({ user, run, params }) {
        // The Planning list and reports are cached (planningController), as after a manual entry.
        await invalidatePlanningCaches();
        const saved = run.created + run.updated;
        if (!saved) return;
        const { createCompanyNotifications } = require('../../../utils/notificationHelper');
        await createCompanyNotifications({
            companyId: user?.companyId,
            title: 'Planning Entries Imported',
            message: `Successfully imported/updated ${saved} planning entries for FY ${params.financialYear} (created: ${run.created}, updated: ${run.updated}, failed: ${run.failed}).`,
            type: 'Planning',
            excludeUserId: user?.id
        });
    },

    // For tests and the template.
    PLANNING_STATUS_OPTIONS,
    normalizeFinancialYear,
    parseMonthCell
};
