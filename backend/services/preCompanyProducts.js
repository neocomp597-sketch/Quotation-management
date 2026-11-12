const mongoose = require('mongoose');
const Product = require('../models/Product');
const MGR = require('../models/MGR');
const Asset = require('../models/Asset');
const AuditLog = require('../models/AuditLog');
const { findDuplicate } = require('../utils/productUniqueness');

/**
 * Pre-company products (Product Master > Pre-company Products, administrators).
 *
 * Products saved before companies existed carry no companyId. Invoice Bulk Upload still links
 * serial numbers to them when their code matches, but Product Master lists only the company's own
 * products, so their MGR could not be seen or set. This lists the pre-company products the
 * company's serial numbers use and brings each into the company's Product Master:
 *
 *   move  - nothing outside this company uses the product: it becomes the company's product as it
 *           is (same id), so every record that uses it stays as it is.
 *   copy  - another company (or a record from before companies) also uses it: the company gets its
 *           own copy and the company's serial records (SERIAL_MODELS) are switched to the copy; the
 *           original stays for the others.
 *   link  - the company already has a product with that code: its serial records are switched to it.
 *   blocked - the name is already used by another of the company's products (names are unique),
 *           or the product has no code: nothing is done, the reason is shown.
 *
 * MGR on move / copy: a value that is the company's own is kept; a value from before companies or of
 * another company becomes the company's value of the same MGR level and code when there is one, and
 * blank otherwise. The preview shows the MGR before and after, and every change is in the audit log.
 */

const MGR_FIELDS = { mgr1: 'MGR1', mgr2: 'MGR2', mgr3: 'MGR3', mgr4: 'MGR4', mgr5: 'MGR5' };
// Records that follow a serial number's product; switched to the company's product on copy / link.
const SERIAL_MODELS = ['Asset', 'AssetHistory', 'SerialTransfer', 'SerialBranchTransfer', 'Ticket', 'Warranty'];

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const codeKey = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Dotted schema paths that hold Product ids (top level, arrays of ids, and inside sub-documents). */
const productRefPaths = (schema, prefix = '') => {
    const paths = [];
    schema.eachPath((name, type) => {
        const full = `${prefix}${name}`;
        const ref = type.options?.ref
            || type.caster?.options?.ref
            || (Array.isArray(type.options?.type) ? type.options.type[0]?.ref : undefined);
        if (ref === 'Product') paths.push(full);
        if (type.schema) paths.push(...productRefPaths(type.schema, `${full}.`));
    });
    return paths;
};

/** Ids (strings) among `ids` that a record outside `companyId` refers to, in any collection. */
const usedOutside = async (companyId, ids) => {
    const shared = new Set();
    const wanted = new Set(ids.map(String));
    for (const name of mongoose.modelNames()) {
        const model = mongoose.model(name);
        for (const path of productRefPaths(model.schema)) {
            const filter = { [path]: { $in: ids } };
            if (model.schema.path('companyId')) filter.companyId = { $ne: companyId };
            if (name === 'Product') filter._id = { $nin: ids };
            const found = await model.find(filter).setOptions({ bypassTenant: true }).distinct(path);
            found.map(String).filter((id) => wanted.has(id)).forEach((id) => shared.add(id));
        }
    }
    return shared;
};

/** What every product of a run needs: the pre-company products, serial counts, MGR lookups, sharing. */
const loadContext = async (companyId, onlyIds = null) => {
    const cid = oid(companyId);
    const usedIds = await Asset.find({ companyId: cid }).setOptions({ bypassTenant: true }).distinct('productId');
    const filter = { _id: { $in: usedIds }, companyId: null };
    if (onlyIds) filter._id = { $in: usedIds.filter((id) => onlyIds.includes(String(id))) };
    const products = await Product.find(filter).setOptions({ bypassTenant: true }).sort({ productCode: 1 }).lean();
    const ids = products.map((product) => product._id);
    if (!ids.length) return { cid, products };

    const [counts, companyMgrs, shared] = await Promise.all([
        Asset.aggregate([
            { $match: { companyId: cid, productId: { $in: ids } } },
            { $group: { _id: '$productId', serials: { $sum: 1 } } }
        ]).option({ bypassTenant: true }),
        MGR.find({ companyId: cid }).select('mgrType code').lean(),
        usedOutside(cid, ids)
    ]);
    const productMgrIds = products.flatMap((product) => Object.keys(MGR_FIELDS).map((field) => product[field]).filter(Boolean));
    const mgrs = await MGR.find({ _id: { $in: productMgrIds } }).select('mgrType code companyId').setOptions({ bypassTenant: true }).lean();

    return {
        cid,
        products,
        serials: new Map(counts.map((row) => [String(row._id), row.serials])),
        shared,
        mgrById: new Map(mgrs.map((mgr) => [String(mgr._id), mgr])),
        companyMgrById: new Map(companyMgrs.map((mgr) => [String(mgr._id), mgr])),
        companyMgrByCode: new Map(companyMgrs.map((mgr) => [`${mgr.mgrType}|${codeKey(mgr.code)}`, mgr]))
    };
};

/** MGR of a product now (codes) and after it joins the company (codes and ids). */
const mgrChange = (product, ctx) => {
    const now = {};
    const after = {};
    const afterIds = {};
    for (const [field, type] of Object.entries(MGR_FIELDS)) {
        const id = product[field] ? String(product[field]) : '';
        const own = id ? ctx.companyMgrById.get(id) : null;
        const foreign = id && !own ? ctx.mgrById.get(id) : null;
        const match = own || (foreign ? ctx.companyMgrByCode.get(`${type}|${codeKey(foreign.code)}`) : null);
        now[field] = (own || foreign)?.code || '';
        after[field] = match?.code || '';
        afterIds[field] = match ? match._id : null;
    }
    return { now, after, afterIds };
};

