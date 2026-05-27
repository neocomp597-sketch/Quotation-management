const Company = require('../models/Company');
const User = require('../models/User');
const PlatformAuditLog = require('../models/PlatformAuditLog');
const { getRedis } = require('../config/redis');

const refreshKey = (userId, deviceId) => `refresh:${userId}:${deviceId}`;
const sessionSetKey = (userId) => `sessions:${userId}`;

const revokeAllRefreshSessions = async (userId) => {
    const redis = await getRedis();
    if (!redis || !userId) return;

    const key = sessionSetKey(userId);
    const deviceIds = await redis.sMembers(key);
    if (deviceIds.length) {
        await redis.del(deviceIds.map((deviceId) => refreshKey(userId, deviceId)));
    }
    await redis.del(key);
};

const platformRoleFilter = { role: { $in: ['SUPER_ADMIN', 'super_admin'] }, status: { $ne: false }, isActive: { $ne: false } };

const writeAuditLog = async (req, payload) => {
    await PlatformAuditLog.create({
        actorId: req.user.id,
        actorEmail: req.user.email,
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        ...payload,
    });
};

exports.getCompanyStats = async (req, res) => {
    try {
        const [totalCompanies, activeCompanies] = await Promise.all([
            Company.countDocuments(),
            Company.countDocuments({ isActive: true, status: { $ne: 'DISABLED' } }),
        ]);
        const [totalUsers, activeUsers, suspendedCompanies] = await Promise.all([
            User.countDocuments({ role: { $nin: ['SUPER_ADMIN', 'super_admin'] } }),
            User.countDocuments({ role: { $nin: ['SUPER_ADMIN', 'super_admin'] }, status: { $ne: false }, isActive: { $ne: false } }),
            Company.countDocuments({ $or: [{ isActive: false }, { status: { $in: ['SUSPENDED', 'DISABLED'] } }] }),
        ]);

        res.json({
            totalCompanies,
            activeCompanies,
            inactiveCompanies: totalCompanies - activeCompanies,
            suspendedCompanies,
            totalUsers,
            activeUsers,
            inactiveUsers: totalUsers - activeUsers,
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to load company stats', error: error.message });
    }
};

exports.getCompanies = async (req, res) => {
    try {
        const companies = await Company.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: 'companyId',
                    as: 'users',
                },
            },
            {
                $project: {
                    companyName: '$name',
                    name: 1,
                    isActive: 1,
                    status: 1,
                    createdAt: 1,
                    userCount: { $size: '$users' },
                    activeUserCount: {
                        $size: {
                            $filter: {
                                input: '$users',
                                as: 'user',
                                cond: {
                                    $and: [
                                        { $ne: ['$$user.status', false] },
                                        { $ne: ['$$user.isActive', false] },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        res.json(companies);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load companies', error: error.message });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const filter = {};
        if (req.query.companyId) {
            filter.companyId = req.query.companyId;
        }

        const users = await User.find(filter)
            .select('_id name email role status isActive companyId createdAt')
            .populate('companyId', 'name status isActive')
            .sort({ createdAt: -1 })
            .limit(Math.min(200, Math.max(1, Number(req.query.limit || 100))))
            .lean();

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load users', error: error.message });
    }
};

exports.updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const isActive = Boolean(req.body?.isActive);

        if (req.user.id === id) {
            return res.status(400).json({ message: 'You cannot deactivate your own account.' });
        }

        const existing = await User.findById(id).select('_id name email role status isActive companyId tokenVersion').lean();
        if (!existing) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!isActive && ['SUPER_ADMIN', 'super_admin'].includes(existing.role)) {
            const activePlatformAdmins = await User.countDocuments({
                ...platformRoleFilter,
                _id: { $ne: id },
            });
            if (activePlatformAdmins < 1) {
                return res.status(400).json({ message: 'Cannot deactivate the last active platform admin.' });
            }
        }

        const setFields = {
            isActive,
            status: isActive,
            ...(isActive ? {} : { refreshTokenHash: null, refreshTokenExpiresAt: null }),
        };

        const user = await User.findByIdAndUpdate(
            id,
            isActive ? { $set: setFields } : { $set: setFields, $inc: { tokenVersion: 1 } },
            { new: true }
        ).select('_id name email role status isActive companyId tokenVersion');

        if (!isActive) {
            await revokeAllRefreshSessions(id);
        }

        await writeAuditLog(req, {
            action: isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
            targetType: 'User',
            targetId: user._id,
            previousState: {
                status: existing.status,
                isActive: existing.isActive,
                tokenVersion: existing.tokenVersion,
            },
            nextState: {
                status: user.status,
                isActive: user.isActive,
                tokenVersion: user.tokenVersion,
            },
        });

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user status', error: error.message });
    }
};

exports.updateCompanyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const requestedStatus = req.body?.status;
        const isActive = req.body?.isActive !== undefined
            ? Boolean(req.body.isActive)
            : requestedStatus === 'ACTIVE';
        const status = requestedStatus || (isActive ? 'ACTIVE' : 'SUSPENDED');

        if (!['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(status)) {
            return res.status(400).json({ message: 'Invalid company status' });
        }

        const existing = await Company.findById(id).select('_id name isActive status').lean();
        if (!existing) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const company = await Company.findByIdAndUpdate(
            id,
            { isActive, status },
            { new: true }
        );

        let affectedUsers = 0;
        if (!isActive || ['SUSPENDED', 'DISABLED'].includes(status)) {
            const users = await User.find({ companyId: id }).select('_id').lean();
            affectedUsers = users.length;
            await User.updateMany(
                { companyId: id },
                {
                    $set: {
                        isActive: false,
                        status: false,
                        refreshTokenHash: null,
                        refreshTokenExpiresAt: null,
                    },
                    $inc: { tokenVersion: 1 },
                }
            );
            await Promise.all(users.map((user) => revokeAllRefreshSessions(user._id.toString())));
        }

        await writeAuditLog(req, {
            action: isActive && status === 'ACTIVE' ? 'COMPANY_ACTIVATED' : 'COMPANY_SUSPENDED',
            targetType: 'Company',
            targetId: company._id,
            previousState: {
                isActive: existing.isActive,
                status: existing.status,
            },
            nextState: {
                isActive: company.isActive,
                status: company.status,
                affectedUsers,
            },
        });

        res.json({ company, affectedUsers });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update company status', error: error.message });
    }
};

exports.getAuditLogs = async (req, res) => {
    try {
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
        const logs = await PlatformAuditLog.find()
            .populate('actorId', 'name email role')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load audit logs', error: error.message });
    }
};
