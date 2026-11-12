const mongoose = require('mongoose');
const MGR = require('../models/MGR');
const Product = require('../models/Product');
const User = require('../models/User');
const { isSuperAdminRole } = require('../middlewares/authMiddleware');

/**
 * MGR access of Invoice Bulk Upload, Serial No Transfer and Customer Service, set per user in
 * Authorization > Team Users ("MGR Access"); one setting for all of them.
 *
 * A user given MGR values sees only the serial numbers whose product carries them: any of the
 * values of one level, on every level that has values, where a level the product leaves blank does
 * not count against it; the product must match on at least one level (MGR 1 = IND sees IND products
 * only; MGR 1 = IND with MGR 2 = X sees the IND products of X, plus IND products with no MGR 2 and
 * X products with no MGR 1). A product with no MGR at all is seen by everyone: an Invoice Bulk Upload
 * adds a new product code to the Product Master without MGR, and its serials must not disappear for
 * limited users until someone sets it. Users with no values, admins and super admins see everything.
 * Read from the user on each request, so a change applies at once.
 *
 * "Blank" means what the screens show: a level counts only when it holds one of the company's current
 * MGR values. A value since deleted from MGR Master, or one of another company or from before
 * companies, shows as blank everywhere and counts as blank here. So the rule hides only serials whose
 * product carries a current MGR value of the company that the user was not given; a serial whose
 * product was deleted, belongs to no company or to another one has no MGR of the company and is seen
 * by everyone, like any product without MGR. (Before, those serials were hidden from every limited
 * user while admins still saw them, and nothing on the screens showed why.)
 *
 * Applied to every Invoice Bulk Upload read and write: list, cards, search, MGR filters, export,
 * return history, details / activity log, serial search, add, edit, return and Excel import; and to
 * every Serial No Transfer tab: Serial No List, details, transfer / assign / past entry, Transfer
 * History, Customer Activity Log and its export, and Branch Transfer (controllers/serialTransferController.js);
 * and to the service tickets on the Customer Service dashboards, register, ticket details and visits, where a
 * user also keeps the tickets they raised or are assigned to (getTicketMgrCondition in controllers/ticketController.js).
 */

const MGR_FIELDS = { MGR1: 'mgr1', MGR2: 'mgr2', MGR3: 'mgr3', MGR4: 'mgr4', MGR5: 'mgr5' };
const PRODUCT_FIELDS = Object.values(MGR_FIELDS);

// Kept on a user's access object under symbols, so that the level lists (Object.entries / keys)
// stay as they are: the user's company, and the company's current MGR ids by product field.
// A screen's MGR filter (mgr1FilterCondition) carries neither and keeps the plain rule
// "products carrying that value".
const ACCESS_COMPANY = Symbol('mgrAccessCompany');
const ACCESS_KNOWN = Symbol('mgrAccessKnownValues');

const isUnrestricted = (user) => {
    const role = String(user?.role || '').toLowerCase();
    return !user?.id || role === 'admin' || isSuperAdminRole(role);
};

/**
 * The MGR values `user` (req.user) is limited to, by product field, e.g. { mgr1: [id, id] }, or
 * null when the user is not limited. Values deleted from the MGR master since leave {}: the user
 * then sees nothing until an administrator sets the access again.
 */
const getUserMgrAccess = async (user) => {
    if (isUnrestricted(user)) return null;

    const saved = await User.findById(user.id).select('mgrAccess').lean();
    const ids = (saved?.mgrAccess || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!ids.length) return null;

    const given = new Set(ids.map(String));
    const mgrs = await MGR.find({ companyId: user.companyId }).select('mgrType').lean();
    const access = {};
    const known = Object.fromEntries(PRODUCT_FIELDS.map((field) => [field, []]));
    for (const mgr of mgrs) {
        const field = MGR_FIELDS[mgr.mgrType];
        if (!field) continue;
        known[field].push(mgr._id);
        if (given.has(String(mgr._id))) (access[field] = access[field] || []).push(mgr._id);
    }
    access[ACCESS_COMPANY] = user.companyId;
    access[ACCESS_KNOWN] = known;
    return access;
};

