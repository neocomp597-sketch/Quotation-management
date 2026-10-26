const RolePermission = require('../models/RolePermission');
const User = require('../models/User');
const {
    MENU_GROUPS,
    resolvePermissions,
    mergeUserPermissions,
    hasPermission
} = require('../config/authorization');
const { getApiRequirement } = require('../config/apiPermissions');
const { getCachedJson, setCachedJson } = require('../utils/apiCache');
const { invalidateCache } = require('../utils/cacheInvalidation');

const ROLE_PERMISSION_CACHE_TTL_SECONDS = Number(process.env.ROLE_PERMISSION_CACHE_TTL_SECONDS || 60);

const ACTION_VERBS = { view: 'view', create: 'create records in', modify: 'edit records in', delete: 'delete records in' };

const SCREEN_LABELS = MENU_GROUPS.reduce((labels, group) => {
    (group.children || []).forEach((child) => {
        if (!labels[child.key]) labels[child.key] = child.label;
    });
    return labels;
}, {});

const isSuperAdminRole = (role) => ['super_admin', 'superadmin'].includes(String(role || '').toLowerCase());

/** Mongoose Map / native Map / plain object -> plain object. */
const toPlainObject = (value) => {
    if (!value) return {};
    if (value instanceof Map) return Object.fromEntries(value);
    if (typeof value.toObject === 'function') return value.toObject({ flattenMaps: true });
    return typeof value === 'object' ? value : {};
};

const rolePermissionCacheKey = (companyId, role) => `rolePermissions:${companyId || 'none'}:${role}`;

/** The resolved permissions of a role, cached briefly; saving the role drops the cache. */
const getRolePermissions = async (companyId, role) => {
    const cacheKey = rolePermissionCacheKey(companyId, role);
    const { hit, redis, value } = await getCachedJson(cacheKey);
    if (hit && value) return value;

    const document = await RolePermission.findOne({ role, ...(companyId ? { companyId } : {}) })
        .select('menuVisibility')
        .lean();
    const permissions = resolvePermissions(role, toPlainObject(document?.menuVisibility));
    await setCachedJson(redis, cacheKey, permissions, ROLE_PERMISSION_CACHE_TTL_SECONDS);
    return permissions;
};

/** Drops the cached permissions of one role, or of every role of the company. */
const invalidateRolePermissionCache = (companyId, role) => (
    invalidateCache(rolePermissionCacheKey(companyId, role || '*'))
);

/**
 * Role permissions with the user's own overrides on top, worked out once per
 * request. `protect` loads the user's overrides; the lighter `auth` middleware
 * does not, so they are read here when missing.
 */
const getEffectivePermissions = async (req) => {
    if (req.effectivePermissions) return req.effectivePermissions;

    const { role, companyId } = req.user || {};
    const rolePermissions = await getRolePermissions(companyId ? String(companyId) : null, role);

    let customPermissions = req.user?.customPermissions;
    if (customPermissions === undefined && req.user?.id) {
        const user = await User.findById(req.user.id).select('customPermissions').lean();
        customPermissions = user?.customPermissions;
    }

    req.effectivePermissions = mergeUserPermissions(role, rolePermissions, toPlainObject(customPermissions));
    return req.effectivePermissions;
};

const deny = (res, key, action) => res.status(403).json({
    code: 'PERMISSION_DENIED',
    message: `You do not have permission to ${ACTION_VERBS[action] || action} ${SCREEN_LABELS[key] || key}.`,
    permission: { key, action }
});

/**
 * Checks every protected API request against config/apiPermissions.js. Runs at the
 * end of `protect`, so no route can be reached around it. Platform super admins
 * are not checked.
 */
const enforceApiPermission = async (req, res, next) => {
    try {
        if (!req.user || isSuperAdminRole(req.user.role)) return next();

        const requirement = await getApiRequirement(req);
        if (!requirement) return next();

        const permissions = await getEffectivePermissions(req);
        if (requirement.anyOf.some(([key, action]) => hasPermission(permissions, key, action))) {
            return next();
        }

        const [key, action] = requirement.anyOf[0];
        return deny(res, key, action);
    } catch (error) {
        console.error('Permission check failed:', error);
        return res.status(500).json({ message: 'Authorization error', error: error.message });
    }
};

/**
 * Allows the request through only when the user may perform `action` (View by
 * default) on the screen `permissionKey`. Must run after `protect`.
 */
const requirePermission = (permissionKey, action = 'view') => async (req, res, next) => {
    try {
        if (isSuperAdminRole(req.user?.role)) return next();

        const permissions = await getEffectivePermissions(req);
        if (hasPermission(permissions, permissionKey, action)) return next();

        return deny(res, permissionKey, action);
    } catch (error) {
        return res.status(500).json({ message: 'Authorization error', error: error.message });
    }
};

module.exports = {
    enforceApiPermission,
    getEffectivePermissions,
    getRolePermissions,
    invalidateRolePermissionCache,
    requirePermission,
    toPlainObject
};
