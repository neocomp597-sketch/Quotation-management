const RolePermission = require('../models/RolePermission');
const User = require('../models/User');
const Company = require('../models/Company');
const AuditLog = require('../models/AuditLog');
const { getTenantId } = require('../middlewares/tenantContext');
const { invalidateRolePermissionCache, getRolePermissions } = require('../middlewares/permissionMiddleware');
const { broadcastCrmUpdate } = require('../config/socket');
const {
    MENU_GROUPS,
    ROLE_OPTIONS,
    ROLE_LABELS,
    DEFAULT_ROLE_PERMISSIONS,
    PERMISSION_ACTIONS,
    getPermissionActionMap,
    getLockedViewKeys,
    mergeUserPermissions,
    sanitizePermissions,
    resolvePermissions,
    buildPermissions
} = require('../config/authorization');

const getEffectiveCompanyId = async (req) => {
    let companyId = req.query?.companyId || req.headers?.['x-company-id'] || req.body?.companyId || req.user?.companyId || getTenantId?.();
    if (!companyId) {
        const firstCompany = await Company.findOne().lean();
        if (firstCompany) {
            companyId = firstCompany._id;
        }
    }
    return companyId?.toString ? companyId.toString() : companyId;
};

/**
 * Robustly converts a Mongoose Map / plain object / native Map into a
 * plain JS object so resolvePermissions can iterate it safely.
 */
const toPermissionObject = (menuVisibility) => {
    if (!menuVisibility) return {};
    try {
        if (typeof menuVisibility.toObject === 'function') {
            const flat = menuVisibility.toObject({ flattenMaps: true });
            return typeof flat === 'object' && !(flat instanceof Map) ? flat : {};
        }
        if (menuVisibility instanceof Map) return Object.fromEntries(menuVisibility);
        if (typeof menuVisibility === 'object') return { ...menuVisibility };
    } catch { /* swallowed */ }
    return {};
};

// What "Reset Role Defaults" restores: the built-in defaults, or nothing for a custom role.
const getRoleDefaults = (roleKey) => resolvePermissions(roleKey, DEFAULT_ROLE_PERMISSIONS[roleKey] || buildPermissions([]));

const buildRolePayload = (doc) => {
    const roleKey = doc.role;
    const rawPerms = toPermissionObject(doc.menuVisibility);
    return {
        role:        roleKey,
        label:       doc.label || ROLE_LABELS[roleKey] || roleKey,
        description: doc.description || '',
        locked:      false,
        isCustom:    doc.isCustom || false,
        permissions: resolvePermissions(roleKey, rawPerms),
        defaults:    getRoleDefaults(roleKey),
        lockedViewKeys: getLockedViewKeys(roleKey),
        updatedAt:   doc.updatedAt || null
    };
};

/** The flags that differ between two permission objects, as { key: [before, after] }. */
const changedFlags = (before = {}, after = {}) => Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((key) => Boolean(before[key]) !== Boolean(after[key]))
    .reduce((changes, key) => {
        changes[key] = [Boolean(before[key]), Boolean(after[key])];
        return changes;
    }, {});

/** Records a permission change; a failure here never fails the save itself. */
const recordPermissionAudit = async ({ req, companyId, entityType, entityId, action, changes, reason }) => {
    if (!Object.keys(changes).length) return;
    try {
        await AuditLog.create({
            action,
            entityType,
            entityId,
            userId: req.user.id,
            userName: req.user.name,
            oldValue: Object.fromEntries(Object.entries(changes).map(([key, [before]]) => [key, before])),
            newValue: Object.fromEntries(Object.entries(changes).map(([key, [, after]]) => [key, after])),
            reason,
            companyId
        });
    } catch (error) {
        console.warn('Permission audit log failed:', error.message);
    }
};

/** Tells open browser sessions to reload their permissions. */
const announcePermissionChange = (data) => {
    try {
        broadcastCrmUpdate('PERMISSIONS', 'UPDATE', data);
    } catch (error) {
        console.warn('Permission change broadcast failed:', error.message);
    }
};

