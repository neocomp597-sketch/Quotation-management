const mongoose = require('mongoose');
const User = require('../models/User');
const { hasPermission } = require('../config/authorization');
const { getEffectivePermissions } = require('./permissionMiddleware');

/*
 * Who may use Authorization (role matrix, Team Users, Vendor Logins).
 *
 * The menu, the page and the API follow one rule: administrators, plus any user an administrator
 * gave the "Authorization" screen in the role matrix or in their Individual Permissions. Before
 * this, the menu followed that permission but the page and the API only let role "admin" in, so
 * a user who was given Authorization saw the menu and was sent back to the dashboard.
 *
 * A user who is not an administrator ("delegate") manages the other users and roles of their own
 * company only, and can never reach administrator level: they cannot change the Admin role or
 * their own role, give anyone the Admin role, or change an administrator's or their own login.
 */

const isSuperAdminRole = (role) => ['super_admin', 'superadmin'].includes(String(role || '').toLowerCase());
const isAdminLevelRole = (role) => String(role || '').toLowerCase() === 'admin' || isSuperAdminRole(role);

const refuse = (res, message) => res.status(403).json({ code: 'AUTHORIZATION_DELEGATE_LIMIT', message });

/** Lets administrators through, and users given the Authorization screen (marked as delegates). */
const authorizationManager = async (req, res, next) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Not authorized' });
        if (isAdminLevelRole(req.user.role)) return next();

        const permissions = await getEffectivePermissions(req);
        if (!hasPermission(permissions, 'admin_authorization', 'view')) {
            return res.status(403).json({
                code: 'PERMISSION_DENIED',
                message: 'You do not have permission to use Authorization. Ask an administrator.',
                permission: { key: 'admin_authorization', action: 'view' }
            });
        }

        // Only their own company: the handlers otherwise accept ?companyId / x-company-id / body.companyId.
        const ownCompanyId = String(req.user.companyId || '');
        const askedCompanyIds = [req.query?.companyId, req.headers?.['x-company-id'], req.body?.companyId]
            .filter((value) => value !== undefined && value !== null && value !== '')
            .map(String);
        if (!ownCompanyId || askedCompanyIds.some((id) => id !== ownCompanyId)) {
            return refuse(res, 'You can only manage the users and roles of your own company.');
        }

        req.authorizationDelegate = true;
        return next();
    } catch (error) {
        console.error('Authorization access check failed:', error);
        return res.status(500).json({ message: 'Authorization error', error: error.message });
    }
};

/** Administrators only, e.g. resetting the role defaults of the company. */
const administratorOnly = (req, res, next) => (
    req.authorizationDelegate
        ? refuse(res, 'Only an administrator can do this.')
        : next()
);

/** Role routes (/authorization/roles/:role, /authorization/:role): never the Admin role or the delegate's own role. */
const guardDelegateRole = (req, res, next) => {
    if (!req.authorizationDelegate) return next();
    const role = String(req.params.role || '');
    if (isAdminLevelRole(role)) {
        return refuse(res, 'Only an administrator can change the Admin role.');
    }
    if (role && role === String(req.user.role || '')) {
        return refuse(res, 'You cannot change the access of your own role. Ask an administrator.');
    }
    return next();
};

/**
 * User routes (/users, /users/:id...): a delegate cannot give the Admin role, and cannot change
 * an administrator's login or their own (their own details stay editable in Settings > Profile).
 */
const guardDelegateUser = async (req, res, next) => {
    if (!req.authorizationDelegate) return next();
    try {
        if (req.body?.role !== undefined && isAdminLevelRole(req.body.role)) {
            return refuse(res, 'Only an administrator can give someone the Admin role.');
        }
        const targetId = req.params.id;
        if (!targetId) return next();
        if (String(targetId) === String(req.user.id)) {
            return refuse(res, 'You cannot change your own login here. Ask an administrator.');
        }
        if (!mongoose.isValidObjectId(targetId)) return next(); // the handler answers 400 / 404
        const target = await User.findOne({ _id: targetId, companyId: req.user.companyId }).select('role').lean();
        if (target && isAdminLevelRole(target.role)) {
            return refuse(res, "Only an administrator can change an administrator's login.");
        }
        return next();
    } catch (error) {
        console.error('Authorization user check failed:', error);
        return res.status(500).json({ message: 'Authorization error', error: error.message });
    }
};

module.exports = {
    authorizationManager,
    administratorOnly,
    guardDelegateRole,
    guardDelegateUser,
    isAdminLevelRole
};
