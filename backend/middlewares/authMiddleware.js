const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getRedis } = require('../config/redis');
const { getCachedJson, setCachedJson } = require('../utils/apiCache');
const { runWithTenant } = require('./tenantContext');
const {
    normalizeBranchId,
    canUseBranch,
    getAssignedBranchIds,
    isBranchAdminRole,
} = require('../utils/branchScope');

const AUTH_USER_CACHE_TTL_SECONDS = Number(process.env.AUTH_USER_CACHE_TTL_SECONDS || 300);
const AUTH_USER_FIELDS = '_id name email role tokenVersion companyId branchId assignedBranches activeBranchId status isActive vendorId customPermissions reportsTo';

const isSuperAdminRole = (role) => {
    if (!role) return false;
    const normalized = role.toLowerCase();
    return normalized === 'super_admin' || normalized === 'superadmin';
};

const isAccessTokenBlacklisted = async (jti) => {
    if (!jti) return false;

    const redis = await getRedis();
    if (!redis) return false;

    return Boolean(await redis.get(`blacklist:access:${jti}`));
};

const authUserCacheKey = (userId, tokenVersion) => `auth:user:${userId}:v${tokenVersion ?? 0}`;

/**
 * Drops the cached auth snapshot of a user so the next request reads the user
 * again (used when their active branch or assignments change).
 */
const invalidateAuthUserCache = async (userId) => {
    if (!userId) return;
    const { invalidateCache } = require('../utils/cacheInvalidation');
    await invalidateCache(`auth:user:${userId}:*`);
};

// Platform-level super admin screens (companies, platform users, audit logs) are
// not branch data, so they are the one place the branch scope is not applied.
const isPlatformAdminRequest = (req) => /^\/api\/super-admin(\/|\?|$)/.test(req.originalUrl || '');

exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (token) {
        try {

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
            if (await isAccessTokenBlacklisted(decoded.jti)) {
                return res.status(401).json({ message: 'Not authorized, token revoked' });
            }

            const cacheKey = authUserCacheKey(decoded.id, decoded.tokenVersion);
            const { redis, value: cachedUser } = await getCachedJson(cacheKey);
            let user = cachedUser;

            if (!user) {
                user = await User.findById(decoded.id)
                    .select(AUTH_USER_FIELDS)
                    .lean();
                if (user) {
                    await setCachedJson(redis, cacheKey, user, AUTH_USER_CACHE_TTL_SECONDS);
                }
            }

            if (!user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            if (typeof decoded.tokenVersion === 'number' && decoded.tokenVersion !== user.tokenVersion) {
                return res.status(401).json({ message: 'Not authorized, token revoked' });
            }

            if (user.status === false || user.isActive === false) {
                return res.status(403).json({ message: 'Account deactivated' });
            }

            let resolvedCompanyId = user.companyId?.toString?.() || user.companyId;
            const isSuperAdmin = isSuperAdminRole(user.role);

            if (isSuperAdmin) {
                const queryCompanyId = req.query.companyId || req.headers['x-company-id'] || req.body?.companyId;
                if (queryCompanyId) {
                    resolvedCompanyId = queryCompanyId.toString();
                }
            }

            if (!resolvedCompanyId) {
                const Company = require('../models/Company');
                const firstCompany = await Company.findOne().lean();
                if (firstCompany) {
                    resolvedCompanyId = firstCompany._id.toString();
                }
            }

            if (!isSuperAdmin && resolvedCompanyId) {
                const Company = require('../models/Company');
                const company = await Company.findById(resolvedCompanyId).select('isActive status').lean();
                if (!company || company.isActive === false || ['SUSPENDED', 'DISABLED'].includes(company.status)) {
                    return res.status(403).json({ message: 'Company account is suspended' });
                }
            }

            let resolvedVendorId = user.vendorId?.toString?.() || user.vendorId || null;
            if (!resolvedVendorId && String(user.role || '').toLowerCase() === 'vendor') {
                const Vendor = require('../models/Vendor');
                const vendorDoc = await Vendor.findOne({ $or: [{ vendorUserId: user._id }, { email: user.email }] }).select('_id').lean();
                if (vendorDoc) {
                    resolvedVendorId = vendorDoc._id.toString();
                }
            }

            req.user = {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                companyId: resolvedCompanyId,
                vendorId: resolvedVendorId,
                branchId: user.branchId,
                assignedBranches: user.assignedBranches || [],
                customPermissions: user.customPermissions || {},
                reportsTo: user.reportsTo || null
            };

            // ---- Active branch -------------------------------------------------
            // The branch the UI shows in the header is sent on every request. It is
            // validated against what this user may use; the branch persisted on the
            // user is the fallback for clients that send no header (exports, API
            // tools), so both always describe the same context.
            const assignedBranchIds = getAssignedBranchIds(req.user);
            const headerBranchId = normalizeBranchId(
                req.headers['x-active-branch'] || req.headers['x-branch-id'] || req.query?.activeBranchId
            );
            const persistedBranchId = user.activeBranchId ? user.activeBranchId.toString() : null;

            let activeBranchId = null;
            if (headerBranchId) {
                if (!(await canUseBranch(req.user, headerBranchId, resolvedCompanyId))) {
                    return res.status(403).json({
                        message: 'The selected active branch is not available for this user. Please select a branch again.',
                        code: 'ACTIVE_BRANCH_INVALID'
                    });
                }
                activeBranchId = headerBranchId;
            } else if (persistedBranchId && await canUseBranch(req.user, persistedBranchId, resolvedCompanyId)) {
                activeBranchId = persistedBranchId;
            }

            req.user.activeBranchId = activeBranchId;
            // null = every branch of the company (admins without an assignment)
            req.user.allowedBranchIds = assignedBranchIds.length > 0 ? assignedBranchIds : null;
            req.activeBranchId = activeBranchId;

            // Branch scoping, enforced for every query by tenantPlugin so it cannot be
            // bypassed by calling the API directly:
            //  - an active branch scopes everyone to that one branch, super admins included
            //  - otherwise non-admins are limited to their assigned branches and
            //    admins / super admins see every branch
            let branchIds = [];
            let branchScoped = false;

            if (activeBranchId) {
                branchScoped = true;
                branchIds = [activeBranchId];
            } else {
                branchScoped = !isBranchAdminRole(user.role) && assignedBranchIds.length > 0;
                branchIds = assignedBranchIds;
            }

            runWithTenant(req.user.companyId, () => next(), {
                bypassTenant: isSuperAdmin,
                bypassBranch: isSuperAdmin && isPlatformAdminRequest(req),
                branchScoped,
                branchIds,
                activeBranchId
            });
        } catch (error) {
            if (error?.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token expired' });
            }

            if (error?.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Not authorized, token invalid' });
            }

            console.error('Auth middleware error:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

exports.admin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || isSuperAdminRole(req.user.role))) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as an admin' });
    }
};

exports.superAdmin = (req, res, next) => {
    if (req.user && isSuperAdminRole(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as a super admin' });
    }
};

exports.isSuperAdminRole = isSuperAdminRole;
exports.invalidateAuthUserCache = invalidateAuthUserCache;