// ─── GET /authorization ────────────────────────────────────────────────────
exports.getAuthorizationMatrix = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const query = companyId ? { companyId } : {};

        // Fetch role documents for this company (built-in + custom)
        const documents = await RolePermission.find(query)
            .select('role label description isCustom menuVisibility createdAt companyId')
            .sort({ createdAt: 1 })
            .lean();

        // Also ensure the built-in roles exist in the response even if not in DB for this company
        const foundRoles = new Set(documents.map((d) => d.role));
        const syntheticBuiltIns = ROLE_OPTIONS
            .filter((r) => !foundRoles.has(r))
            .map((r) => ({
                role:          r,
                label:         ROLE_LABELS[r] || r,
                description:   '',
                isCustom:      false,
                menuVisibility: DEFAULT_ROLE_PERMISSIONS[r] || {}
            }));

        const allDocs = [...syntheticBuiltIns, ...documents];
        const roles   = allDocs.map(buildRolePayload);

        res.json({
            menuGroups: MENU_GROUPS,
            roles,
            actions: PERMISSION_ACTIONS,
            permissionActions: getPermissionActionMap()
        });
    } catch (error) {
        console.error('getAuthorizationMatrix error:', error);
        res.status(500).json({ message: 'Failed to load authorization matrix', error: error.message });
    }
};

// ─── GET /authorization/me ─────────────────────────────────────────────────
exports.getMyPermissions = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const role     = req.user?.role || 'sales';
        const rolePerms = await getRolePermissions(companyId, role);

        let userCustom = {};
        if (req.user?.id) {
            const userDoc = await User.findById(req.user.id).select('customPermissions').lean();
            userCustom = toPermissionObject(userDoc?.customPermissions);
        }

        res.json({
            role,
            menuGroups:  MENU_GROUPS,
            permissions: mergeUserPermissions(role, rolePerms, userCustom),
            permissionActions: getPermissionActionMap()
        });
    } catch (error) {
        console.error('getMyPermissions error:', error);
        res.status(500).json({ message: 'Failed to load permissions', error: error.message });
    }
};

// ─── PUT /authorization/:role ──────────────────────────────────────────────
exports.updateRolePermissions = async (req, res) => {
    try {
        const { role } = req.params;
        const companyId = await getEffectiveCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing' });
        }

        const permissionsInput = req.body?.permissions;
        if (!permissionsInput || typeof permissionsInput !== 'object' || Array.isArray(permissionsInput)) {
            return res.status(400).json({ message: 'Permissions are required' });
        }

        const previous = await RolePermission.findOne({ role, companyId }).select('menuVisibility').lean();
        const previousPermissions = resolvePermissions(role, toPermissionObject(previous?.menuVisibility));

        // One document holds the whole role, so the update is applied all at once or not at all.
        // A new document takes companyId from the filter (and from tenantPlugin's $setOnInsert).
        const sanitizedPermissions = sanitizePermissions(permissionsInput);
        const doc = await RolePermission.findOneAndUpdate(
            { role, companyId },
            {
                $set: { menuVisibility: sanitizedPermissions, updatedBy: req.user?.id || null },
                $setOnInsert: { createdBy: req.user?.id || null }
            },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: false }
        );

        await invalidateRolePermissionCache(companyId, role);
        const payload = buildRolePayload(doc);
        await recordPermissionAudit({
            req,
            companyId,
            entityType: 'RolePermission',
            entityId: doc._id,
            action: req.body?.reason === 'reset' ? 'ROLE_PERMISSIONS_RESET' : 'ROLE_PERMISSIONS_UPDATED',
            changes: changedFlags(previousPermissions, payload.permissions),
            reason: `Role: ${role}`
        });
        announcePermissionChange({ companyId, role });

        res.json(payload);
    } catch (error) {
        console.error('updateRolePermissions error:', error);
        res.status(500).json({ message: 'Failed to update permissions', error: error.message });
    }
};

