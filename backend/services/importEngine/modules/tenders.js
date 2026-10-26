const Tender = require('../../../models/Tender');
const Customer = require('../../../models/Customer');
const Department = require('../../../models/Department');
const User = require('../../../models/User');
const { getTenantId } = require('../../../middlewares/tenantContext');
const { reserveSequence } = require('../../../utils/importBatch');

// Tender Register import (was importController.importTenders). Each field accepts the column
// names the original importer read, in the same order (headings are compared without case,
// spaces or punctuation). A tender number that already exists, capitals aside, updates that
// tender; a row without a tender number gets the next TND/<year>/<0001> number, from the same
// counter the Tender Register uses. Every saved tender gets an activity line, as before.

const matchKey = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

// The same list as Tender.status.
const TENDER_STATUSES = ['Active', 'Submitted', 'Won', 'Lost', 'Pending Approval'];

const FIELDS = [
    {
        key: 'tenderNo', label: 'Tender Number', aliases: ['Tender Number', 'Tender No'],
        description: 'Empty gives the next tender number. A tender with the same number (capitals do not matter) is updated.'
    },
    {
        key: 'title', label: 'Tender Title', required: true, aliases: ['Tender Title', 'Title', 'Name'],
        requiredMessage: 'Tender title is missing.',
        requiredHint: 'Fill in the title of the tender.'
    },
    {
        key: 'client', label: 'Client', required: true,
        aliases: ['Client', 'Customer', 'Company', 'Customer Name', 'Customer Code'],
        requiredMessage: 'Client is missing.',
        requiredHint: 'Fill in the company name, customer name or customer code of a customer in the Customer Master.',
        description: 'Company name or customer name as in the Customer Master (customer code also works).'
    },
    { key: 'value', label: 'Value', type: 'number', default: 0, aliases: ['Value', 'Tender Value'] },
    { key: 'deadlineDate', label: 'Deadline Date', type: 'date', required: true, aliases: ['Deadline Date', 'Deadline'] },
    { key: 'submissionDate', label: 'Submission Date', type: 'date', aliases: ['Submission Date', 'Submission'] },
    {
        key: 'status', label: 'Status', type: 'option', options: TENDER_STATUSES, default: 'Active',
        aliases: ['Status'],
        description: 'Empty means Active for a new tender.'
    },
    {
        key: 'department', label: 'Department', aliases: ['Department'],
        description: 'Department name (or code) as in the Department master.'
    },
    {
        key: 'owner', label: 'Owner', aliases: ['Owner', 'Assignee'],
        description: 'Name or email of a user. Empty makes you the owner of a new tender.'
    },
    { key: 'description', label: 'Description', default: '', aliases: ['Description', 'Scope'] }
];

const PLAIN_FIELDS = ['title', 'value', 'deadlineDate', 'submissionDate', 'status', 'description'];
const RESOLVED_FIELDS = ['customerId', 'departmentId', 'ownerId'];

const pickSupplied = (data) => {
    const doc = {};
    [...PLAIN_FIELDS, ...RESOLVED_FIELDS].forEach((key) => {
        if (data[key] !== undefined) doc[key] = data[key];
    });
    return doc;
};

const NUMBER_PREFIX = 'TND';
const formatTenderNumber = (year, seq) => `${NUMBER_PREFIX}/${year}/${String(seq).padStart(4, '0')}`;

/**
 * `count` free tender numbers, reserved in one step from the Tender Register's counter. Numbers
 * someone already typed for a tender (in the register or in this file) are skipped, so a new
 * tender never fails on a number that is taken.
 */