/** getUserMgrAccess of the request user. */
const getMgrAccess = (req) => getUserMgrAccess(req.user);

/**
 * `access` (from getMgrAccess) for the screen: { mgr1: [{ _id, code, description }] }, so it can
 * say what the user is limited to and offer only those values in its MGR filters. null stays null.
 */
const describeMgrAccess = async (access) => {
    if (!access) return null;
    const mgrs = await MGR.find({ _id: { $in: Object.values(access).flat() } })
        .select('mgrType code description')
        .sort({ code: 1 })
        .lean();
    return Object.fromEntries(Object.keys(access).map((field) => [
        field,
        mgrs.filter((mgr) => MGR_FIELDS[mgr.mgrType] === field)
            .map((mgr) => ({ _id: String(mgr._id), code: mgr.code, description: mgr.description }))
    ]));
};

const givenLevels = (access) => Object.entries(access).filter(([, ids]) => ids?.length);

/**
 * Product condition of the products a user's `access` hides: they carry a current MGR value of the
 * company, and on some level the user was given values for they carry a current value the user was not
 * given, or they carry none of the given values at all. null when the access allows nothing (all its
 * values were deleted from MGR Master: fail closed).
 */
const hiddenProductCondition = (access) => {
    const levels = givenLevels(access);
    if (!levels.length) return null;
    const known = access[ACCESS_KNOWN];
    const carriesKnown = PRODUCT_FIELDS
        .filter((field) => known[field].length)
        .map((field) => ({ [field]: { $in: known[field] } }));
    if (!carriesKnown.length) return { _id: null };
    const visible = {
        $and: levels.map(([field, ids]) => ({ $or: [{ [field]: { $in: ids } }, { [field]: { $nin: known[field] } }] })),
        $or: levels.map(([field, ids]) => ({ [field]: { $in: ids } }))
    };
    return { $and: [{ $or: carriesKnown }, { $nor: [visible] }] };
};

/**
 * Why a user's `access` hides `product` (lean, MGR fields as ids), for an administrator's check:
 * [{ field, value }] for each level where the product carries a current value the user was not
 * given; or [{ field: null, fields }] when it carries none of the given values on any of those levels.
 */
const hiddenReasons = (access, product) => {
    const known = access[ACCESS_KNOWN];
    const has = (ids, value) => Boolean(value) && ids.some((id) => String(id) === String(value));
    const levels = givenLevels(access);
    const reasons = levels
        .filter(([field, ids]) => has(known[field], product[field]) && !has(ids, product[field]))
        .map(([field]) => ({ field, value: String(product[field]) }));
    return reasons.length ? reasons : [{ field: null, fields: levels.map(([field]) => field) }];
};

/** Ids of the products a user's `access` hides (see hiddenProductCondition), or null when it allows nothing. */
const hiddenProductIds = async (access) => {
    const condition = hiddenProductCondition(access);
    if (!condition) return null;
    // MGR ids belong to one company, so they alone pick its products, pre-company ones included.
    return Product.find(condition).setOptions({ bypassTenant: true }).distinct('_id');
};

/** Products carrying one of the values of a screen's MGR filter (an access object without a company). */
const filterProductIds = (access) => {
    const levels = givenLevels(access);
    if (!levels.length) return [];
    return Product.distinct('_id', { $and: levels.map(([field, ids]) => ({ [field]: { $in: ids } })) });
};

/**
 * The condition to add to an Asset / AssetHistory / Ticket / transfer query so that only the serials
 * of `access` (from getMgrAccess) are read, or null when it does not limit anything. For a user it is
 * `{ productId: { $nin: hidden products, $ne: null } }` (records without a product stay out, as before);
 * for a screen's MGR filter `{ productId: { $in: products carrying the value } }`.
 */
const accessCondition = async (access) => {
    if (!access) return null;
    if (!access[ACCESS_KNOWN]) return { productId: { $in: await filterProductIds(access) } };
    const hidden = await hiddenProductIds(access);
    if (!hidden) return { productId: { $in: [] } };
    return { productId: { $nin: hidden, $ne: null } };
};

