const Deal = require('../models/Deal');
const DealActivity = require('../models/DealActivity');
const SalesPipeline = require('../models/SalesPipeline');
const SalesTarget = require('../models/SalesTarget');
const DealSource = require('../models/DealSource');
const mongoose = require('mongoose');

// GET /api/sales/deals
exports.getAllDeals = async (req, res) => {
    try {
        const { pipelineId, stageId, ownerId, status, forecastCategory, source, search, page = 1, limit = 50 } = req.query;

        const filter = {};
        if (pipelineId) filter.pipelineId = pipelineId;
        if (stageId) filter.stageId = stageId;
        if (ownerId) filter.ownerId = ownerId;
        if (status) filter.status = status;
        if (forecastCategory) filter.forecastCategory = forecastCategory;
        if (source) filter.source = source;
        if (search) {
            filter.title = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [deals, total] = await Promise.all([
            Deal.find(filter)
                .populate('customerId', 'customerName companyName')
                .populate('contactId', 'name company')
                .populate('ownerId', 'name email')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Deal.countDocuments(filter)
        ]);

        res.json({ deals, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        console.error('[Deals] getAllDeals error:', err);
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/deals/board/:pipelineId
exports.getDealBoard = async (req, res) => {
    try {
        const { pipelineId } = req.params;
        const { ownerId, forecastCategory } = req.query;

        const pipeline = await SalesPipeline.findById(pipelineId).lean();
        if (!pipeline) return res.status(404).json({ message: 'Pipeline not found' });

        const filter = { pipelineId, status: 'Open' };
        if (ownerId) filter.ownerId = ownerId;
        if (forecastCategory) filter.forecastCategory = forecastCategory;

        const deals = await Deal.find(filter)
            .populate('customerId', 'customerName companyName')
            .populate('ownerId', 'name')
            .sort({ updatedAt: -1 })
            .lean();

        // Group deals by stageId
        const stages = pipeline.stages
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(stage => ({
                ...stage,
                deals: deals.filter(d => d.stageId === stage._id.toString()),
                totalValue: deals
                    .filter(d => d.stageId === stage._id.toString())
                    .reduce((sum, d) => sum + (d.value || 0), 0),
                count: deals.filter(d => d.stageId === stage._id.toString()).length
            }));

        res.json({ pipeline, stages });
    } catch (err) {
        console.error('[Deals] getDealBoard error:', err);
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/deals/:id
exports.getDealById = async (req, res) => {
    try {
        const deal = await Deal.findById(req.params.id)
            .populate('customerId', 'customerName companyName mobile email')
            .populate('contactId', 'name company email phone')
            .populate('ownerId', 'name email')
            .populate('pipelineId', 'name stages')
            .lean();

        if (!deal) return res.status(404).json({ message: 'Deal not found' });

        const activities = await DealActivity.find({ dealId: deal._id })
            .populate('performedBy', 'name')
            .sort({ activityDate: -1 })
            .limit(50)
            .lean();

        res.json({ ...deal, activities });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/sales/deals
exports.createDeal = async (req, res) => {
    try {
        const {
            title, customerId, contactId, pipelineId, stageId,
            value, expectedCloseDate, forecastCategory, source, tags, notes
        } = req.body;

        if (!title || !pipelineId || !stageId) {
            return res.status(400).json({ message: 'Title, pipeline, and stage are required' });
        }

        // Get probability from stage config
        const pipeline = await SalesPipeline.findById(pipelineId).lean();
        if (!pipeline) return res.status(400).json({ message: 'Pipeline not found' });

        const stage = pipeline.stages.find(s => s._id.toString() === stageId);
        if (!stage) return res.status(400).json({ message: 'Stage not found in pipeline' });

        const probability = stage.probability;
        const dealValue = value || 0;

        const deal = await Deal.create({
            title,
            customerId: customerId || undefined,
            contactId: contactId || undefined,
            ownerId: req.user.id,
            pipelineId,
            stageId,
            value: dealValue,
            probability,
            weightedValue: Math.round((dealValue * probability) / 100),
            expectedCloseDate: expectedCloseDate || undefined,
            forecastCategory: forecastCategory || 'Pipeline',
            source: source || 'Other',
            tags: tags || [],
            notes: notes || '',
            createdBy: req.user.id
        });

        // Log creation activity
        await DealActivity.create({
            dealId: deal._id,
            type: 'Note',
            description: `Deal created in stage "${stage.name}"`,
            performedBy: req.user.id
        });

        res.status(201).json(deal);
    } catch (err) {
        console.error('[Deals] createDeal error:', err);
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/sales/deals/:id
exports.updateDeal = async (req, res) => {
    try {
        const {
            title, customerId, contactId, ownerId, pipelineId, stageId,
            value, expectedCloseDate, forecastCategory, source, tags, notes
        } = req.body;

        const deal = await Deal.findById(req.params.id);
        if (!deal) return res.status(404).json({ message: 'Deal not found' });

        // If stage is changing, update probability from pipeline config
        let probability = deal.probability;
        if (stageId && stageId !== deal.stageId) {
            const pipeline = await SalesPipeline.findById(pipelineId || deal.pipelineId).lean();
            if (pipeline) {
                const stage = pipeline.stages.find(s => s._id.toString() === stageId);
                if (stage) probability = stage.probability;
            }
        }

        if (title !== undefined) deal.title = title;
        if (customerId !== undefined) deal.customerId = customerId || undefined;
        if (contactId !== undefined) deal.contactId = contactId || undefined;
        if (ownerId !== undefined) deal.ownerId = ownerId;
        if (pipelineId !== undefined) deal.pipelineId = pipelineId;
        if (stageId !== undefined) deal.stageId = stageId;
        if (value !== undefined) deal.value = value;
        deal.probability = probability;
        if (expectedCloseDate !== undefined) deal.expectedCloseDate = expectedCloseDate;
        if (forecastCategory !== undefined) deal.forecastCategory = forecastCategory;
        if (source !== undefined) deal.source = source;
        if (tags !== undefined) deal.tags = tags;
        if (notes !== undefined) deal.notes = notes;

        await deal.save();

        const populated = await Deal.findById(deal._id)
            .populate('customerId', 'customerName companyName')
            .populate('ownerId', 'name email')
            .lean();

        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /api/sales/deals/:id/stage — Drag-and-drop stage change
exports.updateDealStage = async (req, res) => {
    try {
        const { stageId } = req.body;
        if (!stageId) return res.status(400).json({ message: 'stageId is required' });

        const deal = await Deal.findById(req.params.id);
        if (!deal) return res.status(404).json({ message: 'Deal not found' });

        const pipeline = await SalesPipeline.findById(deal.pipelineId).lean();
        if (!pipeline) return res.status(400).json({ message: 'Pipeline not found' });

        const oldStage = pipeline.stages.find(s => s._id.toString() === deal.stageId);
        const newStage = pipeline.stages.find(s => s._id.toString() === stageId);
        if (!newStage) return res.status(400).json({ message: 'Stage not found in pipeline' });

        deal.stageId = stageId;
        deal.probability = newStage.probability;

        // Auto-set Won/Lost status based on stage probability
        if (newStage.probability === 100 && newStage.name.toLowerCase() === 'won') {
            deal.status = 'Won';
            deal.forecastCategory = 'Closed';
            deal.wonDate = new Date();

            // Update sales targets
            await updateTargetAchievement(deal.ownerId, deal.value, deal.companyId);
        }

        await deal.save();

        // Log stage change
        await DealActivity.create({
            dealId: deal._id,
            type: 'Note',
            description: `Stage changed from "${oldStage?.name || 'Unknown'}" to "${newStage.name}"`,
            performedBy: req.user.id
        });

        res.json(deal);
    } catch (err) {
        console.error('[Deals] updateDealStage error:', err);
        res.status(500).json({ message: err.message });
    }
};

// PATCH /api/sales/deals/:id/lost
exports.markDealLost = async (req, res) => {
    try {
        const { lostReason } = req.body;

        const deal = await Deal.findById(req.params.id);
        if (!deal) return res.status(404).json({ message: 'Deal not found' });

        deal.status = 'Lost';
        deal.lostReason = lostReason || 'Other';
        deal.lostDate = new Date();
        deal.forecastCategory = 'Omitted';
        deal.probability = 0;
        await deal.save();

        await DealActivity.create({
            dealId: deal._id,
            type: 'Note',
            description: `Deal marked as Lost. Reason: ${lostReason || 'Other'}`,
            performedBy: req.user.id
        });

        res.json(deal);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /api/sales/deals/:id/reopen
exports.reopenDeal = async (req, res) => {
    try {
        const deal = await Deal.findById(req.params.id);
        if (!deal) return res.status(404).json({ message: 'Deal not found' });

        const pipeline = await SalesPipeline.findById(deal.pipelineId).lean();
        const stage = pipeline?.stages?.find(s => s._id.toString() === deal.stageId);

        deal.status = 'Open';
        deal.lostReason = '';
        deal.lostDate = undefined;
        deal.wonDate = undefined;
        deal.forecastCategory = 'Pipeline';
        deal.probability = stage?.probability || 10;
        await deal.save();

        await DealActivity.create({
            dealId: deal._id,
            type: 'Note',
            description: 'Deal reopened',
            performedBy: req.user.id
        });

        res.json(deal);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/sales/deals/:id
exports.deleteDeal = async (req, res) => {
    try {
        const deal = await Deal.findByIdAndDelete(req.params.id);
        if (!deal) return res.status(404).json({ message: 'Deal not found' });

        await DealActivity.deleteMany({ dealId: req.params.id });
        res.json({ message: 'Deal deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/sales/deals/:id/activity
exports.addActivity = async (req, res) => {
    try {
        const { type, description, activityDate } = req.body;
        if (!type || !description) {
            return res.status(400).json({ message: 'Type and description are required' });
        }

        const deal = await Deal.findById(req.params.id);
        if (!deal) return res.status(404).json({ message: 'Deal not found' });

        const activity = await DealActivity.create({
            dealId: deal._id,
            type,
            description,
            activityDate: activityDate || new Date(),
            performedBy: req.user.id
        });

        const populated = await DealActivity.findById(activity._id)
            .populate('performedBy', 'name')
            .lean();

        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/deals/:id/activities
exports.getDealActivities = async (req, res) => {
    try {
        const activities = await DealActivity.find({ dealId: req.params.id })
            .populate('performedBy', 'name')
            .sort({ activityDate: -1 })
            .lean();
        res.json(activities);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Helper: Update target achievement when deal is won
async function updateTargetAchievement(userId, dealValue, companyId) {
    try {
        const now = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${monthNames[now.getMonth()]}-${now.getFullYear()}`;

        // Update monthly target
        await SalesTarget.findOneAndUpdate(
            { userId, period: 'monthly', periodLabel: monthLabel },
            { $inc: { achievedAmount: dealValue } }
        );

        // Update quarterly target
        const quarter = Math.ceil((now.getMonth() + 1) / 3);
        const quarterLabel = `Q${quarter}-${now.getFullYear()}`;
        await SalesTarget.findOneAndUpdate(
            { userId, period: 'quarterly', periodLabel: quarterLabel },
            { $inc: { achievedAmount: dealValue } }
        );

        // Update yearly target
        const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const yearLabel = `${fyStart}-${(fyStart + 1).toString().slice(-2)}`;
        await SalesTarget.findOneAndUpdate(
            { userId, period: 'yearly', periodLabel: yearLabel },
            { $inc: { achievedAmount: dealValue } }
        );
    } catch (err) {
        console.error('[Deals] updateTargetAchievement error:', err);
    }
}

// ─── DEAL SOURCES ────────────────────────────────────────────────────────────

exports.getSources = async (req, res) => {
    try {
        let sources = await DealSource.find({ isActive: true }).sort({ name: 1 }).lean();
        if (sources.length === 0) {
            const defaults = [
                { name: 'Website' },
                { name: 'Referral' },
                { name: 'Email Campaign' },
                { name: 'Cold Call' },
                { name: 'Social Media' },
                { name: 'Trade Show' },
                { name: 'Partner' },
                { name: 'Other' }
            ];
            await DealSource.insertMany(defaults);
            sources = await DealSource.find({ isActive: true }).sort({ name: 1 }).lean();
        }
        res.json(sources);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load deal sources', error: error.message });
    }
};

exports.createSource = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Source name is required' });
        }
        const existing = await DealSource.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } }).lean();
        if (existing) {
            return res.status(400).json({ message: 'Source already exists' });
        }
        const source = await DealSource.create({ name: name.trim() });
        res.status(201).json(source);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create deal source', error: error.message });
    }
};

exports.deleteSource = async (req, res) => {
    try {
        const { id } = req.params;
        const source = await DealSource.findById(id);
        if (!source) {
            return res.status(404).json({ message: 'Source not found' });
        }
        await DealSource.findByIdAndDelete(id);
        res.json({ message: 'Source deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete source', error: error.message });
    }
};

