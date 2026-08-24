const Enquiry = require('../models/Enquiry');
const Quotation = require('../models/Quotation');
const EmployeeProfile = require('../models/EmployeeProfile');
const User = require('../models/User');
const Department = require('../models/Department');
const Company = require('../models/Company');
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
                            $cond: [{ $in: ['$status', ['Resolved', 'Closed', 'PO Received', 'Finalized']] }, 1, 0]
                        }
                    },
                    lostCount: {
                        $sum: { $cond: [{ $in: ['$status', ['Cancelled', 'Lost']] }, 1, 0] }
                    },
                    activeCount: {
                        $sum: {
                            $cond: [{ $not: { $in: ['$status', ['Resolved', 'Closed', 'Cancelled', 'Lost', 'PO Received', 'Finalized']] } }, 1, 0]
                        }
                    },
                    overdueFU: {
                        $sum: {
                            $cond: [{
                                $and: [
                                    { $ne: ['$followUpDate', null] },
                                    { $lt: ['$followUpDate', now] },
                                    { $not: { $in: ['$status', ['Resolved', 'Closed', 'Cancelled', 'Lost', 'PO Received', 'Finalized']] } }
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

        const stageOrder = ['Open', 'Assigned', 'In Progress', 'Pending Customer', 'Resolved', 'Closed', 'Cancelled'];
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
                .select('enquiryNo followUpDate probability status items customerId')
                .lean(),

            Enquiry.find({
                status: statusMatch,
                followUpDate: { $lt: today }
            })
                .populate('customerId', 'companyName')
                .sort({ followUpDate: 1 })
                .select('enquiryNo followUpDate probability status items customerId')
                .lean(),

            Enquiry.find({
                status: statusMatch,
                followUpDate: { $gte: tomorrowStart, $lte: sevenDaysLater }
            })
                .populate('customerId', 'companyName')
                .sort({ followUpDate: 1 })
                .select('enquiryNo followUpDate probability status items customerId')
                .lean()
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
            .select('enquiryNo lastActivityDate probability status items customerId followUpDate')
            .lean();

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

exports.getCustomerIntelligence = async (req, res) => {
    try {
        const { from, to } = req.query;

        let matchStage = {};
        if (from || to) {
            matchStage.enquiryDate = {};
            if (from) matchStage.enquiryDate.$gte = new Date(from);
            if (to) matchStage.enquiryDate.$lte = new Date(to);
        }

        const customers = await Enquiry.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$customerId',
                    enquiryCount: { $sum: 1 },
                    wonCount: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['Resolved', 'Closed', 'PO Received', 'Finalized']] }, 1, 0]
                        }
                    },
                    lostCount: {
                        $sum: { $cond: [{ $in: ['$status', ['Cancelled', 'Lost']] }, 1, 0] }
                    },
                    inProgressCount: {
                        $sum: {
                            $cond: [{ $not: { $in: ['$status', ['Resolved', 'Closed', 'Cancelled', 'Lost', 'PO Received', 'Finalized']] } }, 1, 0]
                        }
                    },
                    avgProbability: { $avg: '$probability' }
                }
            },
            {
                $lookup: {
                    from: 'customers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'customerDetails'
                }
            },
            { $unwind: { path: '$customerDetails', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    customerName: {
                        $ifNull: [
                            '$customerDetails.companyName',
                            { $ifNull: ['$customerDetails.customerName', 'Unknown Customer'] }
                        ]
                    },
                    email: '$customerDetails.email',
                    phone: '$customerDetails.mobile',
                    enquiryCount: 1,
                    wonCount: 1,
                    lostCount: 1,
                    inProgressCount: 1,
                    avgProbability: { $round: [{ $ifNull: ['$avgProbability', 0] }, 0] },
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

        res.json(customers);
    } catch (err) {
        console.error('[Analytics Error] getCustomerIntelligence:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getVendorIntelligence = async (req, res) => {
    try {
        const { from, to } = req.query;

        let matchStage = {};
        if (from || to) {
            matchStage.createdAt = {};
            if (from) matchStage.createdAt.$gte = new Date(from);
            if (to) matchStage.createdAt.$lte = new Date(to);
        }

        const vendors = await Quotation.aggregate([
            { $match: matchStage },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
            {
                $group: {
                    _id: { $ifNull: ['$items.vendorId', 'Unassigned'] },
                    vendorName: { $first: '$items.vendorName' },
                    quoteCount: { $sum: 1 },
                    avgPrice: { $avg: '$items.vendorPrice' },
                    winCount: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'ordered'] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    vendorName: { $ifNull: ['$vendorName', 'Unknown Vendor'] },
                    quoteCount: 1,
                    avgPrice: { $ifNull: ['$avgPrice', 0] },
                    winCount: 1,
                    lossCount: { $subtract: ['$quoteCount', '$winCount'] },
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
        console.error('[Analytics Error] getVendorIntelligence:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getProductIntelligence = async (req, res) => {
    try {
        const { from, to } = req.query;

        let matchStage = {};
        if (from || to) {
            matchStage.createdAt = {};
            if (from) matchStage.createdAt.$gte = new Date(from);
            if (to) matchStage.createdAt.$lte = new Date(to);
        }

        const products = await Quotation.aggregate([
            { $match: matchStage },
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
            {
                $group: {
                    _id: { $ifNull: ['$items.productSnapshot.productName', { $ifNull: ['$items.productName', 'Unspecified Product'] }] },
                    enquiryCount: { $sum: 1 },
                    wonCount: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'ordered'] }, 1, 0]
                        }
                    },
                    vendors: { $addToSet: '$items.vendorId' }
                }
            },
            {
                $project: {
                    _id: 1,
                    productName: '$_id',
                    enquiryCount: 1,
                    wonCount: 1,
                    lostCount: { $subtract: ['$enquiryCount', '$wonCount'] },
                    vendorCount: { $size: { $ifNull: ['$vendors', []] } },
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
        console.error('[Analytics Error] getProductIntelligence:', err);
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
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
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
            .limit(10)
            .lean();

        // Low probability that won (insights)
        const lowProbWon = await Enquiry.find({
            ...matchStage,
            probability: { $lt: 30 },
            status: { $in: ['PO Received', 'Finalized'] }
        })
            .populate('customerId', 'companyName')
            .select('enquiryNo probability status customerId items')
            .sort({ probability: 1 })
            .limit(10)
            .lean();

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
            .select('enquiryNo customerId status probability followUpDate lastActivityDate createdAt')
            .populate('customerId', 'companyName')
            .sort({ createdAt: -1 })
            .lean();

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
                .select('enquiryNo enquiryDate status probability items')
                .lean();
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
                .sort({ followUpDate: 1 })
                .lean();
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

exports.getDailyReport = async (req, res) => {
    try {
        const companyId = req.companyId || req.user?.companyId;
        const targetDate = req.query.date ? new Date(req.query.date) : new Date();

        // Fetch Company details
        let companyName = "Stelmec Ltd. (SBU 2A)";
        if (companyId) {
            const company = await Company.findById(companyId).select('companyName name').lean();
            if (company) {
                companyName = company.companyName || company.name || companyName;
            }
        }

        const filter = {};
        if (companyId) filter.companyId = companyId;

        const employees = await EmployeeProfile.find(filter).lean();
        const users = await User.find(companyId ? { companyId } : {}).lean();

        // Standard 15 departments reference list
        const stdDeptNames = [
            "1- Accounts & Finance",
            "2- Administration",
            "3- Customer Care ",
            "4- Design & Development",
            "5- EDP/IT",
            "6- Engineering",
            "7- General Mgmt. & Oper.",
            "8- Human Resources",
            "9- Logistics",
            "10- Production",
            "11- Purchase",
            "12- Project Mgmt.",
            "13- Stores",
            "14- Testing",
            "15- Quality"
        ];

        const defaultDeptPlans = {
            "1- Accounts & Finance": 4,
            "2- Administration": 4,
            "3- Customer Care ": 28,
            "4- Design & Development": 7,
            "5- EDP/IT": 1,
            "6- Engineering": 10,
            "7- General Mgmt. & Oper.": 1,
            "8- Human Resources": 1,
            "9- Logistics": 3,
            "10- Production": 18,
            "11- Purchase": 8,
            "12- Project Mgmt.": 3,
            "13- Stores": 4,
            "14- Testing": 20,
            "15- Quality": 6
        };

        // Categorize real employees
        let staffUsgaonCount = 0;
        let staffSiteCount = 0;
        let permProdCount = 0;
        let permTestingCount = 0;
        let permOtherCount = 0;
        let contractProdCount = 0;
        let contractHkCount = 0;
        let contractOtherCount = 0;

        const deptActualCounts = {};
        stdDeptNames.forEach(d => { deptActualCounts[d] = 0; });

        const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        let joinersCount = 0;
        let resignedCount = 0;

        employees.forEach(emp => {
            const workerType = (emp.workerType || '').toUpperCase();
            const employeeType = (emp.employeeType || '').toUpperCase();
            const dept = emp.department || '';

            if (emp.joiningDate && new Date(emp.joiningDate) >= startOfMonth) {
                joinersCount++;
            }
            if (emp.status === 'Resigned' || emp.lastWorkingDate) {
                resignedCount++;
            }

            if (workerType.includes('CONTRACT') || workerType.includes('CONTRACTUAL')) {
                if (dept.toLowerCase().includes('prod')) contractProdCount++;
                else if (dept.toLowerCase().includes('house') || dept.toLowerCase().includes('hk')) contractHkCount++;
                else contractOtherCount++;
            } else if (workerType.includes('PERMANENT')) {
                if (dept.toLowerCase().includes('prod')) permProdCount++;
                else if (dept.toLowerCase().includes('test')) permTestingCount++;
                else permOtherCount++;
            } else {
                if (employeeType.includes('SITE')) staffSiteCount++;
                else staffUsgaonCount++;
            }

            const matchedDept = stdDeptNames.find(d => 
                d.toLowerCase().includes(dept.toLowerCase()) || (dept && d.toLowerCase().includes(dept.toLowerCase()))
            );
            if (matchedDept) {
                deptActualCounts[matchedDept]++;
            }
        });

        const hasRealEmployees = employees.length > 0;
        const actualStaffTotal = staffUsgaonCount + staffSiteCount;
        const actualPermTotal = permProdCount + permTestingCount + permOtherCount;
        const actualContractTotal = contractProdCount + contractHkCount + contractOtherCount;
        const actualTotalManpower = actualStaffTotal + actualPermTotal + actualContractTotal;
        const actualDeptStaffTotal = Object.values(deptActualCounts).reduce((a, b) => a + b, 0);

        const liveStaffActual = hasRealEmployees ? actualStaffTotal : users.length;
        const totalEmployeesCount = hasRealEmployees ? employees.length : users.length;

        const departmentBreakdown = stdDeptNames.map(deptName => {
            const plan = defaultDeptPlans[deptName] || 0;
            const actual = deptActualCounts[deptName] || 0;
            return {
                name: deptName,
                plan: plan,
                actual: hasRealEmployees ? actual : "-",
                monthlyPlan: plan
            };
        });

        const sideMetrics = {
            atrMonthly: { live: 5, closed: 0 },
            attrition: { count: resignedCount, pct: totalEmployeesCount > 0 ? parseFloat(((resignedCount / totalEmployeesCount) * 100).toFixed(1)) : 0 },
            absenteeism: { count: 0, pct: 0 },
            joiner: { count: joinersCount, pct: totalEmployeesCount > 0 ? parseFloat(((joinersCount / totalEmployeesCount) * 100).toFixed(1)) : 0 },
            trainingMonthly: { planned: 2, actual: 0 },
            expenses: { mtd: "-", ytd: "-" },
            lateComerPct: { count: "-", pct: "-" },
            otherIssues: "-"
        };

        const responseData = {
            company: companyName,
            department: "HUMAN RESOURCES",
            date: targetDate.toISOString().split('T')[0],
            staffSummary: [
                { name: "STAFF", plan: 118, actual: hasRealEmployees ? actualStaffTotal : liveStaffActual, monthlyPlan: 118, otYesterday: "-", otMtd: "-", otYtd: "-", isHeader: true },
                { name: "A. Usgaon based", plan: 90, actual: hasRealEmployees ? staffUsgaonCount : liveStaffActual, monthlyPlan: 90, otYesterday: "-", otMtd: "-", otYtd: "-" },
                { name: "B. Site based", plan: 28, actual: hasRealEmployees ? staffSiteCount : "-", monthlyPlan: 28, otYesterday: "-", otMtd: "-", otYtd: "-" }
            ],
            permanentWorkerSummary: [
                { name: "PERMANENT WORKER", plan: 88, actual: hasRealEmployees ? actualPermTotal : 0, monthlyPlan: 88, otYesterday: 0, otMtd: 0, otYtd: 0, isHeader: true },
                { name: "A. Production", plan: 78, actual: hasRealEmployees ? permProdCount : "-", monthlyPlan: 78, otYesterday: "-", otMtd: "-", otYtd: "-" },
                { name: "B. Testing", plan: 3, actual: hasRealEmployees ? permTestingCount : "-", monthlyPlan: 3, otYesterday: "-", otMtd: "-", otYtd: "-" },
                { name: "C. Others", plan: 7, actual: hasRealEmployees ? permOtherCount : "-", monthlyPlan: 7, otYesterday: "-", otMtd: "-", otYtd: "-" }
            ],
            contractualWorkerSummary: [
                { name: "CONTRACTUAL WORKER", plan: 15, actual: hasRealEmployees ? actualContractTotal : 15, monthlyPlan: 15, otYesterday: 0, otMtd: 0, otYtd: 0, isHeader: true },
                { name: "A. Production", plan: "-", actual: hasRealEmployees ? contractProdCount : "-", monthlyPlan: "-", otYesterday: "-", otMtd: "-", otYtd: "-" },
                { name: "B. House-Keeping", plan: 15, actual: hasRealEmployees ? contractHkCount : 15, monthlyPlan: 15, otYesterday: "-", otMtd: "-", otYtd: "-" },
                { name: "C. Others", plan: "-", actual: hasRealEmployees ? contractOtherCount : "-", monthlyPlan: "-", otYesterday: "-", otMtd: "-", otYtd: "-" }
            ],
            totalManpower: {
                name: "TOTAL MANPOWER",
                plan: 221,
                actual: hasRealEmployees ? actualTotalManpower : (liveStaffActual + 15),
                monthlyPlan: 221,
                otYesterday: 0,
                otMtd: 0,
                otYtd: 0
            },
            departmentBreakdown,
            totalDeptStaff: {
                name: "TOTAL DEPARTMENT STAFF",
                plan: 118,
                actual: hasRealEmployees ? actualDeptStaffTotal : liveStaffActual,
                monthlyPlan: 118,
                otYesterday: 0,
                otMtd: 0,
                otYtd: 0
            },
            sideMetrics
        };

        res.json(responseData);
    } catch (err) {
        console.error('[Analytics Error] getDailyReport:', err);
        res.status(500).json({ message: err.message });
    }
};
