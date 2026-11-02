const Territory = require('../models/Territory');
const { hasPermission } = require('../config/authorization');
const { getEffectivePermissions } = require('../middlewares/permissionMiddleware');

/**
 * How territories limit what a user sees in a list of customers or quotations: the $or conditions
 * to add to the query, or null when territories do not limit them. The active branch limits the
 * records either way (models/plugins/tenantPlugin.js).
 *
 * Admins and managers are not limited. Territories limit the people they name, so someone given
 * `permissionKey` in Authorization who is in no territory is not limited either. Everyone else sees
 * their territories' records and their own. These reads also serve other screens as lookup lists,
 * so someone without the permission keeps that limit even when they are in no territory.
 *
 * `includeUnassigned` also shows records with no territory to someone with the permission;
 * `ownFields` are the fields that make a record the user's own.
 */
const territoryLimit = async (req, permissionKey, { includeUnassigned = false, ownFields = ['createdBy'] } = {}) => {
    if (!req.user || req.user.role === 'admin' || req.user.role === 'manager') return null;

    const territories = await Territory.find({ $or: [{ manager: req.user.id }, { salesReps: req.user.id }] })
        .select('_id')
        .lean();
    const territoryIds = territories.map((territory) => territory._id);
    const permitted = hasPermission(await getEffectivePermissions(req), permissionKey, 'view');
    if (permitted && !territoryIds.length) return null;

    return [
        { territory: { $in: territoryIds } },
        ...ownFields.map((field) => ({ [field]: req.user.id })),
        ...(permitted && includeUnassigned ? [{ territory: null }] : [])
    ];
};

module.exports = { territoryLimit };
