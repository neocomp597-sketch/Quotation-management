const User = require('../models/User');

/**
 * Recursively fetches all subordinate user IDs for a given manager user ID.
 * Returns an array of ObjectIds including the manager themselves.
 */
const getScopedUserIds = async (userId, companyId) => {
    if (!userId) return [];

    const scoped = [userId.toString()];
    const queue = [userId];

    while (queue.length > 0) {
        const currentId = queue.shift();
        const directReports = await User.find({
            reportsTo: currentId,
            ...(companyId ? { companyId } : {})
        }).select('_id').lean();

        for (const report of directReports) {
            const reportIdStr = report._id.toString();
            if (!scoped.includes(reportIdStr)) {
                scoped.push(reportIdStr);
                queue.push(report._id);
            }
        }
    }

    return scoped;
};

/**
 * Returns array of branch ObjectIds assigned to a user (handles single branchId or multi assignedBranches).
 */
const getScopedBranchIds = (user) => {
    if (!user) return [];
    
    let branches = [];
    if (Array.isArray(user.assignedBranches) && user.assignedBranches.length > 0) {
        branches = user.assignedBranches.map(b => (b._id || b).toString());
    } else if (user.branchId) {
        branches = [(user.branchId._id || user.branchId).toString()];
    }

    return branches;
};

/**
 * Builds MongoDB filter query incorporating strict access control hierarchy:
 * User -> Org Chart -> Branch -> Company
 */
const buildAccessScopeQuery = async (req, {
    branchField = 'branchId',
    userField = 'createdBy',
    engineerField = 'assignedEngineerId',
    customCompanyId = null
} = {}) => {
    const user = req.user;
    if (!user) return {};

    const companyId = customCompanyId || user.companyId;
    const query = {};

    if (companyId) {
        query.companyId = companyId;
    }

    const role = (user.role || '').toUpperCase();
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'COMPANY_ADMIN'].includes(role);

    // Filter by branch: if specified in request query or if restricted by user's assigned branches
    const requestedBranch = req.query?.branchId || req.body?.branchId;
    const userBranchIds = getScopedBranchIds(user);

    if (requestedBranch) {
        if (!isAdmin && userBranchIds.length > 0 && !userBranchIds.includes(requestedBranch.toString())) {
            // User requested branch outside their authorized branches -> constrain to authorized
            query[branchField] = { $in: userBranchIds };
        } else {
            query[branchField] = requestedBranch;
        }
    } else if (!isAdmin && userBranchIds.length > 0) {
        query[branchField] = { $in: userBranchIds };
    }

    // Role / Org-chart hierarchy scoping for non-admin users
    if (!isAdmin) {
        const scopedUserIds = await getScopedUserIds(user.id || user._id, companyId);
        
        const userOrEngineerConditions = [];
        if (userField) {
            userOrEngineerConditions.push({ [userField]: { $in: scopedUserIds } });
        }
        if (engineerField) {
            userOrEngineerConditions.push({ [engineerField]: { $in: scopedUserIds } });
        }

        if (userOrEngineerConditions.length > 1) {
            query.$or = userOrEngineerConditions;
        } else if (userOrEngineerConditions.length === 1) {
            Object.assign(query, userOrEngineerConditions[0]);
        }
    }

    // Date range filtering (Month-wise, Day range 1-31, Quick dates)
    const { startDate, endDate, month, year, startDay, endDay, quickRange } = req.query || {};
    let dateStart = null;
    let dateEnd = null;

    if (quickRange === 'today') {
        dateStart = new Date();
        dateStart.setHours(0, 0, 0, 0);
        dateEnd = new Date();
        dateEnd.setHours(23, 59, 59, 999);
    } else if (quickRange === 'yesterday') {
        dateStart = new Date();
        dateStart.setDate(dateStart.getDate() - 1);
        dateStart.setHours(0, 0, 0, 0);
        dateEnd = new Date();
        dateEnd.setDate(dateEnd.getDate() - 1);
        dateEnd.setHours(23, 59, 59, 999);
    } else if (quickRange === 'thisMonth') {
        const now = new Date();
        dateStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        dateEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (quickRange === 'lastMonth') {
        const now = new Date();
        dateStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        dateEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (month !== undefined && year !== undefined) {
        const m = parseInt(month, 10) - 1; // 0-indexed month
        const y = parseInt(year, 10);
        const sDay = startDay ? parseInt(startDay, 10) : 1;
        const eDay = endDay ? parseInt(endDay, 10) : new Date(y, m + 1, 0).getDate();

        dateStart = new Date(y, m, sDay, 0, 0, 0);
        dateEnd = new Date(y, m, eDay, 23, 59, 59);
    } else if (startDate || endDate) {
        if (startDate) dateStart = new Date(startDate);
        if (endDate) dateEnd = new Date(endDate);
    }

    if (dateStart || dateEnd) {
        query.createdAt = {};
        if (dateStart) query.createdAt.$gte = dateStart;
        if (dateEnd) query.createdAt.$lte = dateEnd;
    }

    return query;
};

module.exports = {
    getScopedUserIds,
    getScopedBranchIds,
    buildAccessScopeQuery
};