// ─── POST /authorization/roles ─────────────────────────────────────────────
// Creates a new custom role with a slug key, display label and description.
exports.createRole = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing' });
        }
        const { label, description } = req.body || {};
        if (!label || !label.trim()) {
            return res.status(400).json({ message: 'Role label is required' });
        }

        // Derive a safe slug from the label (lowercase, underscores)
        const role = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (!role) {
            return res.status(400).json({ message: 'Invalid label — could not create a valid key' });
        }

        const existing = await RolePermission.findOne({ role, companyId }).select('_id').lean();
        if (existing) {
            return res.status(409).json({ message: `Role "${role}" already exists` });
        }

        // Default: no permissions
        const defaultPerms = buildPermissions([]);
        const doc = await RolePermission.create({
            role,
            label:         label.trim(),
            description:   (description || '').trim(),
            isCustom:      true,
            menuVisibility: defaultPerms,
            companyId,
            createdBy:     req.user?.id || null,
            updatedBy:     req.user?.id || null
        });

        res.status(201).json(buildRolePayload(doc));
    } catch (error) {
        console.error('createRole error:', error);
        res.status(500).json({ message: 'Failed to create role', error: error.message });
    }
};

// ─── PATCH /authorization/roles/:role ─────────────────────────────────────
// Updates label / description for a custom role.
exports.updateRoleMeta = async (req, res) => {
    try {
        const { role } = req.params;
        const companyId = await getEffectiveCompanyId(req);
        const { label, description } = req.body || {};

        const doc = await RolePermission.findOne({ role, ...(companyId ? { companyId } : {}) });
        if (!doc) return res.status(404).json({ message: 'Role not found' });
        if (!doc.isCustom) return res.status(400).json({ message: 'Only custom roles can be renamed' });

        if (label)       doc.label       = label.trim();
        if (description !== undefined) doc.description = (description || '').trim();
        await doc.save();

        res.json(buildRolePayload(doc));
    } catch (error) {
        console.error('updateRoleMeta error:', error);
        res.status(500).json({ message: 'Failed to update role', error: error.message });
    }
};

// ─── DELETE /authorization/roles/:role ────────────────────────────────────
exports.deleteRole = async (req, res) => {
    try {
        const { role } = req.params;
        const companyId = await getEffectiveCompanyId(req);
        if (ROLE_OPTIONS.includes(role)) {
            return res.status(400).json({ message: 'Built-in roles cannot be deleted' });
        }
        await RolePermission.deleteOne({ role, ...(companyId ? { companyId } : {}) });
        await invalidateRolePermissionCache(companyId, role);
        announcePermissionChange({ companyId, role });
        res.json({ message: `Role "${role}" deleted` });
    } catch (error) {
        console.error('deleteRole error:', error);
        res.status(500).json({ message: 'Failed to delete role', error: error.message });
    }
};

// ─── POST /authorization/initialize ───────────────────────────────────────
exports.initializeDefaults = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing' });
        }
        const rolesToSeed = ROLE_OPTIONS;
        const results = [];
        for (const role of rolesToSeed) {
            const defaultPerms = sanitizePermissions(DEFAULT_ROLE_PERMISSIONS[role] || {});
            
            const result = await RolePermission.updateOne(
                { role, companyId },
                {
                    $setOnInsert: {
                        role,
                        label: ROLE_LABELS[role] || role,
                        description: '',
                        isCustom: false,
                        menuVisibility: defaultPerms,
                        companyId
                    }
                },
                { upsert: true }
            );

            if (result.upsertedCount > 0) {
                results.push({ role, action: 'seeded' });
            } else {
                results.push({ role, action: 'already_exists' });
            }
        }
        res.json({ message: 'Initialization complete', results });
    } catch (error) {
        console.error('initializeDefaults error:', error);
        res.status(500).json({ message: 'Failed to initialize defaults', error: error.message });
    }
};
