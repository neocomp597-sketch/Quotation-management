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
 * X products with no MGR 1; a product with no MGR is never seen). Users with no values, admins and
 * super admins see everything. Read from the user on each request, so a change applies at once.
 *
 * Applied to every Invoice Bulk Upload read and write: list, cards, search, MGR filters, export,
 * return history, details / activity log, serial search, add, edit, return and Excel import; and to
 * every Serial No Transfer tab: Serial No List, details, transfer / assign / past entry, Transfer
 * History, Customer Activity Log and its export, and Branch Transfer (controllers/serialTransferController.js);
 * and to the service tickets on the Customer Service dashboards, register, ticket details and visits, where a
 * user also keeps the tickets they raised or are assigned to (getTicketMgrCondition in controllers/ticketController.js).
 */

const MGR_FIELDS = { MGR1: 'mgr1', MGR2: 'mgr2', MGR3: 'mgr3', MGR4: 'mgr4', MGR5: 'mgr5' };

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

    const mgrs = await MGR.find({ _id: { $in: ids }, companyId: user.companyId })
        .select('mgrType')
        .lean();
    return mgrs.reduce((access, mgr) => {
        const field = MGR_FIELDS[mgr.mgrType];
        if (field) (access[field] = access[field] || []).push(mgr._id);
        return access;
    }, {});
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

/**
 * The Product condition of `access` (from getMgrAccess, not null), or null when it allows nothing.
 * On each level the user was given values for, the product must carry one of them or nothing at all
 * (a level the product leaves blank does not hide it), and it must carry a given value on at least
 * one of those levels, so a product with no MGR stays hidden. A user given values on MGR 1 only
 * therefore sees exactly the products of those MGR 1 values.
 */
const productCondition = (access) => {
    const levels = Object.entries(access).filter(([, ids]) => ids?.length);
    if (!levels.length) return null;
    return {
        $and: levels.map(([field, ids]) => ({ $or: [{ [field]: { $in: ids } }, { [field]: null }] })),
        $or: levels.map(([field, ids]) => ({ [field]: { $in: ids } }))
    };
};

/**
 * Ids of the products the access allows (`access` from getMgrAccess, not null). MGR ids belong to
 * one company, so they alone pick its products (pre-company products included).
 */
const allowedProductIds = async (access) => {
    const condition = productCondition(access);
    if (!condition) return [];
    return Product.distinct('_id', condition);
};

/**
 * The condition to add to an Asset / AssetHistory query so that only the serials of `access`
 * (from getMgrAccess) are read, or null when it does not limit anything.
 */
const accessCondition = async (access) => (
    access ? { productId: { $in: await allowedProductIds(access) } } : null
);

/** accessCondition of the request user. */
const mgrAccessCondition = async (req) => accessCondition(await getMgrAccess(req));

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
    const ids = await Product.distinct('mgr1', { _id: { $in: await allowedProductIds(access) } });
    return ids.filter(Boolean);
};

/** True when `access` (from getMgrAccess) allows the product (an id or a populated product). */
const accessAllowsProduct = async (access, productId) => {
    if (!access) return true;
    const id = String(productId?._id || productId || '');
    const condition = productCondition(access);
    if (!condition || !mongoose.Types.ObjectId.isValid(id)) return false;
    return Boolean(await Product.exists({ _id: id, ...condition }).setOptions({ bypassTenant: true }));
};

/** True when the request user may see an entry of this product. */
const canSeeProduct = async (req, productId) => accessAllowsProduct(await getMgrAccess(req), productId);

/**
 * Set of the product ids (strings) `user` may import or save entries for, or null when the user
 * is not limited. Used by the Invoice Bulk Upload importer, which checks many rows at once.
 */
const allowedProductIdSet = async (user) => {
    const access = await getUserMgrAccess(user);
    return access ? new Set((await allowedProductIds(access)).map(String)) : null;
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
    accessCondition,
    mgrAccessCondition,
    mgr1FilterCondition,
    allowedMgr1Ids,
    accessAllowsProduct,
    canSeeProduct,
    allowedProductIdSet,
    refuseMgrLimited,
    MGR_ACCESS_DENIED
};