const nextTenderNumbers = async (count, { companyId, typedNumbers }) => {
    const year = new Date().getFullYear();
    const free = [];
    for (let attempt = 0; free.length < count && attempt < 20; attempt++) {
        const wanted = count - free.length;
        const first = await reserveSequence({ type: 'tender', companyId, prefix: NUMBER_PREFIX, year }, wanted);
        const candidates = Array.from({ length: wanted }, (_, index) => formatTenderNumber(year, first + index));
        const existing = await Tender.find({ tenderNo: { $in: candidates } })
            .collation({ locale: 'en', strength: 2 })
            .select('tenderNo')
            .lean();
        const taken = new Set(existing.map((tender) => matchKey(tender.tenderNo)));
        candidates.forEach((number) => {
            if (!taken.has(matchKey(number)) && !typedNumbers.has(matchKey(number))) free.push(number);
        });
    }
    if (free.length < count) throw new Error('Could not reserve free tender numbers');
    return free;
};

const describeSaveError = (error) => {
    const code = error?.code ?? error?.err?.code;
    const message = error?.errmsg || error?.message || '';
    if (code === 11000 || /E11000/.test(message)) return 'Another tender already has this tender number, so this row was not saved.';
    if (error?.name === 'ValidationError' && error.errors) return Object.values(error.errors).map((item) => item.message).join(' ');
    return `The database did not accept this row: ${message || 'unknown error'}.`;
};

