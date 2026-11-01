const Branch = require('../models/Branch');
const MGR = require('../models/MGR');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { buildAccessScopeQuery } = require('../utils/accessControl');
const { listSelectableBranches } = require('../utils/branchScope');
const { getScopedBranches } = require('../middlewares/tenantContext');
const { getMgrAccess, describeMgrAccess, mgr1FilterCondition, allowedMgr1Ids } = require('../utils/mgrAccess');
const { getVisibleTicketsFilter, getTicketMgrCondition } = require('./ticketController');

/**
 * The tickets the dashboards count, the same ones their cards open in the register: those of the
 * branch selected in the header, or of Analytics' Branch filter (tenantPlugin applies either, see
 * middlewares/branchView.js and models/Ticket.js, so a ?branchId is ignored), in the date range,
 * that the user may see in the register, within their MGR access and the MGR 1 filter. Always the
 * user's own company (protect resolves a super admin's), so a ?companyId cannot reach another.
 */
const dashboardTicketScope = async (req) => {
    const { branchId: _branchId, ...scope } = await buildAccessScopeQuery(req, {
        branchField: 'branchId',
        userField: null,
        engineerField: null,
        customCompanyId: req.user.companyId
    });
    const conditions = [
        await getVisibleTicketsFilter(req.user),
        await getTicketMgrCondition(req),
        await mgr1FilterCondition(req.query.mgr1)
    ].filter(Boolean);
    return conditions.length ? { ...scope, $and: conditions } : scope;
};

const STILL_OPEN = { $nin: ['Resolved', 'Closed', 'Cancelled'] };
const RESOLVED = { $in: ['Resolved', 'Closed'] };

/** The counts of the Analytics cards for `scope`. */
const cardCounts = async (scope) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const today = { $gte: startOfToday };
    const yesterday = { $gte: startOfYesterday, $lt: startOfToday };

    const [open, unassigned, pending, createdToday, createdYesterday, resolvedToday, resolvedYesterday] = await Promise.all([
        // Open = every ticket still in process, the same set as the register's "Open Tickets" filter.
        Ticket.countDocuments({ ...scope, status: STILL_OPEN }),
        // Nobody assigned; `null` also matches a missing field, and leaves scope's own $or (user hierarchy) intact.
        Ticket.countDocuments({ ...scope, status: STILL_OPEN, assignedEngineerId: null }),
        Ticket.countDocuments({ ...scope, status: 'Pending Customer' }),
        // Raised on the day, any status.
        Ticket.countDocuments({ ...scope, createdAt: today }),
        Ticket.countDocuments({ ...scope, createdAt: yesterday }),
        // Resolved on the day, including tickets that have since been closed.
        Ticket.countDocuments({ ...scope, status: RESOLVED, resolvedAt: today }),
        Ticket.countDocuments({ ...scope, status: RESOLVED, resolvedAt: yesterday })
    ]);
    return { open, unassigned, pending, createdToday, createdYesterday, resolvedToday, resolvedYesterday };
};

/** What Analytics' Branch and MGR 1 filters offer: only the branches and MGR values the user was given. */
exports.getFilterOptions = async (req, res) => {
    try {
        const branches = await listSelectableBranches(req.user, req.user.companyId);
        const allowedMgr1 = await allowedMgr1Ids(await getMgrAccess(req));
        const mgr1 = await MGR.find({
            mgrType: 'MGR1',
            companyId: req.user.companyId,
            ...(allowedMgr1 ? { _id: { $in: allowedMgr1 } } : {})
        }).select('code description').sort({ code: 1 }).lean();
        res.json({ branches: branches.map(({ _id, name, code }) => ({ _id, name, code })), mgr1 });
    } catch (error) {
        console.error('CSM Dashboard filter options error:', error);
        res.status(500).json({ message: error.message || 'Error loading the filters' });
    }
};

/**
 * Analytics' Excel export: the card counts of each branch in view, including branches with nothing
 * to count and a "No Branch" row for older tickets not yet given one. The rows add up to the cards.
 */
