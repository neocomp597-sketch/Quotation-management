const Enquiry = require('../models/Enquiry');
const mongoose = require('mongoose');

// Compute health score for an enquiry (0-100)
const computeHealthScore = (enquiry) => {
    let score = 50; // base

    // Probability boost
    if (enquiry.probability >= 70) score += 20;
    else if (enquiry.probability >= 40) score += 10;

    // Follow-up status
    if (enquiry.followUpDate && new Date(enquiry.followUpDate) < new Date()) {
        score -= 20; // overdue
    }

    // Vendor quotes & final vendor
    if (enquiry.items && enquiry.items.length > 0) {
        const hasQuotes = enquiry.items.some(item => item.vendorQuotes && item.vendorQuotes.length > 0);
        const hasFinalVendor = enquiry.items.some(item => item.finalVendor);

        if (hasQuotes) score += 10;
        if (hasFinalVendor) score += 10;
    }

    // Inactivity penalty
    const lastActivity = enquiry.lastActivityDate ? new Date(enquiry.lastActivityDate) : new Date(enquiry.createdAt);
    const daysSinceActivity = (new Date() - lastActivity) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity > 14) score -= 25;
    else if (daysSinceActivity > 7) score -= 15;

    // Quotation pending delay
    if (enquiry.status === 'Quotation Pending' && enquiry.items && enquiry.items.length > 0) {
        const itemsWithoutQuotes = enquiry.items.filter(item => !item.vendorQuotes || item.vendorQuotes.length === 0);
        if (itemsWithoutQuotes.length > 0 && daysSinceActivity > 5) {
            score -= 10;
        }
    }

    return Math.max(0, Math.min(100, score)); // cap 0-100
};

// Derive recommended action
const getRecommendedAction = (enquiry, healthScore) => {
    // Overdue follow-up
    if (enquiry.followUpDate && new Date(enquiry.followUpDate) < new Date()) {
        return 'Follow Up Now';
    }

    // Quotation pending for too long
    if (enquiry.status === 'Quotation Pending') {
        const daysInStatus = (new Date() - new Date(enquiry.createdAt)) / (1000 * 60 * 60 * 24);
        if (daysInStatus > 7) return 'Request Revised Quote';
    }

    // Multiple vendor quotes — negotiate
    if (enquiry.status === 'Quotation Received') {
        const quoteCount = enquiry.items ? enquiry.items.reduce((sum, item) => sum + (item.vendorQuotes?.length || 0), 0) : 0;
        if (quoteCount > 1) return 'Re-negotiate';
    }

    // High probability in negotiation — finalize
    if (enquiry.status === 'Negotiation' && enquiry.probability > 60) {
        return 'Finalize Vendor';
    }

    // Low probability + inactive — close as lost
    const daysSinceActivity = (new Date() - (enquiry.lastActivityDate ? new Date(enquiry.lastActivityDate) : new Date(enquiry.createdAt))) / (1000 * 60 * 60 * 24);
    if (enquiry.probability < 20 && daysSinceActivity > 14) {
        return 'Close as Lost';
    }

    // Default — always safe to follow up
    return 'Follow Up Now';
};

