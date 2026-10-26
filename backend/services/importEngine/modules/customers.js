const Customer = require('../../../models/Customer');
const { invalidateCustomerCaches } = require('../../../utils/cacheInvalidation');
const { getActiveBranchId } = require('../../../middlewares/tenantContext');

// Customer Master import. The column names each field accepts are the ones the original
// importer (importController.importCustomers) read, in the same order, so the template, SAP
// OCRD exports ("BP Code", "BP Name", "Bill-to Street"...) and older files keep matching.

const matchKey = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const FIELDS = [
    {
        key: 'externalCode', label: 'Customer Code',
        aliases: ['Customer Code', 'customerCode', 'Code', 'BP Code'],
        description: 'Your code for the customer. A code that already exists updates that customer.'
    },
    {
        key: 'customerName', label: 'Customer Name', required: true, fallbackFrom: 'companyName',
        aliases: ['Customer Name', 'customerName', 'Name', 'Contact Person', 'BP Name', 'Company Name', 'companyName', 'Company'],
        requiredMessage: 'Customer name is missing.',
        requiredHint: 'Fill in the customer name or the company name (one is enough).'
    },
    {
        key: 'companyName', label: 'Company Name', required: true, fallbackFrom: 'customerName',
        aliases: ['Company Name', 'companyName', 'Company', 'BP Name', 'Customer Name', 'customerName', 'Name'],
        requiredMessage: 'Company name is missing.',
        requiredHint: 'Fill in the company name or the customer name (one is enough).'
    },
    {
        key: 'gstin', label: 'GSTIN', type: 'upperText',
        aliases: ['GSTIN', 'gstin', 'GST No', 'Federal Tax ID', 'Unified Federal Tax ID', 'VAT Reg. Number', 'Registration No.']
    },
    { key: 'mobile', label: 'Mobile', type: 'phone', aliases: ['Mobile', 'mobile', 'Phone', 'Mobile Phone', 'Telephone 1', 'Telephone 2'] },
    { key: 'email', label: 'Email', type: 'email', aliases: ['Email', 'email', 'E-Mail', 'EmailCC'] },
    { key: 'billingLine1', label: 'Billing Address Line 1', aliases: ['Billing Address Line 1', 'Address Line 1', 'Bill-to Street'] },
    { key: 'billingLine2', label: 'Billing Address Line 2', aliases: ['Billing Address Line 2', 'Address Line 2', 'Bill-to County', 'Bill-to Country'] },
    { key: 'billingCity', label: 'Billing City', aliases: ['City', 'Billing City', 'Bill-to City', 'City/Town/Village'] },
    { key: 'billingState', label: 'Billing State', aliases: ['State', 'Billing State', 'Bill-to State', 'BP State'] },
    { key: 'billingPincode', label: 'Billing Pincode', type: 'pincode', aliases: ['Pincode', 'Billing Pincode', 'Bill-to Zip Code', 'Zip Code'] },
    {
        key: 'shippingLine1', label: 'Shipping Address Line 1',
        aliases: ['Shipping Address Line 1', 'Billing Address Line 1', 'Address Line 1', 'Ship-to Street']
    },
    {
        key: 'shippingLine2', label: 'Shipping Address Line 2',
        aliases: ['Shipping Address Line 2', 'Billing Address Line 2', 'Address Line 2', 'Ship-to County', 'Ship-to Country']
    },
    { key: 'shippingCity', label: 'Shipping City', aliases: ['Shipping City', 'City', 'Ship-to City', 'City/Town/Village'] },
    { key: 'shippingState', label: 'Shipping State', aliases: ['Shipping State', 'State', 'Ship-to State', 'BP State'] },
    { key: 'shippingPincode', label: 'Shipping Pincode', type: 'pincode', aliases: ['Shipping Pincode', 'Pincode', 'Ship-to Zip Code', 'Zip Code'] },
    {
        key: 'defaultDiscount', label: 'Default Discount %', type: 'number', min: 0, max: 100, default: 0,
        aliases: ['Default Discount', 'defaultDiscount', 'Discount', 'Discount %']
    },
    { key: 'logoUrl', label: 'Logo URL', aliases: ['Logo URL', 'logoUrl', 'Picture'] }
];

const ADDRESS_PATHS = {
    billingLine1: 'billingAddress.line1',
    billingLine2: 'billingAddress.line2',
    billingCity: 'billingAddress.city',
    billingState: 'billingAddress.state',
    billingPincode: 'billingAddress.pincode',
    shippingLine1: 'shippingAddress.line1',
    shippingLine2: 'shippingAddress.line2',
    shippingCity: 'shippingAddress.city',
    shippingState: 'shippingAddress.state',
    shippingPincode: 'shippingAddress.pincode'
};

const PLAIN_FIELDS = ['externalCode', 'customerName', 'companyName', 'gstin', 'mobile', 'email', 'defaultDiscount', 'logoUrl'];

const nameKey = (data) => (
    data.companyName && data.customerName ? `${matchKey(data.companyName)}|${matchKey(data.customerName)}` : ''
);