exports.getBranchSummary = async (req, res) => {
    try {
        const scope = await dashboardTicketScope(req);
        const inView = getScopedBranches(); // null: every branch of the company
        const selectable = await listSelectableBranches(req.user, req.user.companyId);
        const listedIds = selectable.map((branch) => String(branch._id)).filter((id) => !inView || inView.includes(id));
        const ticketBranches = await Ticket.aggregate([{ $match: scope }, { $group: { _id: '$branchId' } }]);
        const ids = [...new Set([...listedIds, ...ticketBranches.map((row) => (row._id ? String(row._id) : null))])];

        const branches = await Branch.find({ _id: { $in: ids.filter(Boolean) } })
            .select('name')
            .setOptions({ bypassTenant: true })
            .lean();
        const nameOf = (id) => (id ? branches.find((branch) => String(branch._id) === id)?.name || 'Deleted Branch' : 'No Branch');

        const rows = [];
        for (const id of ids) {
            rows.push({ branch: nameOf(id), noBranch: !id, ...(await cardCounts({ ...scope, branchId: id })) });
        }
        rows.sort((a, b) => Number(a.noBranch) - Number(b.noBranch) || a.branch.localeCompare(b.branch));

        const total = {};
        rows.forEach(({ branch: _branch, noBranch: _noBranch, ...counts }) => {
            Object.entries(counts).forEach(([key, value]) => { total[key] = (total[key] || 0) + value; });
        });
        res.json({ rows: rows.map(({ noBranch: _noBranch, ...row }) => row), total });
    } catch (error) {
        console.error('CSM Dashboard branch summary error:', error);
        res.status(500).json({ message: error.message || 'Error loading the export' });
    }
};

