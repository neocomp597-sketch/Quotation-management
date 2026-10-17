const Product = require('../models/Product');

// Product codes and names must be unique per company. Comparison ignores case and
// treats any run of spaces / non-breaking spaces as one space, so "ABC  Panel" and
// "abc panel" count as the same name.
//
// Products created before this rule may already share a name (SAP issues a new FG code
// per configuration). Those records are left as they are; the rule only applies when a
// product is created or when an edit changes its name or code.

const normalizeProductKey = (value) => String(value ?? '').replace(/[\s ]+/g, ' ').trim().toLowerCase();

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The NBSP is embedded as a literal character: MongoDB's PCRE2 rejects the \u escape.
const WS_CLASS = '[\\s ]';
const exactKeyRegex = (value) => {
    const words = normalizeProductKey(value).split(' ').map(escapeRegex);
    return new RegExp(`^${WS_CLASS}*${words.join(`${WS_CLASS}+`)}${WS_CLASS}*$`, 'i');
};

class DuplicateProductError extends Error {
    constructor(message, field, existing) {
        super(message);
        this.name = 'DuplicateProductError';
        this.statusCode = 409;
        this.field = field;
        this.existing = existing;
    }
}

const describe = (p) => `${p.productCode} - ${p.productName}`;

/**
 * Returns the conflicting product for `field` (productCode / productName), or null.
 * `companyId` is optional inside a tenant request, where the tenant plugin scopes the query.
 */
const findDuplicate = async (field, value, { companyId, excludeId } = {}) => {
    if (!normalizeProductKey(value)) return null;
    const query = { [field]: exactKeyRegex(value) };
    if (companyId) query.companyId = companyId;
    if (excludeId) query._id = { $ne: excludeId };
    return Product.findOne(query).select('productCode productName').lean();
};

/**
 * Throws DuplicateProductError (statusCode 409) if the code or name is already used.
 * Pass `previous` (the stored product) on edit so unchanged fields are not re-checked.
 */
const assertProductUnique = async ({ productCode, productName, companyId, excludeId, previous } = {}) => {
    const changed = (field, value) => !previous || normalizeProductKey(previous[field]) !== normalizeProductKey(value);

    if (productCode !== undefined && changed('productCode', productCode)) {
        const dup = await findDuplicate('productCode', productCode, { companyId, excludeId });
        if (dup) {
            throw new DuplicateProductError(
                `Product Code "${String(productCode).trim()}" already exists (${describe(dup)}). Product codes must be unique.`,
                'productCode', dup
            );
        }
    }

    if (productName !== undefined && changed('productName', productName)) {
        const dup = await findDuplicate('productName', productName, { companyId, excludeId });
        if (dup) {
            throw new DuplicateProductError(
                `Product Name "${String(productName).trim()}" already exists under code ${dup.productCode}. Product names must be unique - use the existing product or give this one a distinct name.`,
                'productName', dup
            );
        }
    }
};

/**
 * Tracks codes / names seen earlier in the same import file, so two rows of one
 * upload cannot create a duplicate pair before either is saved.
 */
const createBatchTracker = () => {
    const codes = new Map();
    const names = new Map();
    return {
        check({ productCode, productName }) {
            const code = normalizeProductKey(productCode);
            const name = normalizeProductKey(productName);
            if (code && codes.has(code)) return `Product Code "${productCode}" appears more than once in this file (first at row ${codes.get(code)}).`;
            if (name && names.has(name)) return `Product Name "${productName}" appears more than once in this file (first at row ${names.get(name)}).`;
            return null;
        },
        add({ productCode, productName }, rowNumber) {
            const code = normalizeProductKey(productCode);
            const name = normalizeProductKey(productName);
            if (code) codes.set(code, rowNumber);
            if (name) names.set(name, rowNumber);
        }
    };
};

module.exports = {
    normalizeProductKey,
    exactKeyRegex,
    findDuplicate,
    assertProductUnique,
    createBatchTracker,
    DuplicateProductError
};
