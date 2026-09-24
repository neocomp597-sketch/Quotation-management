const RolePermission = require('../models/RolePermission');
const { resolvePermissions } = require('../config/authorization');

const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin'];

const isAdminUser = (user) => ADMIN_ROLES.includes(user?.role);

/**
 * Resolved permission map for the current user, cached on the request.
 * Admins get `null`, meaning "everything allowed".
 */
const getUserPermissions = async (req) => {
    if (isAdminUser(req.user)) return null;
    if (req.resolvedPermissions) return req.resolvedPermissions;

    const roleDoc = await RolePermission.findOne({
        companyId: req.user?.companyId,
        role: req.user?.role
    }).lean();

    req.resolvedPermissions = resolvePermissions(req.user?.role, roleDoc?.menuVisibility || {});
    return req.resolvedPermissions;
};

const hasPermission = async (req, permissionKey) => {
    const permissions = await getUserPermissions(req);
    return permissions === null || permissions[permissionKey] === true;
};

/**
 * Allows the request through only when the user's role grants `permissionKey`.
 * Admins bypass the check. Must run after `protect`.
 */
const requirePermission = (permissionKey) => async (req, res, next) => {
    try {
        if (await hasPermission(req, permissionKey)) {
            return next();
        }
        return res.status(403).json({ message: `Access denied. Requires '${permissionKey}' permission.` });
    } catch (error) {
        return res.status(500).json({ message: 'Authorization error', error: error.message });
    }
};

module.exports = { requirePermission, getUserPermissions, hasPermission, isAdminUser };
