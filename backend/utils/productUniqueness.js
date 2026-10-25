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

/**
 * The company's products in memory, for imports that check thousands of codes and names: one
 * query instead of several per row. Lookups follow the same rules as the queries they replace:
 *   findByCode / findByName / findByCodeOrName - exact match on the stored value, ignoring case
 *     (like a `^value$` / `i` regex), first product in load order
 *   findDuplicate - the uniqueness rule above (ignores case and runs of spaces)
 * Products the import saves or renames must be passed to add() / update(), so later rows see
 * them exactly as they would see them in the database.
 */
const createProductIndex = (products = []) => {
    const exactKey = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    const storedKey = (value) => String(value ?? '').toUpperCase();
    const maps = { code: new Map(), name: new Map(), codeKey: new Map(), nameKey: new Map() };
    const order = new Map();
    let nextOrder = 0;

    const keysOf = (product) => ({
        code: storedKey(product.productCode),
        name: storedKey(product.productName),
        codeKey: normalizeProductKey(product.productCode),
        nameKey: normalizeProductKey(product.productName)
    });
    const link = (product) => {
        Object.entries(keysOf(product)).forEach(([map, key]) => {
            if (!key) return;
            const list = maps[map].get(key);
            if (list) list.push(product);
            else maps[map].set(key, [product]);
        });
    };
    const unlink = (product) => {
        Object.entries(keysOf(product)).forEach(([map, key]) => {
            const list = maps[map].get(key);
            if (!list) return;
            const rest = list.filter((item) => item !== product);
            if (rest.length) maps[map].set(key, rest);
            else maps[map].delete(key);
        });
    };
    const add = (product) => {
        if (!order.has(product)) order.set(product, nextOrder++);
        link(product);
        return product;
    };
    const first = (map, key) => {
        const list = key ? maps[map].get(key) : null;
        if (!list) return null;
        return list.reduce((best, product) => (order.get(product) < order.get(best) ? product : best));
    };

    products.forEach(add);

    return {
        add,
        /** Applies saved changes (code, name) to an indexed product. */
        update(product, changes) {
            unlink(product);
            Object.assign(product, changes);
            link(product);
        },
        remove(product) {
            unlink(product);
            order.delete(product);
        },
        findByCode: (value) => first('code', exactKey(value)),
        findByName: (value) => first('name', exactKey(value)),
        findByCodeOrName(value) {
            const byCode = first('code', exactKey(value));
            const byName = first('name', exactKey(value));
            if (!byCode || !byName) return byCode || byName;
            return order.get(byCode) <= order.get(byName) ? byCode : byName;
        },
        findDuplicate(field, value, excludeId) {
            const key = normalizeProductKey(value);
            if (!key) return null;
            const list = maps[field === 'productCode' ? 'codeKey' : 'nameKey'].get(key) || [];
            const exclude = excludeId ? String(excludeId) : null;
            const matches = list.filter((product) => String(product._id) !== exclude);
            if (!matches.length) return null;
            return matches.reduce((best, product) => (order.get(product) < order.get(best) ? product : best));
        }
    };
};

/**
 * createProductIndex over the company's Product Master (id, code and name only). Built in slices
 * with a pause in between, so a large catalog does not hold up other requests while it is indexed.
 */
const loadProductIndex = async ({ companyId } = {}) => {
    const query = companyId ? { companyId } : {};
    const products = await Product.find(query).select('_id productCode productName').lean();
    const index = createProductIndex();
    for (let start = 0; start < products.length; start += 2000) {
        if (start) await new Promise((resolve) => setImmediate(resolve));
        products.slice(start, start + 2000).forEach(index.add);
    }
    return index;
};

module.exports = {
    normalizeProductKey,
    exactKeyRegex,
    findDuplicate,
    assertProductUnique,
    createBatchTracker,
    createProductIndex,
    loadProductIndex,
    DuplicateProductError
};
