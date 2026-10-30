const mongoose = require('mongoose');
const MGR = require('../models/MGR');
const Product = require('../models/Product');
const User = require('../models/User');
const { isSuperAdminRole } = require('../middlewares/authMiddleware');

/**
 * MGR access of Invoice Bulk Upload and Serial No Transfer, set per user in Authorization > Team
 * Users ("MGR Access"); one setting for both screens.
 *
 * A user given MGR values sees only the serial numbers whose product carries them: any of the
 * values of one level, and every level that has values (MGR 1 = IND sees IND products only;
 * MGR 1 = IND with MGR 2 = X sees the IND products of X). Users with no values, admins and super
 * admins see everything. Read from the user on each request, so a change applies at once.
 *
 * Applied to every Invoice Bulk Upload read and write: list, cards, search, MGR filters, export,
 * return history, details / activity log, serial search, add, edit, return and Excel import; and to
 * every Serial No Transfer tab: Serial No List, details, transfer / assign / past entry, Transfer
 * History, Customer Activity Log and its export, and Branch Transfer (controllers/serialTransferController.js).
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

const productConditions = (access) => Object.entries(access).map(([field, ids]) => ({ [field]: { $in: ids } }));

/**
 * Ids of the products the access allows (`access` from getMgrAccess, not null). MGR ids belong to
 * one company, so they alone pick its products (pre-company products included).
 */
const allowedProductIds = async (access) => {
    const levels = productConditions(access);
    if (!levels.length) return [];
    return Product.distinct('_id', { $and: levels });
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

/** True when `access` (from getMgrAccess) allows the product (an id or a populated product). */
const accessAllowsProduct = async (access, productId) => {
    if (!access) return true;
    const id = String(productId?._id || productId || '');
    const levels = productConditions(access);
    if (!levels.length || !mongoose.Types.ObjectId.isValid(id)) return false;
    return Boolean(await Product.exists({ _id: id, $and: levels }).setOptions({ bypassTenant: true }));
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
    accessAllowsProduct,
    canSeeProduct,
    allowedProductIdSet,
    refuseMgrLimited,
    MGR_ACCESS_DENIED
};
