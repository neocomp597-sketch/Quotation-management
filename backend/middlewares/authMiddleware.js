const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getRedis } = require('../config/redis');
const { getCachedJson, setCachedJson } = require('../utils/apiCache');
const { runWithTenant } = require('./tenantContext');

const AUTH_USER_CACHE_TTL_SECONDS = Number(process.env.AUTH_USER_CACHE_TTL_SECONDS || 300);
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

exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
            if (await isAccessTokenBlacklisted(decoded.jti)) {
                return res.status(401).json({ message: 'Not authorized, token revoked' });
            }

            const cacheKey = `auth:user:${decoded.id}:v${decoded.tokenVersion ?? 0}`;
            const { redis, value: cachedUser } = await getCachedJson(cacheKey);
            let user = cachedUser;

            if (!user) {
                user = await User.findById(decoded.id).select('_id name email role tokenVersion companyId status isActive').lean();
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
            } else if (!resolvedCompanyId && user.role === 'admin') {
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

            req.user = {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                companyId: resolvedCompanyId
            };

            runWithTenant(req.user.companyId, () => next());
        } catch (error) {
            console.error(error);
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