module.exports = {
    key: 'tenders',
    label: 'Tenders',
    recordLabel: 'tender',
    recordLabelPlural: 'tenders',
    permissionKey: 'tender_register',
    permissions: [['tender_register', 'create']],
    model: Tender,
    fields: FIELDS,

    identityKeys(data) {
        return data.tenderNo ? [{ key: `no:${matchKey(data.tenderNo)}`, field: 'tenderNo', label: 'tender number' }] : [];
    },

    async loadContext({ user, rows }) {
        const companyId = getTenantId() || user?.companyId || null;

        // Tenders, customers and departments are scoped to the company by tenantPlugin.
        const [tenders, customers, departments, users] = await Promise.all([
            Tender.find({}).select('tenderNo title').lean(),
            Customer.find({}).select('companyName customerName externalCode').lean(),
            Department.find({}).select('name code').lean(),
            // User has no tenantPlugin: always filter by the company.
            companyId ? User.find({ companyId }).select('name email').lean() : []
        ]);

        // The original importer kept the last record for a repeated name; so do these maps.
        const byNumber = new Map();
        tenders.forEach((tender) => {
            const key = matchKey(tender.tenderNo);
            if (key) byNumber.set(key, tender);
        });

        const customerByName = new Map();
        const customerByCode = new Map();
        customers.forEach((customer) => {
            if (customer.companyName) customerByName.set(matchKey(customer.companyName), customer);
            if (customer.customerName) customerByName.set(matchKey(customer.customerName), customer);
            const code = matchKey(customer.externalCode);
            if (code && !customerByCode.has(code)) customerByCode.set(code, customer);
        });

        const departmentByName = new Map();
        const departmentByCode = new Map();
        departments.forEach((department) => {
            if (department.name) departmentByName.set(matchKey(department.name), department);
            const code = matchKey(department.code);
            if (code && !departmentByCode.has(code)) departmentByCode.set(code, department);
        });

        const userByName = new Map();
        const userByEmail = new Map();
        users.forEach((person) => {
            if (person.name) userByName.set(matchKey(person.name), person);
            if (person.email) userByEmail.set(matchKey(person.email), person);
        });

        // Numbers typed in the file: a generated number never takes one of them.
        const typedNumbers = new Set(rows.map((data) => matchKey(data.tenderNo)).filter(Boolean));

        return {
            byNumber, customerByName, customerByCode, departmentByName, departmentByCode, userByName, userByEmail, typedNumbers
        };
    },

    validate(data, { context, issues }) {
        const found = [];
        const hasIssue = (field) => issues.some((issue) => issue.field === field);

        if (data.client !== undefined && !hasIssue('client')) {
            const key = matchKey(data.client);
            const customer = context.customerByName.get(key) || context.customerByCode.get(key);
            if (customer) data.customerId = String(customer._id);
            else {
                found.push({
                    field: 'client',
                    code: 'NOT_FOUND',
                    message: `Client "${data.client}" was not found.`,
                    hint: 'Use the company name, customer name or customer code exactly as in the Customer Master.'
                });
            }
        }

        if (data.department !== undefined && !hasIssue('department')) {
            const key = matchKey(data.department);
            const department = context.departmentByName.get(key) || context.departmentByCode.get(key);
            if (department) data.departmentId = String(department._id);
            else {
                found.push({
                    field: 'department',
                    code: 'NOT_FOUND',
                    message: `Department "${data.department}" was not found.`,
                    hint: 'Check the spelling against the Department master, or leave the cell empty.'
                });
            }
        }

        if (data.owner !== undefined && !hasIssue('owner')) {
            const key = matchKey(data.owner);
            const person = context.userByName.get(key) || context.userByEmail.get(key);
            if (person) data.ownerId = String(person._id);
            else {
                found.push({
                    field: 'owner',
                    code: 'NOT_FOUND',
                    message: `Owner "${data.owner}" was not found.`,
                    hint: 'Use the name or email of a user of this company, or leave the cell empty to make yourself the owner.'
                });
            }
        }
        return found;
    },

    match(data, context) {
        const record = data.tenderNo && context.byNumber.get(matchKey(data.tenderNo));
        return record ? { record, by: 'tender number', field: 'tenderNo' } : null;
    },

    describe(record) {
        return [record.tenderNo, record.title].filter(Boolean).join(' · ');
    },

    /**
     * Saves a batch: new tenders get their number (typed, or the next free one) and a "created"
     * activity; updated tenders get only the values the row supplies plus an "updated" activity.
     */
    async write(plans, { user, companyId, context }) {
        const errors = new Map();
        const activity = (action) => ({ userId: user?.id || null, userName: user?.name || 'System', action, timestamp: new Date() });

        const needNumber = plans.filter((plan) => plan.action === 'create' && !plan.data.tenderNo);
        const generated = needNumber.length
            ? await nextTenderNumbers(needNumber.length, { companyId, typedNumbers: context?.typedNumbers || new Set() })
            : [];
        const numberOf = new Map(needNumber.map((plan, index) => [plan.rowId, generated[index]]));

        const ops = [];
        const opPlans = [];
        plans.forEach((plan) => {
            try {
                if (plan.action === 'create') {
                    const doc = new Tender({
                        ...pickSupplied(plan.data),
                        _id: plan.recordId,
                        companyId,
                        tenderNo: plan.data.tenderNo || numberOf.get(plan.rowId),
                        ownerId: plan.data.ownerId || user?.id,
                        activities: [activity('Tender imported/created via excel')]
                    });
                    const invalid = doc.validateSync();
                    if (invalid) throw invalid;
                    ops.push({ insertOne: { document: doc.toObject() } });
                } else {
                    ops.push({
                        updateOne: {
                            filter: { _id: plan.recordId, companyId },
                            update: {
                                $set: pickSupplied(plan.data),
                                $push: { activities: activity('Tender imported/updated via excel') }
                            }
                        }
                    });
                }
                opPlans.push(plan);
            } catch (error) {
                errors.set(plan.rowId, describeSaveError(error));
            }
        });

        if (ops.length) {
            try {
                await Tender.bulkWrite(ops, { ordered: false });
            } catch (error) {
                // Without per-row errors the outcome is unknown: the engine reconciles the batch.
                if (!Array.isArray(error?.writeErrors)) throw error;
                error.writeErrors.forEach((writeError) => {
                    const plan = opPlans[writeError.index];
                    if (plan) errors.set(plan.rowId, describeSaveError(writeError));
                });
            }

            // An update whose tender was deleted after the checks matched nothing.
            const updated = opPlans.filter((plan) => plan.action === 'update' && !errors.has(plan.rowId));
            if (updated.length) {
                const found = await Tender.find({ _id: { $in: updated.map((plan) => plan.recordId) } }).select('_id').lean();
                const foundIds = new Set(found.map((doc) => String(doc._id)));
                updated.forEach((plan) => {
                    if (!foundIds.has(String(plan.recordId))) errors.set(plan.rowId, 'This tender was deleted while the import was running.');
                });
            }
        }
        return errors;
    }
};