exports.getDashboardSummary = async (req, res) => {
    try {
        const { from, to, status, customerId } = req.query;

        let matchStage = {};
        if (from || to) {
            matchStage.enquiryDate = {};
            if (from) matchStage.enquiryDate.$gte = new Date(from);
            if (to) matchStage.enquiryDate.$lte = new Date(to);
        }
        if (status) matchStage.status = status;
        if (customerId) matchStage.customerId = new mongoose.Types.ObjectId(customerId);

        const now = new Date();

        const stats = await Enquiry.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalEnquiries: { $sum: 1 },
                    wonCount: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['PO Received', 'Finalized']] }, 1, 0]
                        }
                    },
                    lostCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] }
                    },
                    activeCount: {
                        $sum: {
                            $cond: [{ $not: { $in: ['$status', ['Lost', 'PO Received', 'Finalized']] } }, 1, 0]
                        }
                    },
                    overdueFU: {
                        $sum: {
                            $cond: [{
                                $and: [
                                    { $ne: ['$followUpDate', null] },
                                    { $lt: ['$followUpDate', now] },
                                    { $not: { $in: ['$status', ['Lost', 'PO Received', 'Finalized']] } }
                                ]
                            }, 1, 0]
                        }
                    },
                    pendingQuotations: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'Quotation Pending'] }, 1, 0]
                        }
                    },
                    avgProbability: { $avg: '$probability' }
                }
            }
        ]);

        const data = stats[0] || {
            totalEnquiries: 0,
            wonCount: 0,
            lostCount: 0,
            activeCount: 0,
            overdueFU: 0,
            pendingQuotations: 0,
            avgProbability: 0
        };

        // Calculate conversion rate
        const conversionRate = data.totalEnquiries > 0 ? ((data.wonCount / data.totalEnquiries) * 100).toFixed(2) : 0;

        res.json({
            ...data,
            conversionRate: parseFloat(conversionRate),
            avgProbability: Math.round(data.avgProbability)
        });
    } catch (err) {
        console.error('[Analytics Error] getDashboardSummary:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getStageDistribution = async (req, res) => {
    try {
        const { from, to } = req.query;

        let matchStage = {};
        if (from || to) {
            matchStage.enquiryDate = {};
            if (from) matchStage.enquiryDate.$gte = new Date(from);
            if (to) matchStage.enquiryDate.$lte = new Date(to);
        }

        const stages = await Enquiry.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const stageOrder = ['New', 'Contacted', 'Quotation Pending', 'Quotation Received', 'Negotiation', 'Finalized', 'PO Received', 'Lost'];
        const result = stageOrder.map(stage => {
            const found = stages.find(s => s._id === stage);
            return { stage, count: found ? found.count : 0 };
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getTrends = async (req, res) => {
    try {
        const { period = 'monthly', from, to } = req.query;

        let matchStage = {};
        if (from || to) {
            matchStage.enquiryDate = {};
            if (from) matchStage.enquiryDate.$gte = new Date(from);
            if (to) matchStage.enquiryDate.$lte = new Date(to);
        }

        let groupFormat;
        if (period === 'daily') {
            groupFormat = { $dateToString: { format: '%Y-%m-%d', date: '$enquiryDate' } };
        } else if (period === 'weekly') {
            groupFormat = { $dateToString: { format: '%Y-W%V', date: '$enquiryDate' } };
        } else {
            groupFormat = { $dateToString: { format: '%Y-%m', date: '$enquiryDate' } };
        }

        const trends = await Enquiry.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: groupFormat,
                    totalEnquiries: { $sum: 1 },
                    wonEnquiries: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['PO Received', 'Finalized']] }, 1, 0]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json(trends);
    } catch (err) {
        console.error('[Analytics Error] getTrends:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getFollowUpIntelligence = async (req, res) => {
    try {
        const { from, to } = req.query;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysLater = new Date(today);
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        const tomorrowStart = new Date(today);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        const statusMatch = { $nin: ['Lost', 'PO Received', 'Finalized'] };

        const [todayFollowups, overdueFollowups, upcomingFollowups] = await Promise.all([
            Enquiry.find({
                status: statusMatch,
                followUpDate: { $gte: today, $lt: tomorrowStart }
            })
                .populate('customerId', 'companyName')
                .populate('items.finalVendor', 'name')
                .sort({ followUpDate: 1 })
                .select('enquiryNo followUpDate probability status items customerId'),

            Enquiry.find({
                status: statusMatch,
                followUpDate: { $lt: today }
            })
                .populate('customerId', 'companyName')
                .sort({ followUpDate: 1 })
                .select('enquiryNo followUpDate probability status items customerId'),

            Enquiry.find({
                status: statusMatch,
                followUpDate: { $gte: tomorrowStart, $lte: sevenDaysLater }
            })
                .populate('customerId', 'companyName')
                .sort({ followUpDate: 1 })
                .select('enquiryNo followUpDate probability status items customerId')
        ]);

        // High-risk enquiries: inactive + low probability, or overdue follow-ups + low probability
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const highRisk = await Enquiry.find({
            status: statusMatch,
            $or: [
                { lastActivityDate: { $lt: sevenDaysAgo }, probability: { $lt: 40 } },
                { followUpDate: { $lt: today }, probability: { $lt: 30 } }
            ]
        })
            .populate('customerId', 'companyName')
            .sort({ lastActivityDate: 1 })
            .select('enquiryNo lastActivityDate probability status items customerId followUpDate');

        res.json({
            today: todayFollowups,
            overdue: overdueFollowups,
            upcoming: upcomingFollowups,
            highRisk: highRisk.slice(0, 10) // top 10
        });
    } catch (err) {
        console.error('[Analytics Error] getFollowUpIntelligence:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getVendorIntelligence = async (req, res) => {
    try {
        const { from, to } = req.query;

        let matchStage = {};
        if (from || to) {
            matchStage.enquiryDate = {};
            if (from) matchStage.enquiryDate.$gte = new Date(from);
            if (to) matchStage.enquiryDate.$lte = new Date(to);
        }

        const vendors = await Enquiry.aggregate([
            { $match: matchStage },
            { $unwind: '$items' },
            { $unwind: { path: '$items.vendorQuotes', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$items.vendorQuotes.vendorId',
                    vendorName: { $first: '$items.vendorQuotes.vendorName' },
                    quoteCount: { $sum: 1 },
                    avgPrice: { $avg: '$items.vendorQuotes.price' },
                    winCount: {
                        $sum: {
                            $cond: [{ $eq: ['$items.finalVendor', '$items.vendorQuotes.vendorId'] }, 1, 0]
                        }
                    }
                }
            },
            {
                $addFields: {
                    winRatio: {
                        $cond: [
                            { $gt: ['$quoteCount', 0] },
                            { $round: [{ $multiply: [{ $divide: ['$winCount', '$quoteCount'] }, 100] }, 2] },
                            0
                        ]
                    }
                }
            },
            { $sort: { quoteCount: -1 } }
        ]);

        res.json(vendors);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getProductIntelligence = async (req, res) => {
    try {
        const { from, to } = req.query;

        let matchStage = {};
        if (from || to) {
            matchStage.enquiryDate = {};
            if (from) matchStage.enquiryDate.$gte = new Date(from);
            if (to) matchStage.enquiryDate.$lte = new Date(to);
        }

        const products = await Enquiry.aggregate([
            { $match: matchStage },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productName',
                    enquiryCount: { $sum: 1 },
                    wonCount: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['PO Received', 'Finalized']] }, 1, 0]
                        }
                    },
                    lostCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] }
                    },
                    vendorCount: {
                        $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$items.vendors', []] } }, 0] }, 1, 0] }
                    }
                }
            },
            {
                $addFields: {
                    conversionRate: {
                        $cond: [
                            { $gt: ['$enquiryCount', 0] },
                            { $round: [{ $multiply: [{ $divide: ['$wonCount', '$enquiryCount'] }, 100] }, 2] },
                            0
                        ]
                    }
                }
            },
            { $sort: { enquiryCount: -1 } }
        ]);

        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getUserPerformance = async (req, res) => {
    try {
        const { from, to } = req.query;

        let matchStage = {};
        if (from || to) {
            matchStage.enquiryDate = {};
            if (from) matchStage.enquiryDate.$gte = new Date(from);
            if (to) matchStage.enquiryDate.$lte = new Date(to);
        }

        const users = await Enquiry.aggregate([
            { $match: matchStage },
            { $unwind: '$items' },
            {
                $group: {
                    _id: { $ifNull: ['$items.salespersonName', 'Unassigned'] },
                    handledCount: { $sum: 1 },
                    wonCount: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['PO Received', 'Finalized']] }, 1, 0]
                        }
                    },
                    lostCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] }
                    },
                    pendingCount: {
                        $sum: {
                            $cond: [{ $not: { $in: ['$status', ['Lost', 'PO Received', 'Finalized']] } }, 1, 0]
                        }
                    }
                }
            },
            {
                $addFields: {
                    conversionRate: {
                        $cond: [
                            { $gt: ['$handledCount', 0] },
                            { $round: [{ $multiply: [{ $divide: ['$wonCount', '$handledCount'] }, 100] }, 2] },
                            0
                        ]
                    }
                }
            },
            { $sort: { handledCount: -1 } }
        ]);

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getProbabilityIntelligence = async (req, res) => {
    try {
        const { from, to } = req.query;

        let matchStage = {};
        if (from || to) {
            matchStage.enquiryDate = {};
            if (from) matchStage.enquiryDate.$gte = new Date(from);
            if (to) matchStage.enquiryDate.$lte = new Date(to);
        }

        // Avg probability by stage
        const byStage = await Enquiry.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$status',
                    avgProbability: { $avg: '$probability' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // High probability not closed
        const highProb = await Enquiry.find({
            ...matchStage,
            probability: { $gte: 70 },
            status: { $nin: ['Lost', 'PO Received', 'Finalized'] }
        })
            .populate('customerId', 'companyName')
            .select('enquiryNo probability status customerId items')
            .sort({ probability: -1 })
            .limit(10);

        // Low probability that won (insights)
        const lowProbWon = await Enquiry.find({
            ...matchStage,
            probability: { $lt: 30 },
            status: { $in: ['PO Received', 'Finalized'] }
        })
            .populate('customerId', 'companyName')
            .select('enquiryNo probability status customerId items')
            .sort({ probability: 1 })
            .limit(10);

        res.json({
            byStage,
            highProbNotClosed: highProb,
            lowProbWon: lowProbWon
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getHealthScores = async (req, res) => {
    try {
        const { from, to, status } = req.query;

        let matchStage = { status: { $nin: ['Lost', 'PO Received', 'Finalized'] } };
        if (from || to) {
            matchStage.enquiryDate = {};
            if (from) matchStage.enquiryDate.$gte = new Date(from);
            if (to) matchStage.enquiryDate.$lte = new Date(to);
        }
        if (status) matchStage.status = status;

        let enquiries = await Enquiry.find(matchStage)
            .populate('customerId', 'companyName')
            .sort({ createdAt: -1 });

        const data = enquiries.map(e => {
            const healthScore = computeHealthScore(e);
            const recommendedAction = getRecommendedAction(e, healthScore);

            let healthStatus = 'At Risk';
            if (healthScore >= 80) healthStatus = 'Healthy';
            else if (healthScore >= 50) healthStatus = 'Needs Attention';

            return {
                _id: e._id,
                enquiryNo: e.enquiryNo,
                customerId: e.customerId,
                status: e.status,
                probability: e.probability,
                healthScore,
                healthStatus,
                recommendedAction,
                followUpDate: e.followUpDate,
                lastActivityDate: e.lastActivityDate
            };
        });

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.exportReport = async (req, res) => {
    try {
        const { type = 'enquiries' } = req.query;

        let data;
        if (type === 'enquiries') {
            data = await Enquiry.find()
                .populate('customerId', 'companyName')
                .select('enquiryNo enquiryDate status probability items');
        } else if (type === 'vendors') {
            const result = await exports.getVendorIntelligence({}, {});
            // This is a workaround — better to call the controller logic directly
            return res.json(await Enquiry.aggregate([
                { $unwind: '$items' },
                { $unwind: { path: '$items.vendorQuotes', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: '$items.vendorQuotes.vendorId',
                        vendorName: { $first: '$items.vendorQuotes.vendorName' },
                        quoteCount: { $sum: 1 },
                        avgPrice: { $avg: '$items.vendorQuotes.price' },
                        winCount: {
                            $sum: {
                                $cond: [{ $eq: ['$items.finalVendor', '$items.vendorQuotes.vendorId'] }, 1, 0]
                            }
                        }
                    }
                }
            ]));
        } else if (type === 'followups') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            data = await Enquiry.find({
                status: { $nin: ['Lost', 'PO Received', 'Finalized'] },
                followUpDate: { $exists: true }
            })
                .populate('customerId', 'companyName')
                .select('enquiryNo followUpDate probability status')
                .sort({ followUpDate: 1 });
        } else if (type === 'conversion') {
            data = await Enquiry.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);
        } else if (type === 'products') {
            data = await Enquiry.aggregate([
                { $unwind: '$items' },
                {
                    $group: {
                        _id: '$items.productName',
                        enquiryCount: { $sum: 1 },
                        wonCount: {
                            $sum: {
                                $cond: [{ $in: ['$status', ['PO Received', 'Finalized']] }, 1, 0]
                            }
                        }
                    }
                },
                { $sort: { enquiryCount: -1 } }
            ]);
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
