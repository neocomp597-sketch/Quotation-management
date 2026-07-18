const Deal = require('../models/Deal');
const DealActivity = require('../models/DealActivity');
const ForecastSnapshot = require('../models/ForecastSnapshot');
const SalesTarget = require('../models/SalesTarget');
const mongoose = require('mongoose');

// GET /api/sales/forecast/dashboard
exports.getForecastDashboard = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // Pipeline value (all open deals)
        const pipelineStats = await Deal.aggregate([
            { $match: { status: 'Open' } },
            {
                $group: {
                    _id: null,
                    pipelineValue: { $sum: '$value' },
                    weightedForecast: { $sum: '$weightedValue' },
                    dealCount: { $sum: 1 },
                    avgDealSize: { $avg: '$value' },
                    avgProbability: { $avg: '$probability' }
                }
            }
        ]);

        // Best case (Commit + Best Case categories)
        const bestCaseStats = await Deal.aggregate([
            { $match: { status: 'Open', forecastCategory: { $in: ['Commit', 'Best Case'] } } },
            { $group: { _id: null, total: { $sum: '$value' } } }
        ]);

        // Closed this month
        const closedStats = await Deal.aggregate([
            { $match: { status: 'Won', wonDate: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, closedRevenue: { $sum: '$value' }, closedCount: { $sum: 1 } } }
        ]);

        // Win/Loss stats (last 90 days)
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const winLossStats = await Deal.aggregate([
            { $match: { status: { $in: ['Won', 'Lost'] }, updatedAt: { $gte: ninetyDaysAgo } } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const wonCount = winLossStats.find(w => w._id === 'Won')?.count || 0;
        const lostCount = winLossStats.find(w => w._id === 'Lost')?.count || 0;
        const winRate = (wonCount + lostCount) > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

        // Average sales cycle (won deals)
        const cycleDays = await Deal.aggregate([
            { $match: { status: 'Won', wonDate: { $exists: true } } },
            {
                $project: {
                    cycleDays: {
                        $divide: [{ $subtract: ['$wonDate', '$createdAt'] }, 1000 * 60 * 60 * 24]
                    }
                }
            },
            { $group: { _id: null, avgCycle: { $avg: '$cycleDays' } } }
        ]);

        // Forecast accuracy (last month snapshot)
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const lastMonthLabel = `${monthNames[lastMonth.getMonth()]}-${lastMonth.getFullYear()}`;
        const snapshot = await ForecastSnapshot.findOne({ month: lastMonthLabel }).lean();

        const pipeline = pipelineStats[0] || {};
        const closed = closedStats[0] || {};

        res.json({
            revenueForecast: pipeline.weightedForecast || 0,
            pipelineValue: pipeline.pipelineValue || 0,
            weightedForecast: pipeline.weightedForecast || 0,
            closedRevenue: closed.closedRevenue || 0,
            closedCount: closed.closedCount || 0,
            winRate,
            avgDealSize: Math.round(pipeline.avgDealSize || 0),
            salesCycleDays: Math.round(cycleDays[0]?.avgCycle || 0),
            forecastAccuracy: snapshot?.accuracy || 0,
            bestCaseRevenue: (bestCaseStats[0]?.total || 0) + (closed.closedRevenue || 0),
            dealCount: pipeline.dealCount || 0
        });
    } catch (err) {
        console.error('[Forecast] getDashboardKPIs error:', err);
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/forecast/revenue
exports.getRevenueForecast = async (req, res) => {
    try {
        const { forecastCategory, ownerId } = req.query;

        const filter = { status: 'Open' };
        if (forecastCategory) filter.forecastCategory = forecastCategory;
        if (ownerId) filter.ownerId = ownerId;

        const deals = await Deal.find(filter)
            .populate('customerId', 'customerName companyName')
            .populate('ownerId', 'name')
            .sort({ value: -1 })
            .lean();

        const summary = {
            expectedRevenue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
            weightedRevenue: deals.reduce((sum, d) => sum + (d.weightedValue || 0), 0),
            bestCase: deals
                .filter(d => ['Commit', 'Best Case'].includes(d.forecastCategory))
                .reduce((sum, d) => sum + (d.value || 0), 0),
            worstCase: deals
                .filter(d => d.forecastCategory === 'Commit')
                .reduce((sum, d) => sum + (d.weightedValue || 0), 0),
            deals
        };

        res.json(summary);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/forecast/accuracy
exports.getForecastAccuracy = async (req, res) => {
    try {
        const snapshots = await ForecastSnapshot.find()
            .sort({ month: -1 })
            .limit(12)
            .lean();

        // User-level accuracy (comparing target vs achieved)
        const userAccuracy = await SalesTarget.aggregate([
            { $match: { targetAmount: { $gt: 0 } } },
            {
                $group: {
                    _id: '$userId',
                    totalTarget: { $sum: '$targetAmount' },
                    totalAchieved: { $sum: '$achievedAmount' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user',
                    pipeline: [{ $project: { name: 1, email: 1 } }]
                }
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    userName: '$user.name',
                    totalTarget: 1,
                    totalAchieved: 1,
                    accuracy: {
                        $cond: [
                            { $gt: ['$totalTarget', 0] },
                            { $round: [{ $multiply: [{ $divide: ['$totalAchieved', '$totalTarget'] }, 100] }, 1] },
                            0
                        ]
                    }
                }
            },
            { $sort: { accuracy: -1 } }
        ]);

        res.json({ snapshots, userAccuracy });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/sales/forecast/snapshot
exports.takeSnapshot = async (req, res) => {
    try {
        const now = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${monthNames[now.getMonth()]}-${now.getFullYear()}`;

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        // Calculate current values
        const openStats = await Deal.aggregate([
            { $match: { status: 'Open' } },
            {
                $group: {
                    _id: null,
                    pipelineValue: { $sum: '$value' },
                    weightedForecast: { $sum: '$weightedValue' }
                }
            }
        ]);

        const bestCaseStats = await Deal.aggregate([
            { $match: { status: 'Open', forecastCategory: { $in: ['Commit', 'Best Case'] } } },
            { $group: { _id: null, total: { $sum: '$value' } } }
        ]);

        const commitStats = await Deal.aggregate([
            { $match: { status: 'Open', forecastCategory: 'Commit' } },
            { $group: { _id: null, total: { $sum: '$weightedValue' } } }
        ]);

        const closedStats = await Deal.aggregate([
            { $match: { status: 'Won', wonDate: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, total: { $sum: '$value' } } }
        ]);

        const open = openStats[0] || {};
        const actualRevenue = closedStats[0]?.total || 0;
        const weighted = open.weightedForecast || 0;

        const snapshot = await ForecastSnapshot.findOneAndUpdate(
            { month: monthLabel },
            {
                pipelineValue: open.pipelineValue || 0,
                weightedForecast: weighted,
                bestCase: bestCaseStats[0]?.total || 0,
                worstCase: commitStats[0]?.total || 0,
                actualRevenue,
                accuracy: weighted > 0 ? Math.round((actualRevenue / weighted) * 100) : 0
            },
            { upsert: true, new: true }
        );

        res.json(snapshot);
    } catch (err) {
        console.error('[Forecast] takeSnapshot error:', err);
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/forecast/trends
exports.getRevenueTrends = async (req, res) => {
    try {
        // Monthly won revenue for last 12 months
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const trends = await Deal.aggregate([
            { $match: { status: 'Won', wonDate: { $gte: twelveMonthsAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$wonDate' } },
                    revenue: { $sum: '$value' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json(trends);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