module.exports = {
    key: 'customers',
    label: 'Customers',
    recordLabel: 'customer',
    recordLabelPlural: 'customers',
    permissionKey: 'master_customers',
    model: Customer,
    fields: FIELDS,

    /**
     * What identifies the customer a row describes, the same order the importer matches
     * existing customers in: code, else GSTIN, else company + customer name. Two rows with
     * the same identity are duplicates; the first one is imported.
     */
    identityKeys(data) {
        if (data.externalCode) return [{ key: `code:${matchKey(data.externalCode)}`, field: 'externalCode', label: 'customer code' }];
        if (data.gstin) return [{ key: `gstin:${matchKey(data.gstin)}`, field: 'gstin', label: 'GSTIN' }];
        const key = nameKey(data);
        return key ? [{ key: `name:${key}`, field: 'companyName', label: 'company and customer name' }] : [];
    },

    async loadContext() {
        // Scoped to the company (and branch) of the request by tenantPlugin.
        const customers = await Customer.find({})
            .select('externalCode gstin companyName customerName')
            .lean();
        const byCode = new Map();
        const byGstin = new Map();
        const byName = new Map();
        customers.forEach((customer) => {
            const code = matchKey(customer.externalCode);
            const gstin = matchKey(customer.gstin);
            const name = nameKey(customer);
            if (code && !byCode.has(code)) byCode.set(code, customer);
            if (gstin && !byGstin.has(gstin)) byGstin.set(gstin, customer);
            if (name && !byName.has(name)) byName.set(name, customer);
        });

        // Codes are unique in the whole company (models/Customer.js). Customers of other branches
        // are not updated from this branch, but their codes cannot be used again either.
        const visible = new Set(customers.map((customer) => String(customer._id)));
        const elsewhere = await Customer.find({ externalCode: { $type: 'string', $gt: '' } })
            .setOptions({ bypassBranch: true })
            .select('externalCode companyName customerName')
            .lean();
        const otherBranchCodes = new Map();
        elsewhere.forEach((customer) => {
            if (!visible.has(String(customer._id))) otherBranchCodes.set(matchKey(customer.externalCode), customer);
        });
        return { byCode, byGstin, byName, otherBranchCodes };
    },

    validate(data, { context }) {
        const code = matchKey(data.externalCode);
        const other = code && !context.byCode.has(code) ? context.otherBranchCodes.get(code) : null;
        if (!other) return [];
        return [{
            field: 'externalCode',
            code: 'CODE_IN_OTHER_BRANCH',
            message: `Customer code ${data.externalCode} already belongs to ${other.companyName || other.customerName} in another branch.`,
            hint: 'Each customer needs its own code. Use a different code, or update that customer from its own branch.'
        }];
    },

    match(data, context) {
        const byCode = data.externalCode && context.byCode.get(matchKey(data.externalCode));
        if (byCode) return { record: byCode, by: 'customer code', field: 'externalCode' };
        const byGstin = data.gstin && context.byGstin.get(matchKey(data.gstin));
        if (byGstin) return { record: byGstin, by: 'GSTIN', field: 'gstin' };
        const byName = context.byName.get(nameKey(data));
        if (byName) return { record: byName, by: 'company and customer name', field: 'companyName' };
        return null;
    },

    describe(record) {
        return [record.externalCode, record.companyName || record.customerName].filter(Boolean).join(' · ');
    },

    toCreate(data, { user }) {
        const doc = { createdBy: user?.id || null, billingAddress: {}, shippingAddress: {} };
        PLAIN_FIELDS.forEach((field) => {
            if (data[field] !== undefined) doc[field] = data[field];
        });
        Object.entries(ADDRESS_PATHS).forEach(([field, path]) => {
            if (data[field] === undefined) return;
            const [group, part] = path.split('.');
            doc[group][part] = data[field];
        });
        // An imported customer belongs to the branch it is imported in, as with the Customer form
        // and the original importer; the Customer Master list shows only the selected branch's
        // customers. Set explicitly: the writer may bypass tenantPlugin's default branch.
        doc.branchId = getActiveBranchId() || null;
        return doc;
    },

    /** Only the values the row supplies: a blank cell leaves the stored value unchanged. */
    toUpdate(data) {
        const set = {};
        PLAIN_FIELDS.forEach((field) => {
            if (data[field] !== undefined) set[field] = data[field];
        });
        Object.entries(ADDRESS_PATHS).forEach(([field, path]) => {
            if (data[field] !== undefined) set[path] = data[field];
        });
        return set;
    },

    async afterImport({ user, run }) {
        await invalidateCustomerCaches();
        const saved = run.created + run.updated;
        if (!saved) return;
        const { createCompanyNotifications } = require('../../../utils/notificationHelper');
        await createCompanyNotifications({
            companyId: user?.companyId,
            title: 'Customers Master Imported',
            message: `Successfully imported/updated ${saved} customers (created: ${run.created}, updated: ${run.updated}, failed: ${run.failed}).`,
            type: 'Reminder',
            excludeUserId: user?.id
        });
    }
};
