const Contract = require('../../../models/Contract');
const Customer = require('../../../models/Customer');
const { getTenantId } = require('../../../middlewares/tenantContext');

// Contract import (was importController.importContracts). Each field accepts the column names
// the original importer read, in the same order (headings are compared without case, spaces or
// punctuation). A contract number that already exists, capitals aside, updates that contract.

const matchKey = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

// The same list as Contract.status.
const CONTRACT_STATUSES = ['Draft', 'Active', 'Expired', 'Terminated', 'Pending Approval', 'Approved', 'Cancelled', 'Renewed'];

const FIELDS = [
    {
        key: 'contractNumber', label: 'Contract Number', required: true,
        aliases: ['Contract Number', 'Contract No'],
        requiredMessage: 'Contract number is missing.',
        requiredHint: 'Fill in the contract number.',
        description: 'A contract with the same number (capitals do not matter) is updated.'
    },
    {
        key: 'title', label: 'Title', aliases: ['Title', 'Name'],
        description: 'Empty means "Contract <number>" for a new contract.'
    },
    {
        key: 'customer', label: 'Customer', required: true,
        aliases: ['Customer', 'Company', 'Customer Name', 'Customer Code'],
        requiredMessage: 'Customer is missing.',
        requiredHint: 'Fill in the company name, customer name or customer code of a customer in the Customer Master.',
        description: 'Company name or customer name as in the Customer Master (customer code also works).'
    },
    { key: 'startDate', label: 'Start Date', type: 'date', required: true, aliases: ['Start Date'] },
    { key: 'endDate', label: 'End Date', type: 'date', required: true, aliases: ['End Date'] },
    { key: 'value', label: 'Value', type: 'number', default: 0, aliases: ['Value', 'Contract Value'] },
    {
        key: 'status', label: 'Status', type: 'option', options: CONTRACT_STATUSES, default: 'Draft',
        aliases: ['Status'],
        description: 'Empty means Draft for a new contract.'
    },
    { key: 'category', label: 'Category', default: 'Sales Agreement', aliases: ['Category'] },
    { key: 'renewalRules', label: 'Renewal Rules', default: 'Auto-Renew annually', aliases: ['Renewal Rules'] }
];

const SAVED_FIELDS = ['contractNumber', 'title', 'startDate', 'endDate', 'value', 'status', 'category', 'renewalRules'];

const pickSupplied = (data) => {
    const doc = {};
    SAVED_FIELDS.forEach((key) => {
        if (data[key] !== undefined) doc[key] = data[key];
    });
    if (data.customerId) doc.customerId = data.customerId;
    return doc;
};

/**
 * Customers by company name and customer name, as the importer matched them (the last customer
 * with a name wins, company name before customer name), plus customer codes as a fallback.
 */
const loadCustomers = async () => {
    // Scoped to the company (and branch) of the request by tenantPlugin.
    const customers = await Customer.find({}).select('companyName customerName externalCode').lean();
    const byName = new Map();
    const byCode = new Map();
    customers.forEach((customer) => {
        if (customer.companyName) byName.set(matchKey(customer.companyName), customer);
        if (customer.customerName) byName.set(matchKey(customer.customerName), customer);
        const code = matchKey(customer.externalCode);
        if (code && !byCode.has(code)) byCode.set(code, customer);
    });
    return { byName, byCode };
};

const findCustomer = (customers, value) => (
    customers.byName.get(matchKey(value)) || customers.byCode.get(matchKey(value)) || null
);

module.exports = {
    key: 'contracts',
    label: 'Contracts',
    recordLabel: 'contract',
    recordLabelPlural: 'contracts',
    permissionKey: 'sales_contracts',
    permissions: [['sales_contracts', 'create']],
    model: Contract,
    fields: FIELDS,

    identityKeys(data) {
        return data.contractNumber
            ? [{ key: `no:${matchKey(data.contractNumber)}`, field: 'contractNumber', label: 'contract number' }]
            : [];
    },

    async loadContext({ user, rows }) {
        // Scoped to the company of the request by tenantPlugin.
        const contracts = await Contract.find({}).select('contractNumber title').lean();
        const byNumber = new Map();
        // Two contracts whose numbers differ only in capitals: the importer updated the last one.
        contracts.forEach((contract) => {
            const key = matchKey(contract.contractNumber);
            if (key) byNumber.set(key, contract);
        });

        // Contract numbers are unique across every company (Contract.contractNumber is a unique
        // index), so a number another company uses cannot be saved here. Only the numbers are
        // read, to tell the user before importing instead of failing the row.
        const companyId = String(getTenantId() || user?.companyId || '');
        const numbers = [...new Set(rows.map((data) => data.contractNumber).filter(Boolean))];
        const takenElsewhere = new Set();
        if (numbers.length) {
            const others = await Contract.find({ contractNumber: { $in: numbers } })
                .select('contractNumber companyId')
                .setOptions({ bypassTenant: true })
                .lean();
            others.forEach((contract) => {
                if (String(contract.companyId || '') !== companyId) takenElsewhere.add(contract.contractNumber);
            });
        }

        return { byNumber, takenElsewhere, customers: await loadCustomers() };
    },

    validate(data, { context, issues }) {
        const found = [];
        const hasIssue = (field) => issues.some((issue) => issue.field === field);

        if (data.customer !== undefined && !hasIssue('customer')) {
            const customer = findCustomer(context.customers, data.customer);
            if (customer) {
                data.customerId = String(customer._id);
            } else {
                found.push({
                    field: 'customer',
                    code: 'NOT_FOUND',
                    message: `Customer "${data.customer}" was not found.`,
                    hint: 'Use the company name, customer name or customer code exactly as in the Customer Master.'
                });
            }
        }

        if (data.contractNumber && !context.byNumber.has(matchKey(data.contractNumber)) && context.takenElsewhere.has(data.contractNumber)) {
            found.push({
                field: 'contractNumber',
                code: 'NUMBER_TAKEN',
                message: `Contract number "${data.contractNumber}" is already in use.`,
                hint: 'Contract numbers must be unique. Use a different number.'
            });
        }
        return found;
    },

    match(data, context) {
        const record = data.contractNumber && context.byNumber.get(matchKey(data.contractNumber));
        return record ? { record, by: 'contract number', field: 'contractNumber' } : null;
    },

    describe(record) {
        return [record.contractNumber, record.title].filter(Boolean).join(' · ');
    },

    toCreate(data) {
        const doc = pickSupplied(data);
        if (!doc.title) doc.title = `Contract ${data.contractNumber}`;
        return doc;
    },

    /** Only the values the row supplies: a blank cell leaves the stored value unchanged. */
    toUpdate(data) {
        return { ...pickSupplied(data), updatedAt: new Date() };
    }
};
