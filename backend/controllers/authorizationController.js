const RolePermission = require('../models/RolePermission');
const {
    MENU_GROUPS,
    ROLE_OPTIONS,
    ROLE_LABELS,
    DEFAULT_ROLE_PERMISSIONS,
    sanitizePermissions,
    resolvePermissions,
    buildPermissions
} = require('../config/authorization');

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

const buildRolePayload = (doc) => {
    const roleKey = doc.role;
    const isAdmin = roleKey === 'admin';
    const rawPerms = toPermissionObject(doc.menuVisibility);
    return {
        role:        roleKey,
        label:       doc.label || ROLE_LABELS[roleKey] || roleKey,
        description: doc.description || '',
        locked:      isAdmin,
        isCustom:    doc.isCustom || false,
        permissions: isAdmin ? { ...DEFAULT_ROLE_PERMISSIONS.admin } : resolvePermissions(roleKey, rawPerms)
    };
};

// ─── GET /authorization ────────────────────────────────────────────────────
exports.getAuthorizationMatrix = async (req, res) => {
    try {
        // Fetch ALL role documents (built-in + custom)
        const documents = await RolePermission.find().sort({ createdAt: 1 });

        // Also ensure the 3 built-in roles exist in the response even if not in DB
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

        res.json({ menuGroups: MENU_GROUPS, roles });
    } catch (error) {
        console.error('getAuthorizationMatrix error:', error);
        res.status(500).json({ message: 'Failed to load authorization matrix', error: error.message });
    }
};

// ─── GET /authorization/me ─────────────────────────────────────────────────
exports.getMyPermissions = async (req, res) => {
    try {
        const role     = req.user?.role || 'sales';
        const document = role === 'admin' ? null : await RolePermission.findOne({ role });
        res.json({
            role,
            menuGroups:  MENU_GROUPS,
            permissions: resolvePermissions(role, toPermissionObject(document?.menuVisibility))
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
        if (role === 'admin') {
            return res.status(400).json({ message: 'Admin permissions are locked and cannot be edited.' });
        }

        const sanitizedPermissions = sanitizePermissions(req.body?.permissions || {});
        const doc = await RolePermission.findOneAndUpdate(
            { role },
            { menuVisibility: sanitizedPermissions },
            { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: false }
        );

        res.json(buildRolePayload(doc));
    } catch (error) {
        console.error('updateRolePermissions error:', error);
        res.status(500).json({ message: 'Failed to update permissions', error: error.message });
    }
};

// ─── POST /authorization/roles ─────────────────────────────────────────────
// Creates a new custom role with a slug key, display label and description.
exports.createRole = async (req, res) => {
    try {
        const { label, description } = req.body || {};
        if (!label || !label.trim()) {
            return res.status(400).json({ message: 'Role label is required' });
        }

        // Derive a safe slug from the label (lowercase, underscores)
        const role = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (!role) {
            return res.status(400).json({ message: 'Invalid label — could not create a valid key' });
        }

        const existing = await RolePermission.findOne({ role });
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
            menuVisibility: defaultPerms
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
        const { label, description } = req.body || {};

        const doc = await RolePermission.findOne({ role });
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
        if (ROLE_OPTIONS.includes(role)) {
            return res.status(400).json({ message: 'Built-in roles cannot be deleted' });
        }
        await RolePermission.deleteOne({ role });
        res.json({ message: `Role "${role}" deleted` });
    } catch (error) {
        console.error('deleteRole error:', error);
        res.status(500).json({ message: 'Failed to delete role', error: error.message });
    }
};

// ─── POST /authorization/initialize ───────────────────────────────────────
exports.initializeDefaults = async (req, res) => {
    try {
        const rolesToSeed = ROLE_OPTIONS.filter((r) => r !== 'admin');
        const results = [];
        for (const role of rolesToSeed) {
            const existing = await RolePermission.findOne({ role });
            if (!existing) {
                const defaultPerms = sanitizePermissions(DEFAULT_ROLE_PERMISSIONS[role] || {});
                await RolePermission.create({
                    role,
                    label:       ROLE_LABELS[role] || role,
                    description: '',
                    isCustom:    false,
                    menuVisibility: defaultPerms
                });
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
