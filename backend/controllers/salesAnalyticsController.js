const Deal = require('../models/Deal');
const DealActivity = require('../models/DealActivity');
const SalesPipeline = require('../models/SalesPipeline');
const mongoose = require('mongoose');

// GET /api/sales/analytics/funnel/:pipelineId
exports.getPipelineFunnel = async (req, res) => {
    try {
        const { pipelineId } = req.params;
        const pipeline = await SalesPipeline.findById(pipelineId).lean();
        if (!pipeline) return res.status(404).json({ message: 'Pipeline not found' });

        const stages = pipeline.stages.sort((a, b) => a.sortOrder - b.sortOrder);

        const counts = await Deal.aggregate([
            { $match: { pipelineId: new mongoose.Types.ObjectId(pipelineId) } },
            { $group: { _id: '$stageId', count: { $sum: 1 }, value: { $sum: '$value' } } }
        ]);

        const funnel = stages.map(stage => {
            const found = counts.find(c => c._id === stage._id.toString());
            return {
                name: stage.name,
                color: stage.color,
                probability: stage.probability,
                count: found?.count || 0,
                value: found?.value || 0
            };
        });

        // Add Won and Lost separately
        const wonLost = await Deal.aggregate([
            { $match: { pipelineId: new mongoose.Types.ObjectId(pipelineId), status: { $in: ['Won', 'Lost'] } } },
            { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$value' } } }
        ]);

        // Conversion: first stage to Won
        const totalDeals = await Deal.countDocuments({ pipelineId });
        const wonDeals = wonLost.find(w => w._id === 'Won')?.count || 0;
        const conversionRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

        res.json({ funnel, wonLost, conversionRate, totalDeals });
    } catch (err) {
        console.error('[Sales Analytics] getPipelineFunnel error:', err);
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/analytics/dropoff
exports.getStageDropoff = async (req, res) => {
    try {
        // Find deals that moved to Lost from each stage
        const dropoff = await Deal.aggregate([
            { $match: { status: 'Lost' } },
            {
                $group: {
                    _id: '$stageId',
                    lostCount: { $sum: 1 },
                    lostValue: { $sum: '$value' }
                }
            },
            { $sort: { lostCount: -1 } }
        ]);

        // Enrich with stage names
        const pipelines = await SalesPipeline.find().lean();
        const stageMap = {};
        pipelines.forEach(p => {
            p.stages.forEach(s => {
                stageMap[s._id.toString()] = { name: s.name, color: s.color, pipelineName: p.name };
            });
        });

        const enriched = dropoff.map(d => ({
            ...d,
            stageName: stageMap[d._id]?.name || 'Unknown',
            stageColor: stageMap[d._id]?.color || '#94a3b8',
            pipelineName: stageMap[d._id]?.pipelineName || 'Unknown'
        }));

        // Loss reason breakdown
        const lossReasons = await Deal.aggregate([
            { $match: { status: 'Lost', lostReason: { $ne: '' } } },
            { $group: { _id: '$lostReason', count: { $sum: 1 }, value: { $sum: '$value' } } },
            { $sort: { count: -1 } }
        ]);

        res.json({ dropoff: enriched, lossReasons });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/analytics/stuck
exports.getStuckDeals = async (req, res) => {
    try {
        const now = new Date();
        const sevenDays = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const fifteenDays = new Date(now - 15 * 24 * 60 * 60 * 1000);
        const thirtyDays = new Date(now - 30 * 24 * 60 * 60 * 1000);

        const [stuck7, stuck15, stuck30] = await Promise.all([
            Deal.find({ status: 'Open', updatedAt: { $lte: sevenDays, $gt: fifteenDays } })
                .populate('customerId', 'customerName companyName')
                .populate('ownerId', 'name')
                .select('title value probability stageId updatedAt')
                .sort({ updatedAt: 1 })
                .lean(),
            Deal.find({ status: 'Open', updatedAt: { $lte: fifteenDays, $gt: thirtyDays } })
                .populate('customerId', 'customerName companyName')
                .populate('ownerId', 'name')
                .select('title value probability stageId updatedAt')
                .sort({ updatedAt: 1 })
                .lean(),
            Deal.find({ status: 'Open', updatedAt: { $lte: thirtyDays } })
                .populate('customerId', 'customerName companyName')
                .populate('ownerId', 'name')
                .select('title value probability stageId updatedAt')
                .sort({ updatedAt: 1 })
                .lean()
        ]);

        res.json({
            sevenDays: stuck7,
            fifteenDays: stuck15,
            thirtyDays: stuck30,
            totalStuck: stuck7.length + stuck15.length + stuck30.length
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/analytics/salesperson
exports.getSalespersonAnalytics = async (req, res) => {
    try {
        const stats = await Deal.aggregate([
            {
                $group: {
                    _id: '$ownerId',
                    totalDeals: { $sum: 1 },
                    openDeals: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
                    wonDeals: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] } },
                    lostDeals: { $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] } },
                    totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, '$value', 0] } },
                    pipelineValue: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, '$value', 0] } }
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
                $addFields: {
                    userName: '$user.name',
                    conversionRate: {
                        $cond: [
                            { $gt: [{ $add: ['$wonDeals', '$lostDeals'] }, 0] },
                            { $round: [{ $multiply: [{ $divide: ['$wonDeals', { $add: ['$wonDeals', '$lostDeals'] }] }, 100] }, 1] },
                            0
                        ]
                    }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/analytics/pipeline-velocity
exports.getPipelineVelocity = async (req, res) => {
    try {
        // Average time per stage for won deals
        // This calculates avg days from creation to win
        const velocity = await Deal.aggregate([
            { $match: { status: 'Won', wonDate: { $exists: true } } },
            {
                $project: {
                    cycleDays: {
                        $divide: [{ $subtract: ['$wonDate', '$createdAt'] }, 1000 * 60 * 60 * 24]
                    },
                    value: 1
                }
            },
            {
                $group: {
                    _id: null,
                    avgCycleDays: { $avg: '$cycleDays' },
                    minCycleDays: { $min: '$cycleDays' },
                    maxCycleDays: { $max: '$cycleDays' },
                    avgDealValue: { $avg: '$value' },
                    totalDeals: { $sum: 1 }
                }
            }
        ]);

        // Pipeline velocity = (deals * avg deal size * win rate) / avg cycle days
        const v = velocity[0] || {};
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const recentStats = await Deal.aggregate([
            { $match: { status: { $in: ['Won', 'Lost'] }, updatedAt: { $gte: ninetyDaysAgo } } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const wonCount = recentStats.find(r => r._id === 'Won')?.count || 0;
        const lostCount = recentStats.find(r => r._id === 'Lost')?.count || 0;
        const winRate = (wonCount + lostCount) > 0 ? wonCount / (wonCount + lostCount) : 0;

        const openDeals = await Deal.countDocuments({ status: 'Open' });
        const avgCycle = v.avgCycleDays || 1;
        const pipelineVelocity = avgCycle > 0
            ? Math.round((openDeals * (v.avgDealValue || 0) * winRate) / avgCycle)
            : 0;

        res.json({
            avgCycleDays: Math.round(v.avgCycleDays || 0),
            minCycleDays: Math.round(v.minCycleDays || 0),
            maxCycleDays: Math.round(v.maxCycleDays || 0),
            winRate: Math.round(winRate * 100),
            pipelineVelocity,
            totalWonDeals: v.totalDeals || 0
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/analytics/source
exports.getSourceAnalytics = async (req, res) => {
    try {
        const stats = await Deal.aggregate([
            {
                $group: {
                    _id: '$source',
                    totalDeals: { $sum: 1 },
                    wonDeals: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] } },
                    totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, '$value', 0] } },
                    pipelineValue: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, '$value', 0] } }
                }
            },
            {
                $addFields: {
                    conversionRate: {
                        $cond: [
                            { $gt: ['$totalDeals', 0] },
                            { $round: [{ $multiply: [{ $divide: ['$wonDeals', '$totalDeals'] }, 100] }, 1] },
                            0
                        ]
                    }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/activities
exports.getAllActivities = async (req, res) => {
    try {
        const { type, dealId, performedBy, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (type) filter.type = type;
        if (dealId) filter.dealId = dealId;
        if (performedBy) filter.performedBy = performedBy;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [activities, total] = await Promise.all([
            DealActivity.find(filter)
                .populate('performedBy', 'name')
                .populate({
                    path: 'dealId',
                    select: 'title value status',
                    populate: { path: 'customerId', select: 'customerName companyName' }
                })
                .sort({ activityDate: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            DealActivity.countDocuments(filter)
        ]);

        res.json({ activities, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        console.error('[Sales Analytics] getAllActivities error:', err);
        res.status(500).json({ message: err.message });
    }
};
