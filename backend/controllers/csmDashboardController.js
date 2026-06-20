const Ticket = require('../models/Ticket');
const User = require('../models/User');

exports.getStats = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const now = new Date();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Core metric counters
        const openCount = await Ticket.countDocuments({ status: 'Open', companyId });
        const assignedCount = await Ticket.countDocuments({ status: 'Assigned', companyId });
        const inProgressCount = await Ticket.countDocuments({ status: 'In Progress', companyId });
        const pendingCount = await Ticket.countDocuments({ status: 'Pending Customer', companyId });
        const resolvedTodayCount = await Ticket.countDocuments({
            status: 'Resolved',
            resolvedAt: { $gte: startOfToday },
            companyId
        });

        // Overdue tickets (any unresolved ticket past resolution due time)
        const overdueCount = await Ticket.countDocuments({
            status: { $nin: ['Resolved', 'Closed', 'Cancelled'] },
            slaResolutionDue: { $lt: now },
            companyId
        });

        // Status breakdown
        const statusBreakdown = await Ticket.aggregate([
            { $match: { companyId } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Priority breakdown
        const priorityBreakdown = await Ticket.aggregate([
            { $match: { companyId } },
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
            { $match: { companyId } },
            {
                $lookup: {
                    from: 'ticketcategories',
                    localField: 'categoryId',
                    foreignField: '_id',
                    as: 'catInfo'
                }
            },
            { $unwind: '$catInfo' },
            { $group: { _id: '$catInfo.name', count: { $sum: 1 } } }
        ]);

        // SLA compliance breach ratios
        const slaCompliantRes = await Ticket.countDocuments({
            'isSlaBreached.resolution': false,
            status: { $in: ['Resolved', 'Closed'] },
            companyId
        });
        const slaBreachedRes = await Ticket.countDocuments({
            'isSlaBreached.resolution': true,
            companyId
        });

        // Average resolution time in hours
        const resolvedTickets = await Ticket.find({
            status: { $in: ['Resolved', 'Closed'] },
            resolvedAt: { $exists: true },
            companyId
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
            { $match: { companyId, assignedEngineerId: { $ne: null }, status: { $in: ['Resolved', 'Closed'] } } },
            {
                $group: {
                    _id: '$assignedEngineerId',
                    resolvedCount: { $sum: 1 },
                    avgRating: { $avg: '$feedback.rating' }
                }
            },
            {
                $lookup: {
                    from: 'users',
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

        res.json({
            metrics: {
                open: openCount + assignedCount + inProgressCount,
                pending: pendingCount,
                overdue: overdueCount,
                resolvedToday: resolvedTodayCount
            },
            statusBreakdown: statusBreakdown.map(item => ({ name: item._id, value: item.count })),
            priorityBreakdown: priorityBreakdown.map(item => ({ name: item._id, value: item.count, color: item.color })),
            categoryBreakdown: categoryBreakdown.map(item => ({ name: item._id, value: item.count })),
            slaCompliance: [
                { name: 'Compliant', value: slaCompliantRes },
                { name: 'Breached', value: slaBreachedRes }
            ],
            avgResolutionHours,
            engineerPerformance
        });
    } catch (error) {
        console.error('CSM Dashboard stats error:', error);
        res.status(500).json({ message: error.message || 'Error loading dashboard statistics' });
    }
};
