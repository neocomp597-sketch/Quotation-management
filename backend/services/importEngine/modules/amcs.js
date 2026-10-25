const AMC = require('../../../models/AMC');
const { getActiveBranchId } = require('../../../middlewares/tenantContext');
const { formatDate } = require('../../../utils/dateFormat');
const shared = require('./csmShared');

// AMC import (Warranty & AMC screen). Column names, lookups and matching are those of the
// original importer (importController.importAmcs): a contract number that already exists
// updates that AMC, otherwise an AMC is added.

const AMC_STATUSES = AMC.schema.path('status').enumValues;

const FIELDS = [
    {
        key: 'customer', label: 'Customer Code', required: true,
        aliases: ['Customer Code', 'Customer Name', 'customerId', 'customer'],
        requiredMessage: 'Customer is missing.',
        requiredHint: 'Fill in the customer code (or the customer name) from Customer Master.',
        description: 'Customer code, customer name or company name from Customer Master.'
    },
    {
        key: 'contractNo', label: 'Contract Number', required: true,
        aliases: ['Contract Number', 'Contract No', 'contractNo', 'contractNumber'],
        requiredMessage: 'Contract number is missing.',
        requiredHint: 'Fill in the AMC contract number.',
        description: 'A contract number that already exists updates that AMC.'
    },
    {
        key: 'startDate', label: 'Start Date', type: 'date', required: true,
        aliases: ['Start Date', 'startDate'],
        requiredMessage: 'Start date is missing.',
        requiredHint: 'Fill in the date the contract starts, for example 01/04/2025.'
    },
    {
        key: 'endDate', label: 'End Date', type: 'date', required: true,
        aliases: ['End Date', 'endDate'],
        requiredMessage: 'End date is missing.',
        requiredHint: 'Fill in the date the contract ends, for example 31/03/2026.'
    },
    {
        key: 'visitsAllowed', label: 'Allowed Visits', type: 'number', integer: true, min: 0, default: 4,
        aliases: ['Allowed Visits', 'Visits Allowed', 'visitsAllowed'],
        description: 'Blank = 4 for a new AMC.'
    },
    {
        key: 'amount', label: 'Amount', type: 'number', min: 0, default: 0,
        aliases: ['Amount', 'amount', 'price']
    },
    {
        key: 'status', label: 'Status', type: 'option', options: AMC_STATUSES, default: 'Active',
        aliases: ['Status', 'status'],
        description: 'Active or Expired. Blank = Active for a new AMC; an existing one keeps its status.'
    }
];

const OPTIONAL_FIELDS = ['visitsAllowed', 'amount', 'status'];

module.exports = {
    key: 'amcs',
    label: 'AMC Contracts',
    recordLabel: 'AMC',
    recordLabelPlural: 'AMCs',
    permissionKey: 'csm_warranties_amc',
    permissions: [['csm_warranties_amc', 'create']],
    model: AMC,
    fields: FIELDS,

    identityKeys(data) {
        return data.contractNo ? [{ key: `contract:${shared.keyOf(data.contractNo)}`, field: 'contractNo', label: 'contract number' }] : [];
    },

    async loadContext({ rows }) {
        const contractNos = shared.distinctValues(rows, 'contractNo');
        const [customers, amcs] = await Promise.all([
            shared.loadCustomers(shared.distinctValues(rows, 'customer')),
            // AMCs of the branches the user works in (tenantPlugin), as the original importer.
            contractNos.length
                ? shared.findByValues(AMC, ['contractNo'], contractNos, { select: '_id contractNo endDate status branchId' })
                : []
        ]);
        const amcsByContract = new Map();
        amcs.forEach((amc) => {
            const key = shared.keyOf(amc.contractNo);
            if (key && !amcsByContract.has(key)) amcsByContract.set(key, amc);
        });
        return { customers, amcsByContract };
    },

    validate(data, { context }) {
        const issues = [];
        shared.resolveCustomerAndProduct(data, context, issues);
        if (data.startDate instanceof Date && data.endDate instanceof Date && data.endDate < data.startDate) {
            issues.push({
                field: 'endDate',
                code: 'INVALID_DATE',
                message: 'End date is before the start date.',
                hint: `The file has start date ${formatDate(data.startDate)} and end date ${formatDate(data.endDate)}.`
            });
        }
        return issues;
    },

    match(data, context) {
        const amc = data.contractNo && context.amcsByContract.get(shared.keyOf(data.contractNo));
        return amc ? { record: amc, by: 'contract number', field: 'contractNo' } : null;
    },

    describe(record) {
        const until = record.endDate ? formatDate(record.endDate, '') : '';
        return [record.contractNo, until && `ends ${until}`].filter(Boolean).join(' · ');
    },

    toCreate(data) {
        return {
            customerId: data.customerId,
            contractNo: data.contractNo,
            startDate: data.startDate,
            endDate: data.endDate,
            visitsAllowed: data.visitsAllowed,
            visitsUsed: 0,
            amount: data.amount,
            status: data.status,
            // New AMCs belong to the branch selected in the header (the engine saves with
            // bulkWrite, which skips tenantPlugin's default branch).
            branchId: getActiveBranchId() || null
        };
    },

    /** Only the values the row supplies: a blank cell leaves the stored value unchanged. */
    toUpdate(data) {
        const set = { customerId: data.customerId, startDate: data.startDate, endDate: data.endDate };
        OPTIONAL_FIELDS.forEach((field) => {
            if (data[field] !== undefined) set[field] = data[field];
        });
        return set;
    }
};
