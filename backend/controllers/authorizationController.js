const RolePermission = require('../models/RolePermission');
const {
    MENU_GROUPS,
    ROLE_OPTIONS,
    ROLE_LABELS,
    sanitizePermissions,
    resolvePermissions
} = require('../config/authorization');

const toPermissionObject = (menuVisibility) => {
    if (!menuVisibility) {
        return {};
    }

    if (menuVisibility instanceof Map) {
        return Object.fromEntries(menuVisibility.entries());
    }

    if (menuVisibility.$isMongooseMap && typeof menuVisibility.entries === 'function') {
        return Object.fromEntries(menuVisibility.entries());
    }

    if (typeof menuVisibility.toObject === 'function') {
        const objectValue = menuVisibility.toObject({ flattenMaps: true });

        if (objectValue instanceof Map) {
            return Object.fromEntries(objectValue.entries());
        }

        return objectValue;
    }

    return { ...menuVisibility };
};

const buildRolePayload = (role, menuVisibility = {}) => ({
    role,
    label: ROLE_LABELS[role] || role,
    locked: role === 'admin',
    permissions: resolvePermissions(role, menuVisibility)
});

exports.getAuthorizationMatrix = async (req, res) => {
    try {
        const documents = await RolePermission.find({ role: { $in: ROLE_OPTIONS } });
        const permissionsByRole = documents.reduce((acc, document) => {
            acc[document.role] = toPermissionObject(document.menuVisibility);
            return acc;
        }, {});

        res.json({
            menuGroups: MENU_GROUPS,
            roles: ROLE_OPTIONS.map((role) => buildRolePayload(role, permissionsByRole[role]))
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to load authorization matrix', error: error.message });
    }
};

exports.getMyPermissions = async (req, res) => {
    try {
        const role = req.user?.role || 'sales';
        const document = role === 'admin' ? null : await RolePermission.findOne({ role });

        res.json({
            role,
            menuGroups: MENU_GROUPS,
            permissions: resolvePermissions(role, toPermissionObject(document?.menuVisibility))
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to load permissions', error: error.message });
    }
};

exports.updateRolePermissions = async (req, res) => {
    try {
        const { role } = req.params;

        if (!ROLE_OPTIONS.includes(role)) {
            return res.status(400).json({ message: 'Invalid role supplied' });
        }

        if (role === 'admin') {
            return res.status(400).json({ message: 'Admin permissions are fixed and cannot be edited.' });
        }

        const sanitizedPermissions = sanitizePermissions(req.body?.permissions || {});

        const updatedDocument = await RolePermission.findOneAndUpdate(
            { role },
            { role, menuVisibility: sanitizedPermissions },
            { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
        );

        res.json(buildRolePayload(role, sanitizedPermissions));
    } catch (error) {
        res.status(500).json({ message: 'Failed to update permissions', error: error.message });
    }
};
