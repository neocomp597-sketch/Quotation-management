const express = require('express');
const router = express.Router();
const Deal = require('../../../models/Deal');
const SalesPipeline = require('../../../models/SalesPipeline');
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated, sendError } = require('../../../utils/apiResponse');

// GET /api/v1/deals - List deals
router.get('/', requireApiScope('deals.read'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId: req.apiClient.companyId };

        if (req.query.search) {
            filter.title = new RegExp(req.query.search.trim(), 'i');
        }

        if (req.query.status) {
            filter.status = req.query.status;
        }

        const [deals, total] = await Promise.all([
            Deal.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Deal.countDocuments(filter)
        ]);

        const formatted = deals.map(d => ({
            id: d._id,
            title: d.title,
            value: d.value || 0,
            probability: d.probability || 0,
            weightedValue: d.weightedValue || 0,
            status: d.status || 'Open',
            forecastCategory: d.forecastCategory || 'Pipeline',
            source: d.source || 'Other',
            expectedCloseDate: d.expectedCloseDate,
            createdAt: d.createdAt
        }));

        return sendPaginated(res, formatted, page, limit, total);
    } catch (error) {
        console.error('[PublicAPI] Error fetching deals:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve deals', 500);
    }
});

// GET /api/v1/deals/:id - Get single deal
router.get('/:id', requireApiScope('deals.read'), async (req, res) => {
    try {
        const deal = await Deal.findOne({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        }).lean();

        if (!deal) {
            return sendError(res, 'resource_not_found', 'Deal was not found', 404);
        }

        const formatted = {
            id: deal._id,
            title: deal.title,
            value: deal.value || 0,
            probability: deal.probability || 0,
            weightedValue: deal.weightedValue || 0,
            status: deal.status || 'Open',
            forecastCategory: deal.forecastCategory || 'Pipeline',
            source: deal.source || 'Other',
            expectedCloseDate: deal.expectedCloseDate,
            createdAt: deal.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error fetching deal by ID:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve deal', 500);
    }
});

// POST /api/v1/deals - Create deal
router.post('/', requireApiScope('deals.write'), async (req, res) => {
    try {
        const { title, value, probability, expectedCloseDate, source, forecastCategory } = req.body;

        if (!title) {
            return sendError(res, 'validation_error', 'title is a required field', 400);
        }

        // Find or fallback pipeline
        let pipeline = await SalesPipeline.findOne({ companyId: req.apiClient.companyId });
        if (!pipeline) {
            pipeline = await SalesPipeline.findOne();
        }

        const defaultStageId = pipeline && pipeline.stages && pipeline.stages[0] ? pipeline.stages[0]._id.toString() : 'stage_1';

        const dealVal = parseFloat(value) || 0;
        const prob = Math.min(100, Math.max(0, parseInt(probability) || 50));
        const weighted = (dealVal * prob) / 100;

        const newDeal = new Deal({
            title: title.trim(),
            value: dealVal,
            probability: prob,
            weightedValue: weighted,
            expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
            source: source || 'API Integration',
            forecastCategory: forecastCategory || 'Pipeline',
            pipelineId: pipeline ? pipeline._id : req.apiClient.companyId,
            stageId: defaultStageId,
            ownerId: req.apiClient.userId,
            companyId: req.apiClient.companyId
        });

        await newDeal.save();

        const formatted = {
            id: newDeal._id,
            title: newDeal.title,
            value: newDeal.value,
            probability: newDeal.probability,
            weightedValue: newDeal.weightedValue,
            status: newDeal.status,
            createdAt: newDeal.createdAt
        };

        return sendSuccess(res, formatted, 201);
    } catch (error) {
        console.error('[PublicAPI] Error creating deal:', error);
        return sendError(res, 'internal_error', 'Failed to create deal', 500);
    }
});

// PATCH /api/v1/deals/:id - Update deal
router.patch('/:id', requireApiScope('deals.write'), async (req, res) => {
    try {
        const allowedFields = ['title', 'value', 'probability', 'expectedCloseDate', 'source', 'forecastCategory', 'status', 'lostReason'];
        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return sendError(res, 'validation_error', 'No valid fields provided for update', 400);
        }

        if (updates.value !== undefined || updates.probability !== undefined) {
            const currentDeal = await Deal.findOne({ _id: req.params.id, companyId: req.apiClient.companyId });
            if (currentDeal) {
                const val = updates.value !== undefined ? parseFloat(updates.value) : currentDeal.value;
                const prob = updates.probability !== undefined ? parseInt(updates.probability) : currentDeal.probability;
                updates.weightedValue = (val * prob) / 100;
            }
        }

        const updated = await Deal.findOneAndUpdate(
            { _id: req.params.id, companyId: req.apiClient.companyId },
            { $set: updates },
            { new: true, runValidators: true }
        ).lean();

        if (!updated) {
            return sendError(res, 'resource_not_found', 'Deal was not found', 404);
        }

        const formatted = {
            id: updated._id,
            title: updated.title,
            value: updated.value,
            probability: updated.probability,
            weightedValue: updated.weightedValue,
            status: updated.status,
            createdAt: updated.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error updating deal:', error);
        return sendError(res, 'internal_error', 'Failed to update deal', 500);
    }
});

module.exports = router;
