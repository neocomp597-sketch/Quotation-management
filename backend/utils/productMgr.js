/**
 * MGR values for Invoice Bulk Upload records (Asset / AssetHistory).
 *
 * The Product Master is the single source of truth for a product's MGR 1-5
 * assignment. Serial/asset records never store their own copy: whenever an
 * asset is read, its mgr1..mgr5 are derived from the linked product at that
 * moment, so assigning, changing or removing an MGR in the Product Master is
 * reflected on every previously imported record without re-uploading.
 */

const mongoose = require('mongoose');

const MGR_KEYS = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];

// Display form used across Invoice Bulk Upload: "CODE - Description".
const formatMgrVal = (mgr) => {
    if (!mgr) return '';
    if (typeof mgr === 'string') return mgr;
    const code = String(mgr.code || '').trim();
    const description = String(mgr.description || '').trim();
    if (code && description && code.toLowerCase() !== description.toLowerCase()) {
        return `${code} - ${description}`;
    }
    return description || code || '';
};

// Populate spec for `productId` that also resolves the product's MGR refs.
// `extraSelect` adds product fields beyond name/code (e.g. 'basePrice mrp').
const productMgrPopulate = (extraSelect = '') => ({
    path: 'productId',
    select: ['productName productCode', extraSelect, MGR_KEYS.join(' ')].filter(Boolean).join(' '),
    options: { bypassTenant: true },
    populate: MGR_KEYS.map((key) => ({ path: key, select: 'code description', options: { bypassTenant: true } }))
});

const isPopulatedProduct = (product) =>
    Boolean(product) && typeof product === 'object' && !(product instanceof mongoose.Types.ObjectId);

/**
 * Overwrite a lean asset/history document's mgr1..mgr5 with the live values
 * from its populated product. A product with no MGR assigned yields ''.
 * Only when the product itself cannot be resolved (deleted product) does the
 * legacy value stored on the document remain.
 */
const applyProductMgrs = (doc) => {
    if (!doc || typeof doc !== 'object') return doc;
    const product = doc.productId;
    if (!isPopulatedProduct(product)) return doc;
    for (const key of MGR_KEYS) {
        doc[key] = formatMgrVal(product[key]);
    }
    return doc;
};

const applyProductMgrsToAll = (docs) => (Array.isArray(docs) ? docs.map(applyProductMgrs) : docs);

// Remove client-supplied MGR copies from a write payload.
const stripMgrFields = (payload = {}) => {
    const clean = { ...payload };
    for (const key of MGR_KEYS) delete clean[key];
    return clean;
};

module.exports = {
    MGR_KEYS,
    formatMgrVal,
    productMgrPopulate,
    applyProductMgrs,
    applyProductMgrsToAll,
    stripMgrFields
};
