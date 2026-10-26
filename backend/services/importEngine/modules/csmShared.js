const Customer = require('../../../models/Customer');
const Product = require('../../../models/Product');
const Asset = require('../../../models/Asset');
const Branch = require('../../../models/Branch');
const { insertRows, writeRows } = require('../../../utils/importBatch');
const { getScopedBranches } = require('../../../middlewares/tenantContext');

// Lookups and save helpers shared by the customer service imports (tickets.js, warranties.js,
// amcs.js). Every lookup is one query per 1000 values, made once per checking pass.

const CASE_INSENSITIVE = Customer.CUSTOMER_CODE_COLLATION || { locale: 'en', strength: 2 };
const LOOKUP_CHUNK = 1000;

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
/** How two values are compared: spacing and case do not matter ("c-001" = "C-001"). */
const keyOf = (value) => cleanText(value).toUpperCase();
/** Same key as Asset.serialNumberKey (the unique serial index of a company). */
const serialKey = (value) => cleanText(value).toUpperCase();

const chunk = (list, size) => {
    const chunks = [];
    for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
    return chunks;
};

/** The distinct non-blank values of one field over the parsed rows. */
const distinctValues = (rows, field) => [...new Set((rows || []).map((row) => cleanText(row?.[field])).filter(Boolean))];

/** Records whose `paths` equal one of `values`, ignoring case (the importers' exact match). */
const findByValues = async (Model, paths, values, { select = '', options = null } = {}) => {
    const docs = [];
    for (const part of chunk(values, LOOKUP_CHUNK)) {
        let query = Model.find({ $or: paths.map((path) => ({ [path]: { $in: part } })) }).collation(CASE_INSENSITIVE);
        if (select) query = query.select(select);
        if (options) query = query.setOptions(options);
        docs.push(...await query.lean());
    }
    return docs;
};

/**
 * Whether a record is inside the branches the current request works in. Records without a
 * branch belong to every branch; a request that is not branch-scoped sees everything.
 */
const scopeChecker = () => {
    const branches = getScopedBranches();
    if (!branches) return () => true;
    const allowed = new Set(branches.map(String));
    return (record) => !record?.branchId || allowed.has(String(record.branchId));
};

const CUSTOMER_PATHS = ['externalCode', 'customerName', 'companyName'];

/**
 * Customers by code, customer name or company name - the values the original importers
 * accepted in "Customer Code" / "Customer Name". Codes are unique in the whole company, so the
 * lookup covers every branch (Customer is branch-scoped by tenantPlugin): a customer of another
 * branch is found instead of being reported missing. A code wins over a name; for a name shared
 * by several customers, one in the current branch wins.
 */
const loadCustomers = async (values) => {
    const docs = values.length
        ? await findByValues(Customer, CUSTOMER_PATHS, values, {
            select: '_id externalCode customerName companyName mobile billingAddress.pincode pincode branchId',
            options: { bypassBranch: true }
        })
        : [];
    const inScope = scopeChecker();
    const ordered = [...docs].sort((a, b) => Number(!inScope(a)) - Number(!inScope(b)));
    const byPath = Object.fromEntries(CUSTOMER_PATHS.map((path) => [path, new Map()]));
    ordered.forEach((doc) => {
        CUSTOMER_PATHS.forEach((path) => {
            const key = keyOf(doc[path]);
            if (key && !byPath[path].has(key)) byPath[path].set(key, doc);
        });
    });
    return {
        find(value) {
            const key = keyOf(value);
            if (!key) return null;
            return byPath.externalCode.get(key) || byPath.customerName.get(key) || byPath.companyName.get(key) || null;
        }
    };
};

/** Products of the company by product code, else product name (Product is not branch-scoped). */
const loadProducts = async (values) => {
    const docs = values.length
        ? await findByValues(Product, ['productCode', 'productName'], values, { select: '_id productCode productName' })
        : [];
    const byCode = new Map();
    const byName = new Map();
    docs.forEach((doc) => {
        const code = keyOf(doc.productCode);
        const name = keyOf(doc.productName);
        if (code && !byCode.has(code)) byCode.set(code, doc);
        if (name && !byName.has(name)) byName.set(name, doc);
    });
    return {
        find(value) {
            const key = keyOf(value);
            return key ? byCode.get(key) || byName.get(key) || null : null;
        }
    };
};

/**
 * Serial number entries (Invoice Bulk Upload) of the company by serial number. A serial is
 * unique in the whole company, so every branch is searched. Map: serial key -> asset.
 */
