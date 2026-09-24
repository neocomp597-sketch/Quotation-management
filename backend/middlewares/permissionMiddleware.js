const RolePermission = require('../models/RolePermission');
const { resolvePermissions } = require('../config/authorization');

const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin'];

/**
 * Allows the request through only when the user's role grants `permissionKey`.
 * Admins bypass the check. Must run after `protect`.
 */
const requirePermission = (permissionKey) => async (req, res, next) => {
    try {
        if (ADMIN_ROLES.includes(req.user?.role)) {
            return next();
        }

        const roleDoc = await RolePermission.findOne({
            companyId: req.user?.companyId,
            role: req.user?.role
        }).lean();

        const permissions = resolvePermissions(req.user?.role, roleDoc?.menuVisibility || {});
        if (permissions[permissionKey] === true) {
            return next();
        }

        return res.status(403).json({ message: `Access denied. Requires '${permissionKey}' permission.` });
    } catch (error) {
        return res.status(500).json({ message: 'Authorization error', error: error.message });
    }
};

module.exports = { requirePermission };
