const Tender = require('../models/Tender');
const Counter = require('../models/Counter');
const mongoose = require('mongoose');

// Auto-generate tender number
const generateTenderNumber = async (companyId) => {
    const year = new Date().getFullYear();
    const prefix = 'TND';
    
    const counter = await Counter.findOneAndUpdate(
        { type: 'tender', companyId: companyId || null, prefix, year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const seqStr = counter.seq.toString().padStart(4, '0');
    return `${prefix}/${year}/${seqStr}`;
};

// Create Tender
exports.createTender = async (req, res) => {
    try {
        const { companyId } = req.user || {};
        
        // Auto-generate tender number if empty
        if (!req.body.tenderNo || String(req.body.tenderNo).trim() === '') {
            req.body.tenderNo = await generateTenderNumber(companyId);
        }

        const exists = await Tender.findOne({ tenderNo: req.body.tenderNo });
        if (exists) {
            return res.status(400).json({ message: `Tender number "${req.body.tenderNo}" already exists.` });
        }

        const newTender = new Tender({
            ...req.body,
            companyId,
            ownerId: req.body.ownerId || req.user?.id,
            activities: [{
                userId: req.user?.id,
                userName: req.user?.name || 'System',
                action: 'Tender created'
            }]
        });

        await newTender.save();
        res.status(201).json(newTender);
    } catch (err) {
        console.error('[Tender Create Error]', err);
        res.status(400).json({ message: err.message });
    }
};

// Get All Tenders
exports.getAllTenders = async (req, res) => {
    try {
        const { search, status, customerId, ownerId, departmentId, startDate, endDate } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { tenderNo: { $regex: search, $options: 'i' } }
            ];
        }

        if (status) {
            query.status = status;
        }

        if (customerId) {
            query.customerId = customerId;
        }

        if (ownerId) {
            query.ownerId = ownerId;
        }

        if (departmentId) {
            query.departmentId = departmentId;
        }

        if (startDate || endDate) {
            query.deadlineDate = {};
            if (startDate) {
                query.deadlineDate.$gte = new Date(startDate);
            }
            if (endDate) {
                query.deadlineDate.$lte = new Date(endDate);
            }
        }

        const tenders = await Tender.find(query)
            .populate('customerId', 'customerName companyName gstin')
            .populate('ownerId', 'name email')
            .populate('departmentId', 'name description')
            .sort({ createdAt: -1 })
            .lean();

        res.json(tenders);
    } catch (err) {
        console.error('[Tender Fetch Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// Get Single Tender
exports.getTenderById = async (req, res) => {
    try {
        const tender = await Tender.findById(req.params.id)
            .populate('customerId', 'customerName companyName gstin billingAddress mobile email')
            .populate('ownerId', 'name email')
            .populate('departmentId', 'name description')
            .lean();

        if (!tender) return res.status(404).json({ message: 'Tender not found' });
        res.json(tender);
    } catch (err) {
        console.error('[Tender Fetch ID Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// Update Tender
exports.updateTender = async (req, res) => {
    try {
        const { id } = req.params;
        const currentTender = await Tender.findById(id);
        if (!currentTender) return res.status(404).json({ message: 'Tender not found' });

        // Build log actions for status and value changes
        let logs = [];
        if (req.body.status && req.body.status !== currentTender.status) {
            logs.push({
                userId: req.user?.id,
                userName: req.user?.name || 'System',
                action: `Status changed from "${currentTender.status}" to "${req.body.status}"`
            });
        }

        if (req.body.value !== undefined && Number(req.body.value) !== currentTender.value) {
            logs.push({
                userId: req.user?.id,
                userName: req.user?.name || 'System',
                action: `Value updated from ₹${currentTender.value.toLocaleString()} to ₹${Number(req.body.value).toLocaleString()}`
            });
        }

        // Add default update action if no status/value changes occurred
        if (logs.length === 0) {
            logs.push({
                userId: req.user?.id,
                userName: req.user?.name || 'System',
                action: 'Tender details updated'
            });
        }

        // Push new logs to existing activities
        req.body.activities = [...(currentTender.activities || []), ...logs];

        const updatedTender = await Tender.findByIdAndUpdate(
            id,
            { ...req.body },
            { new: true, runValidators: true }
        );

        res.json(updatedTender);
    } catch (err) {
        console.error('[Tender Update Error]', err);
        res.status(400).json({ message: err.message });
    }
};

// Delete Tender
exports.deleteTender = async (req, res) => {
    try {
        const result = await Tender.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ message: 'Tender not found' });
        res.json({ message: 'Tender deleted successfully' });
    } catch (err) {
        console.error('[Tender Delete Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// Get Dashboard Data
exports.getTenderDashboard = async (req, res) => {
    try {
        const { companyId } = req.user || {};
        
        // Match conditions: scope to company
        const match = { companyId: new mongoose.Types.ObjectId(companyId) };

        // Fetch all tenders for calculations
        const tenders = await Tender.find({ companyId })
            .populate('customerId', 'companyName customerName')
            .lean();

        // 1. KPI Calculations
        const totalCount = tenders.length;
        const activeCount = tenders.filter(t => t.status === 'Active').length;
        const submittedCount = tenders.filter(t => t.status === 'Submitted').length;
        const wonCount = tenders.filter(t => t.status === 'Won').length;
        const lostCount = tenders.filter(t => t.status === 'Lost').length;
        const pendingCount = tenders.filter(t => t.status === 'Pending Approval').length;
        
        const totalValue = tenders.reduce((sum, t) => sum + (t.value || 0), 0);
        
        const winRate = totalCount > 0 ? ((wonCount / (wonCount + lostCount || 1)) * 100).toFixed(1) : '0.0';

        // Upcoming Deadlines (Active/Submitted in the future, sorted by deadline)
        const now = new Date();
        const upcomingDeadlines = tenders
            .filter(t => ['Active', 'Submitted'].includes(t.status) && new Date(t.deadlineDate) >= now)
            .sort((a, b) => new Date(a.deadlineDate) - new Date(b.deadlineDate))
            .slice(0, 5)
            .map(t => ({
                id: t._id,
                tenderNo: t.tenderNo,
                title: t.title,
                deadlineDate: t.deadlineDate,
                value: t.value
            }));

        // 2. Chart: Tender Status distribution
        const statusDistribution = [
            { name: 'Active', value: activeCount, color: '#3b82f6' },
            { name: 'Submitted', value: submittedCount, color: '#f59e0b' },
            { name: 'Won', value: wonCount, color: '#10b981' },
            { name: 'Lost', value: lostCount, color: '#ef4444' },
            { name: 'Pending Approval', value: pendingCount, color: '#8b5cf6' }
        ].filter(item => item.value > 0);

        // 3. Chart: Monthly Trends (last 6 months trend of tenders added)
        // Group by month
        const monthlyTrendMap = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Prefill last 6 months
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const label = `${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
            monthlyTrendMap[label] = { month: label, count: 0, value: 0, wonValue: 0 };
        }

        tenders.forEach(t => {
            const dt = new Date(t.createdAt || Date.now());
            const label = `${months[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
            if (monthlyTrendMap[label]) {
                monthlyTrendMap[label].count += 1;
                monthlyTrendMap[label].value += t.value || 0;
                if (t.status === 'Won') {
                    monthlyTrendMap[label].wonValue += t.value || 0;
                }
            }
        });
        const monthlyTrend = Object.values(monthlyTrendMap);

        // 4. Chart: Won vs Lost Counts
        const wonVsLost = [
            { name: 'Won', count: wonCount, value: tenders.filter(t => t.status === 'Won').reduce((sum, t) => sum + (t.value || 0), 0) },
            { name: 'Lost', count: lostCount, value: tenders.filter(t => t.status === 'Lost').reduce((sum, t) => sum + (t.value || 0), 0) }
        ];

        // 5. Chart: Top Clients by Tender Value
        const clientValueMap = {};
        tenders.forEach(t => {
            const clientName = t.customerId?.companyName || t.customerId?.customerName || 'Unknown Client';
            if (!clientValueMap[clientName]) {
                clientValueMap[clientName] = 0;
            }
            clientValueMap[clientName] += t.value || 0;
        });

        const topClients = Object.entries(clientValueMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        res.json({
            kpis: {
                totalCount,
                activeCount,
                submittedCount,
                wonCount,
                lostCount,
                pendingCount,
                totalValue,
                winRate: parseFloat(winRate),
                upcomingCount: upcomingDeadlines.length
            },
            upcomingDeadlines,
            charts: {
                statusDistribution,
                monthlyTrend,
                wonVsLost,
                topClients
            }
        });
    } catch (err) {
        console.error('[Tender Dashboard Aggregation Error]', err);
        res.status(500).json({ message: err.message });
    }
};