const loadAssets = async (serials) => {
    const keys = [...new Set((serials || []).map(serialKey).filter(Boolean))];
    const found = new Map();
    for (const part of chunk(keys, LOOKUP_CHUNK)) {
        const docs = await Asset.find({ serialNumberKey: { $in: part } })
            .select('_id serialNumber serialNumberKey productId customerId branchId status')
            .setOptions({ bypassBranch: true })
            .lean();
        docs.forEach((doc) => {
            if (!found.has(doc.serialNumberKey)) found.set(doc.serialNumberKey, doc);
        });
    }
    return found;
};

/** Branch names by id (for messages). */
const loadBranchNames = async (ids) => {
    const wanted = [...new Set(ids.filter(Boolean).map(String))];
    if (!wanted.length) return new Map();
    const branches = await Branch.find({ _id: { $in: wanted } }).select('name code').lean();
    return new Map(branches.map((branch) => [String(branch._id), branch.name || branch.code || '']));
};

// ── Row issues ─────────────────────────────────────────────────────────────

const customerNotFound = (value) => ({
    field: 'customer',
    code: 'NOT_FOUND',
    message: `Customer "${value}" was not found in Customer Master.`,
    hint: 'Check the customer code (or name), or add the customer in Customer Master first.'
});

const productNotFound = (value) => ({
    field: 'product',
    code: 'NOT_FOUND',
    message: `Product "${value}" was not found in Product Master.`,
    hint: 'Check the product code (or name), or add the product in Product Master first.'
});

/** Resolves the customer and product of a row into data.customerId / data.productId. */
const resolveCustomerAndProduct = (data, context, issues) => {
    let customer = null;
    if (data.customer) {
        customer = context.customers.find(data.customer);
        if (customer) data.customerId = customer._id;
        else issues.push(customerNotFound(data.customer));
    }
    let product = null;
    if (data.product) {
        product = context.products.find(data.product);
        if (product) data.productId = product._id;
        else issues.push(productNotFound(data.product));
    }
    return { customer, product };
};

// ── Saving ─────────────────────────────────────────────────────────────────

const FIELD_NAMES = {
    serialNumberKey: 'serial number',
    serialNumber: 'serial number',
    ticketNo: 'ticket number',
    contractNo: 'contract number'
};

/** A database error as a sentence for the row it belongs to. */
const describeError = (error, label) => {
    const code = error?.code ?? error?.err?.code;
    const message = error?.errmsg || error?.message || '';
    if (code === 11000 || /E11000/.test(message)) {
        // Bulk write errors carry no keyValue: the fields are read from "dup key: { a: .., b: .. }".
        const keyValue = error?.keyValue || error?.err?.keyValue || error?.errInfo?.keyValue
            || Object.fromEntries([...((message.match(/dup key: \{(.*)\}/) || [])[1] || '').matchAll(/(\w+):/g)].map((match) => [match[1], 1]));
        const fields = Object.keys(keyValue).filter((key) => key !== 'companyId').map((key) => FIELD_NAMES[key] || key).join(', ');
        return `Another ${label} already has the same ${fields || 'unique value'}, so this row was not saved.`;
    }
    if (error?.name === 'ValidationError' && error.errors) {
        return Object.values(error.errors).map((item) => item.message).join(' ');
    }
    return `The database did not accept this row: ${message || 'unknown error'}.`;
};

/**
 * Inserts [{ id, doc }]: each doc (a plain object, or a document already built with new Model)
 * is built and validated once and written in slices with a pause in between, so a batch does
 * not block other requests. Each doc carries its companyId and branchId; no branch is filled in.
 * Returns Map(id -> error message); throws when the outcome is unknown (the engine reconciles).
 */
const insertDocs = async (Model, entries, label) => {
    const errors = new Map();
    const failures = await insertRows(Model, entries.map(({ doc }) => doc), { bypassBranch: true });
    failures.forEach((error, index) => errors.set(entries[index].id, describeError(error, label)));
    return errors;
};

/** Applies [{ id, filter, set }] in slices; every filter must carry companyId. */
const updateDocs = async (Model, entries, label) => {
    const errors = new Map();
    const failures = await writeRows(Model, entries.map(({ filter, set }) => ({ updateOne: { filter, update: { $set: set } } })));
    failures.forEach((error, index) => errors.set(entries[index].id, describeError(error, label)));
    return errors;
};

module.exports = {
    CASE_INSENSITIVE,
    cleanText,
    keyOf,
    serialKey,
    chunk,
    distinctValues,
    findByValues,
    scopeChecker,
    loadCustomers,
    loadProducts,
    loadAssets,
    loadBranchNames,
    customerNotFound,
    productNotFound,
    resolveCustomerAndProduct,
    describeError,
    insertDocs,
    updateDocs
};