exports.getStats = async (req, res) => {
    try {
        const now = new Date();

        const baseScope = await dashboardTicketScope(req);

        const counts = await cardCounts(baseScope);

        // Overdue tickets (any unresolved ticket past resolution due time)
        const overdueCount = await Ticket.countDocuments({
            ...baseScope,
            status: { $nin: ['Resolved', 'Closed', 'Cancelled'] },
            slaResolutionDue: { $lt: now }
        });

        // Status breakdown
        const statusBreakdown = await Ticket.aggregate([
            { $match: baseScope },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Priority breakdown
        const priorityBreakdown = await Ticket.aggregate([
            { $match: baseScope },
            {
                $lookup: {
                    from: 'priorities',
                    localField: 'priorityId',
                    foreignField: '_id',
                    as: 'priorityInfo'
                }
            },
            { $unwind: '$priorityInfo' },
            { $group: { _id: '$priorityInfo.name', count: { $sum: 1 }, color: { $first: '$priorityInfo.color' } } }
        ]);

        // Category breakdown
        const categoryBreakdown = await Ticket.aggregate([
            { $match: baseScope },
            {
                $lookup: {
                    from: 'ticketcategories',
                    localField: 'categoryId',
                    foreignField: '_id',
                    as: 'catInfo'
                }
            },
            { $unwind: { path: '$catInfo', preserveNullAndEmptyArrays: true } },
            { $group: { _id: { $ifNull: ['$catInfo.name', 'General Service'] }, count: { $sum: 1 } } }
        ]);

        // SLA compliance breach ratios
        const slaCompliantRes = await Ticket.countDocuments({
            ...baseScope,
            'isSlaBreached.resolution': false,
            status: { $in: ['Resolved', 'Closed'] }
        });
        const slaBreachedRes = await Ticket.countDocuments({
            ...baseScope,
            'isSlaBreached.resolution': true
        });

        // Average resolution time in hours
        const resolvedTickets = await Ticket.find({
            ...baseScope,
            status: { $in: ['Resolved', 'Closed'] },
            resolvedAt: { $exists: true }
        }).select('createdAt resolvedAt').lean();

        let avgResolutionHours = 0;
        if (resolvedTickets.length > 0) {
            const totalHours = resolvedTickets.reduce((sum, ticket) => {
                const diffMs = ticket.resolvedAt - ticket.createdAt;
                return sum + (diffMs / (1000 * 60 * 60));
            }, 0);
            avgResolutionHours = parseFloat((totalHours / resolvedTickets.length).toFixed(1));
        }

        // Leaderboard: engineer performance
        const engineerPerformance = await Ticket.aggregate([
            { $match: { ...baseScope, assignedEngineerId: { $ne: null }, status: { $in: ['Resolved', 'Closed'] } } },
            {
                $group: {
                    _id: '$assignedEngineerId',
                    resolvedCount: { $sum: 1 },
                    avgRating: { $avg: '$feedback.rating' }
                }
            },
            {
                $lookup: {
                    from: 'engineers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'engineer'
                }
            },
            { $unwind: '$engineer' },
            {
                $project: {
                    name: '$engineer.name',
                    resolvedCount: 1,
                    avgRating: { $ifNull: [{ $round: ['$avgRating', 1] }, 0] }
                }
            },
            { $sort: { resolvedCount: -1 } },
            { $limit: 5 }
        ]);

        const totalResolvedOrClosed = await Ticket.countDocuments({
            ...baseScope,
            status: { $in: ['Resolved', 'Closed'] }
        });
        const totalFCR = await Ticket.countDocuments({
            ...baseScope,
            status: { $in: ['Resolved', 'Closed'] },
            isFirstCallResolved: true
        });
        const fcrRate = totalResolvedOrClosed > 0 ? parseFloat(((totalFCR / totalResolvedOrClosed) * 100).toFixed(1)) : 0;

        res.json({
            metrics: {
                ...counts,
                overdue: overdueCount,
                fcrRate
            },
            statusBreakdown: statusBreakdown.map(item => ({ name: item._id, value: item.count })),
            priorityBreakdown: priorityBreakdown.map(item => ({ name: item._id, value: item.count, color: item.color })),
            categoryBreakdown: categoryBreakdown.map(item => ({ name: item._id, value: item.count })),
            slaCompliance: [
                { name: 'Compliant', value: slaCompliantRes },
                { name: 'Breached', value: slaBreachedRes }
            ],
            avgResolutionHours,
            engineerPerformance,
            // What the user's MGR access limits them to, for the screen's notice; null when not limited.
            mgrAccess: await describeMgrAccess(await getMgrAccess(req))
        });
    } catch (error) {
        console.error('CSM Dashboard stats error:', error);
        res.status(500).json({ message: error.message || 'Error loading dashboard statistics' });
    }
};

exports.getReportData = async (req, res) => {
    try {
        const { priorityId, categoryId, assignedEngineerId } = req.query;

        const baseScope = await buildAccessScopeQuery(req, {
            branchField: 'branchId',
            userField: 'createdBy',
            engineerField: 'assignedEngineerId'
        });

        const filter = { ...baseScope };
        if (priorityId) filter.priorityId = priorityId;
        if (categoryId) filter.categoryId = categoryId;
        if (assignedEngineerId) filter.assignedEngineerId = assignedEngineerId;

        // Fetch all matching tickets with populated relations
        const tickets = await Ticket.find(filter)
            .populate('customerId', 'customerName companyName email mobile')
            .populate('categoryId', 'name')
            .populate('typeId', 'name')
            .populate('priorityId', 'name color')
            .populate('assignedTeamId', 'name')
            .populate('assignedEngineerId', 'name email role')
            .sort({ createdAt: -1 })
            .lean();

        // 1. Closed Ticket Report metrics
        const closedTickets = tickets.filter(t => ['Resolved', 'Closed'].includes(t.status));

        // 2. SLA Compliance metrics
        const slaCompliance = {
            total: tickets.length,
            compliant: tickets.filter(t => !t.isSlaBreached?.response && !t.isSlaBreached?.resolution).length,
            breached: tickets.filter(t => t.isSlaBreached?.response || t.isSlaBreached?.resolution).length,
            byPriority: {},
            byCategory: {}
        };

        tickets.forEach(t => {
            const pName = t.priorityId?.name || 'Unassigned';
            const cName = t.categoryId?.name || 'Unassigned';
            const isBreached = t.isSlaBreached?.response || t.isSlaBreached?.resolution || false;

            if (!slaCompliance.byPriority[pName]) slaCompliance.byPriority[pName] = { compliant: 0, breached: 0 };
            if (!slaCompliance.byCategory[cName]) slaCompliance.byCategory[cName] = { compliant: 0, breached: 0 };

            if (isBreached) {
                slaCompliance.byPriority[pName].breached++;
                slaCompliance.byCategory[cName].breached++;
            } else {
                slaCompliance.byPriority[pName].compliant++;
                slaCompliance.byCategory[cName].compliant++;
            }
        });

        // 3. Average Resolution Time Report (by date)
        const resolutionTimeTrend = {};
        closedTickets.forEach(t => {
            if (t.resolvedAt && t.createdAt) {
                const dateStr = new Date(t.resolvedAt).toISOString().split('T')[0];
                const diffMs = new Date(t.resolvedAt) - new Date(t.createdAt);
                const diffHours = diffMs / (1000 * 60 * 60);

                if (!resolutionTimeTrend[dateStr]) {
                    resolutionTimeTrend[dateStr] = { sum: 0, count: 0 };
                }
                resolutionTimeTrend[dateStr].sum += diffHours;
                resolutionTimeTrend[dateStr].count++;
            }
        });

        const resolutionTrendData = Object.keys(resolutionTimeTrend).sort().map(date => ({
            date,
            avgHours: parseFloat((resolutionTimeTrend[date].sum / resolutionTimeTrend[date].count).toFixed(1))
        }));

        // 4. Escalated Cases Report
        const escalatedTickets = tickets.filter(t => t.status === 'Escalated' || t.escalationLevel > 0);

        // 5. Customer Complaints Report
        const complaintsTickets = tickets.filter(t => 
            t.typeId?.name?.toLowerCase().includes('complaint') || 
            t.categoryId?.name?.toLowerCase().includes('complaint')
        );

        // 6. Service Request Analysis
        const categoryCounts = {};
        tickets.forEach(t => {
            const catName = t.categoryId?.name || 'Unknown';
            categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
        });
        const serviceRequestAnalysis = Object.keys(categoryCounts).map(name => ({
            name,
            value: categoryCounts[name]
        }));

        // 7. First Call Resolution (FCR) Report
        const totalResolved = closedTickets.length;
        const fcrResolvedCount = closedTickets.filter(t => t.isFirstCallResolved).length;
        const overallFcrRate = totalResolved > 0 ? parseFloat(((fcrResolvedCount / totalResolved) * 100).toFixed(1)) : 0;

        const fcrTrend = {};
        closedTickets.forEach(t => {
            if (t.resolvedAt) {
                const dateStr = new Date(t.resolvedAt).toISOString().split('T')[0];
                if (!fcrTrend[dateStr]) {
                    fcrTrend[dateStr] = { total: 0, fcr: 0 };
                }
                fcrTrend[dateStr].total++;
                if (t.isFirstCallResolved) {
                    fcrTrend[dateStr].fcr++;
                }
            }
        });
        const fcrTrendData = Object.keys(fcrTrend).sort().map(date => ({
            date,
            fcrRate: parseFloat(((fcrTrend[date].fcr / fcrTrend[date].total) * 100).toFixed(1))
        }));

        // 8. Service Engineer Productivity
        const Engineer = require('../models/Engineer');
        const companyIdFilter = baseScope.companyId || req.query?.companyId || req.user?.companyId;
        const engineers = await Engineer.find(companyIdFilter ? { companyId: companyIdFilter } : {}).select('name email').lean();
        const engineerMap = {};
        engineers.forEach(eng => {
            engineerMap[eng._id.toString()] = {
                name: eng.name,
                email: eng.email,
                assigned: 0,
                resolved: 0,
                open: 0,
                ratingSum: 0,
                ratingCount: 0
            };
        });

        tickets.forEach(t => {
            if (t.assignedEngineerId) {
                const engId = t.assignedEngineerId._id.toString();
                if (!engineerMap[engId]) {
                    engineerMap[engId] = {
                        name: t.assignedEngineerId.name,
                        email: t.assignedEngineerId.email,
                        assigned: 0,
                        resolved: 0,
                        open: 0,
                        ratingSum: 0,
                        ratingCount: 0
                    };
                }

                engineerMap[engId].assigned++;
                if (['Resolved', 'Closed'].includes(t.status)) {
                    engineerMap[engId].resolved++;
                    if (t.feedback && typeof t.feedback.rating === 'number') {
                        engineerMap[engId].ratingSum += t.feedback.rating;
                        engineerMap[engId].ratingCount++;
                    }
                } else {
                    engineerMap[engId].open++;
                }
            }
        });

        const engineerProductivity = Object.values(engineerMap).map(eng => ({
            name: eng.name,
            email: eng.email,
            assigned: eng.assigned,
            resolved: eng.resolved,
            open: eng.open,
            avgRating: eng.ratingCount > 0 ? parseFloat((eng.ratingSum / eng.ratingCount).toFixed(1)) : 0
        })).sort((a, b) => b.resolved - a.resolved);

        // 9. Customer Satisfaction Dashboard
        const ratingsDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const csatFeedback = [];
        tickets.forEach(t => {
            if (t.feedback && typeof t.feedback.rating === 'number') {
                ratingsDistribution[t.feedback.rating]++;
                csatFeedback.push({
                    ticketNo: t.ticketNo,
                    customerName: t.customerId?.customerName || 'Unknown',
                    rating: t.feedback.rating,
                    comment: t.feedback.comment || '',
                    submittedAt: t.feedback.submittedAt || t.updatedAt
                });
            }
        });

        res.json({
            tickets,
            slaCompliance,
            resolutionTimeTrend: resolutionTrendData,
            escalatedTickets,
            complaintsTickets,
            serviceRequestAnalysis,
            fcrStats: {
                totalResolved,
                fcrResolvedCount,
                overallFcrRate,
                trend: fcrTrendData
            },
            engineerProductivity,
            csatBreakdown: {
                distribution: Object.keys(ratingsDistribution).map(rating => ({
                    rating: Number(rating),
                    count: ratingsDistribution[rating]
                })),
                feedback: csatFeedback.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
            }
        });
    } catch (error) {
        console.error('CSM Reports getReportData error:', error);
        res.status(500).json({ message: error.message || 'Error loading report data' });
    }
};