/** accessCondition of the request user. */
const mgrAccessCondition = async (req) => accessCondition(await getMgrAccess(req));

/**
 * True when the product id `id` passes an accessCondition result `condition` (null = no limit).
 * For combining it with another list of product ids in code.
 */
const conditionAllowsId = (condition, id) => {
    if (!condition) return true;
    const { productId } = condition;
    if (!id) return false;
    if (productId.$in) return productId.$in.some((allowed) => String(allowed) === String(id));
    return !(productId.$nin || []).some((hidden) => String(hidden) === String(id));
};

/**
 * The condition for a screen's MGR 1 filter (`mgr1Id`, e.g. from ?mgr1=): records of the products
 * carrying that value. On top of the user's MGR access, never instead of it. null when none is picked.
 */
const mgr1FilterCondition = async (mgr1Id) => {
    if (!mgr1Id) return null;
    const id = String(mgr1Id);
    if (!mongoose.Types.ObjectId.isValid(id)) return { _id: null };
    return accessCondition({ mgr1: [new mongoose.Types.ObjectId(id)] });
};

/** The MGR 1 values on the products `access` allows, for that filter's options; null when not limited. */
const allowedMgr1Ids = async (access) => {
    if (!access) return null;
    const hidden = hiddenProductCondition(access);
    if (!hidden) return [];
    const ids = await Product.find({ mgr1: { $in: access[ACCESS_KNOWN].mgr1 }, $nor: [hidden] })
        .setOptions({ bypassTenant: true })
        .distinct('mgr1');
    return ids.filter(Boolean);
};

/**
 * True when `access` (from getMgrAccess) allows the product (an id or a populated product). A
 * product that is not found carries no MGR of the company, so it is allowed; whether it may be used
 * at all is for the caller to check.
 */
const accessAllowsProduct = async (access, productId) => {
    if (!access) return true;
    const id = String(productId?._id || productId || '');
    const hidden = hiddenProductCondition(access);
    if (!hidden || !mongoose.Types.ObjectId.isValid(id)) return false;
    return !(await Product.exists({ _id: id, ...hidden }).setOptions({ bypassTenant: true }));
};

/** True when the request user may see an entry of this product. */
const canSeeProduct = async (req, productId) => accessAllowsProduct(await getMgrAccess(req), productId);

/**
 * For the Invoice Bulk Upload importer, which checks many rows at once: null when `user` is not
 * limited, else a function telling whether a product id (or string) is allowed.
 */
const productAccessChecker = async (user) => {
    const access = await getUserMgrAccess(user);
    if (!access) return null;
    const hidden = await hiddenProductIds(access);
    if (!hidden) return () => false;
    const hiddenSet = new Set(hidden.map(String));
    return (productId) => Boolean(productId) && !hiddenSet.has(String(productId));
};

/**
 * Route guard for the old one-step Excel import (POST /api/import/assets): it predates MGR access,
 * so a user limited by it imports through the import screen, which checks every row.
 */
const refuseMgrLimited = async (req, res, next) => {
    try {
        if (await getMgrAccess(req)) {
            return res.status(403).json({ message: 'Your MGR access is limited. Import Invoice Bulk Upload files from the Import button of the Invoice Bulk Upload screen.' });
        }
        return next();
    } catch (error) {
        return next(error);
    }
};

/** Message of an entry refused because its product is outside the user's MGR access. */
const MGR_ACCESS_DENIED = 'This product\'s MGR is outside your MGR access. Ask an administrator to give you access to its MGR, or use a product of your MGR.';

module.exports = {
    getMgrAccess,
    getUserMgrAccess,
    describeMgrAccess,
    hiddenProductCondition,
    hiddenReasons,
    accessCondition,
    mgrAccessCondition,
    conditionAllowsId,
    mgr1FilterCondition,
    allowedMgr1Ids,
    accessAllowsProduct,
    canSeeProduct,
    productAccessChecker,
    refuseMgrLimited,
    MGR_ACCESS_DENIED,
    MGR_FIELDS
};
