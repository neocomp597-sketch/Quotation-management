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
            status: { $in: ['Resolved', 'Closed'] },
            companyId
        });
        const totalFCR = await Ticket.countDocuments({
            status: { $in: ['Resolved', 'Closed'] },
            isFirstCallResolved: true,
            companyId
        });
        const fcrRate = totalResolvedOrClosed > 0 ? parseFloat(((totalFCR / totalResolvedOrClosed) * 100).toFixed(1)) : 0;

        res.json({
            metrics: {
                open: openCount + assignedCount + inProgressCount,
                pending: pendingCount,
                overdue: overdueCount,
                resolvedToday: resolvedTodayCount,
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
            engineerPerformance
        });
    } catch (error) {
        console.error('CSM Dashboard stats error:', error);
        res.status(500).json({ message: error.message || 'Error loading dashboard statistics' });
    }
};

exports.getReportData = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { startDate, endDate, priorityId, categoryId, assignedEngineerId } = req.query;

        const filter = { companyId };
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }
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

        // 5. Customer Complaints Report (where typeName is Complaint or categoryName is Complaint)
        const complaintsTickets = tickets.filter(t => 
            t.typeId?.name?.toLowerCase().includes('complaint') || 
            t.categoryId?.name?.toLowerCase().includes('complaint')
        );

        // 6. Service Request Analysis (tickets count by category)
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

        // FCR Trend
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
        // Let's query all engineers from the Engineer Master
        const Engineer = require('../models/Engineer');
        const engineers = await Engineer.find({ companyId }).select('name email').lean();
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

        // Loop through all tickets to build engineer stats
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