/** The plan for one pre-company product (reads only). Looks up name / code conflicts as they are now. */
const planProduct = async (product, ctx) => {
    const mgr = mgrChange(product, ctx);
    const row = {
        _id: String(product._id),
        productCode: product.productCode || '',
        productName: product.productName || '',
        serials: ctx.serials.get(String(product._id)) || 0,
        usedElsewhere: ctx.shared.has(String(product._id)),
        mgrNow: mgr.now,
        mgrAfter: mgr.after,
        mgrAfterIds: mgr.afterIds,
        target: null,
        action: 'move',
        reason: ''
    };
    if (!String(product.productCode || '').trim()) {
        return { ...row, action: 'blocked', reason: 'It has no product code.' };
    }
    const sameCode = await findDuplicate('productCode', product.productCode, { companyId: ctx.cid });
    if (sameCode) {
        const target = await Product.findById(sameCode._id).select('productCode productName mgr1 mgr2 mgr3 mgr4 mgr5').setOptions({ bypassTenant: true }).lean();
        const codes = Object.fromEntries(Object.keys(MGR_FIELDS).map((field) => [field, ctx.companyMgrById.get(String(target?.[field] || ''))?.code || '']));
        return { ...row, action: 'link', target: { _id: String(sameCode._id), productCode: sameCode.productCode, productName: sameCode.productName }, mgrAfter: codes, mgrAfterIds: null };
    }
    const sameName = await findDuplicate('productName', product.productName, { companyId: ctx.cid });
    if (sameName) {
        return { ...row, action: 'blocked', reason: `Its name is already used by your product ${sameName.productCode}. Rename one of them first.` };
    }
    return { ...row, action: row.usedElsewhere ? 'copy' : 'move' };
};

const publicRow = ({ mgrAfterIds, ...row }) => row;

/** Preview: the pre-company products the company's serial numbers use, with what would happen to each. */
const planPreCompanyProducts = async (companyId) => {
    const ctx = await loadContext(companyId);
    const rows = [];
    for (const product of ctx.products) rows.push(publicRow(await planProduct(product, ctx)));
    return rows;
};

/** Switches the company's serial records from one product to another; returns how many changed. */
const repoint = async (cid, fromId, toId) => {
    let changed = 0;
    for (const name of SERIAL_MODELS) {
        if (!mongoose.modelNames().includes(name)) continue;
        const result = await mongoose.model(name)
            .updateMany({ companyId: cid, productId: fromId }, { $set: { productId: toId } })
            .setOptions({ bypassTenant: true });
        changed += result.modifiedCount || 0;
    }
    return changed;
};

/**
 * Brings the chosen pre-company products (`ids`) into the company's Product Master, one at a time,
 * re-checking each just before it is changed. Returns one result per product. Running it again is
 * safe: a moved product is no longer pre-company, and a copied one is then found by its code.
 */
const adoptPreCompanyProducts = async (companyId, ids, user) => {
    const ctx = await loadContext(companyId, ids.map(String));
    const results = [];
    for (const product of ctx.products) {
        const plan = await planProduct(product, ctx);
        const result = { productCode: plan.productCode, productName: plan.productName, action: plan.action, done: false, message: '' };
        try {
            let productId = product._id;
            let serialRecords = 0;
            if (plan.action === 'blocked') {
                result.message = plan.reason;
            } else if (plan.action === 'move') {
                const moved = await Product.updateOne(
                    { _id: product._id, companyId: null },
                    { $set: { companyId: ctx.cid, ...plan.mgrAfterIds, updatedAt: new Date() } }
                ).setOptions({ bypassTenant: true });
                result.done = moved.modifiedCount === 1;
                result.message = result.done ? 'Moved into your Product Master.' : 'Already moved.';
            } else {
                if (plan.action === 'copy') {
                    const { _id, __v, createdAt, updatedAt, ...fields } = product;
                    const copy = new Product({ ...fields, companyId: ctx.cid, ...plan.mgrAfterIds });
                    copy.$locals.bypassTenant = true;
                    await copy.save({ validateBeforeSave: false });
                    productId = copy._id;
                } else {
                    productId = oid(plan.target._id);
                }
                serialRecords = await repoint(ctx.cid, product._id, productId);
                result.done = true;
                result.message = plan.action === 'copy'
                    ? `Copied into your Product Master (the original is also used outside your company); ${serialRecords} serial records now use the copy.`
                    : `${serialRecords} serial records now use your product ${plan.target.productCode}.`;
            }
            if (result.done) {
                await AuditLog.create([{
                    action: 'PRE_COMPANY_PRODUCT_ADOPTED',
                    entityType: 'Product',
                    entityId: productId,
                    userId: user.id,
                    userName: user.name,
                    oldValue: { productId: String(product._id), productCode: product.productCode, mgr: plan.mgrNow },
                    newValue: { action: plan.action, productId: String(productId), mgr: plan.mgrAfter, serialRecords },
                    reason: `Pre-company product ${product.productCode} brought into Product Master`,
                    companyId: ctx.cid
                }], { bypassTenant: true }).catch((error) => console.warn('[preCompanyProducts] audit log failed:', error.message));
            }
        } catch (error) {
            result.message = `Not changed: ${error.message}`;
        }
        results.push(result);
    }
    return results;
};

module.exports = { planPreCompanyProducts, adoptPreCompanyProducts, productRefPaths };
