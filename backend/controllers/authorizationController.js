const RolePermission = require('../models/RolePermission');
const {
    MENU_GROUPS,
    ROLE_OPTIONS,
    ROLE_LABELS,
    DEFAULT_ROLE_PERMISSIONS,
    sanitizePermissions,
    resolvePermissions
} = require('../config/authorization');

/**
 * Robustly converts a Mongoose Map / plain object / native Map into a
 * plain JS object so resolvePermissions can iterate it safely.
 */
const toPermissionObject = (menuVisibility) => {
    if (!menuVisibility) return {};

    try {
        // Mongoose document Map — use toObject({ flattenMaps: true })
        if (typeof menuVisibility.toObject === 'function') {
            const flat = menuVisibility.toObject({ flattenMaps: true });
            return typeof flat === 'object' && !(flat instanceof Map) ? flat : {};
        }
        // Native ES6 Map
        if (menuVisibility instanceof Map) {
            return Object.fromEntries(menuVisibility);
        }
        // Plain object (already converted upstream)
        if (typeof menuVisibility === 'object') {
            return { ...menuVisibility };
        }
    } catch {
        // intentionally swallowed — return safe empty object
    }

    return {};
};

const buildRolePayload = (role, rawPermissions = {}) => ({
    role,
    label: ROLE_LABELS[role] || role,
    locked: role === 'admin',
    permissions: resolvePermissions(role, rawPermissions)
});

// ─── GET /authorization ────────────────────────────────────────────────────
exports.getAuthorizationMatrix = async (req, res) => {
    try {
        const documents = await RolePermission.find({ role: { $in: ROLE_OPTIONS } });

        const permissionsByRole = documents.reduce((acc, doc) => {
            acc[doc.role] = toPermissionObject(doc.menuVisibility);
            return acc;
        }, {});

        res.json({
            menuGroups: MENU_GROUPS,
            roles: ROLE_OPTIONS.map((role) =>
                buildRolePayload(role, permissionsByRole[role])
            )
        });
    } catch (error) {
        console.error('getAuthorizationMatrix error:', error);
        res.status(500).json({ message: 'Failed to load authorization matrix', error: error.message });
    }
};

// ─── GET /authorization/me ─────────────────────────────────────────────────
exports.getMyPermissions = async (req, res) => {
    try {
        const role = req.user?.role || 'sales';
        const document = role === 'admin'
            ? null
            : await RolePermission.findOne({ role });

        res.json({
            role,
            menuGroups: MENU_GROUPS,
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

        if (!ROLE_OPTIONS.includes(role)) {
            return res.status(400).json({ message: 'Invalid role supplied' });
        }

        if (role === 'admin') {
            return res.status(400).json({ message: 'Admin permissions are locked and cannot be edited.' });
        }

        // sanitizePermissions now always writes every MENU_GROUP key
        const sanitizedPermissions = sanitizePermissions(req.body?.permissions || {});

        await RolePermission.findOneAndUpdate(
            { role },
            { role, menuVisibility: sanitizedPermissions },
            { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
        );

        res.json(buildRolePayload(role, sanitizedPermissions));
    } catch (error) {
        console.error('updateRolePermissions error:', error);
        res.status(500).json({ message: 'Failed to update permissions', error: error.message });
    }
};

// ─── POST /authorization/initialize ───────────────────────────────────────
// Seeds default DB records for all non-admin roles if they don't exist yet.
// Safe to call multiple times (uses upsert: false — only inserts missing ones).
exports.initializeDefaults = async (req, res) => {
    try {
        const rolesToSeed = ROLE_OPTIONS.filter((r) => r !== 'admin');
        const results = [];

        for (const role of rolesToSeed) {
            const existing = await RolePermission.findOne({ role });
            if (!existing) {
                const defaultPerms = sanitizePermissions(DEFAULT_ROLE_PERMISSIONS[role] || {});
                await RolePermission.create({ role, menuVisibility: defaultPerms });
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
