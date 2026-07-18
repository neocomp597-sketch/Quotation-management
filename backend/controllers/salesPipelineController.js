const SalesPipeline = require('../models/SalesPipeline');

// GET /api/sales/pipelines
exports.getAllPipelines = async (req, res) => {
    try {
        const pipelines = await SalesPipeline.find({ isActive: true })
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();
        res.json(pipelines);
    } catch (err) {
        console.error('[Sales Pipeline] getAllPipelines error:', err);
        res.status(500).json({ message: err.message });
    }
};

// GET /api/sales/pipelines/:id
exports.getPipelineById = async (req, res) => {
    try {
        const pipeline = await SalesPipeline.findById(req.params.id).lean();
        if (!pipeline) return res.status(404).json({ message: 'Pipeline not found' });
        res.json(pipeline);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/sales/pipelines
exports.createPipeline = async (req, res) => {
    try {
        const { name, description, stages, isDefault } = req.body;

        if (!name || !stages || stages.length === 0) {
            return res.status(400).json({ message: 'Name and at least one stage are required' });
        }

        // If setting as default, unset other defaults
        if (isDefault) {
            await SalesPipeline.updateMany({}, { isDefault: false });
        }

        const pipeline = await SalesPipeline.create({
            name,
            description: description || '',
            stages: stages.map((s, i) => ({
                name: s.name,
                probability: s.probability || 0,
                color: s.color || '#3b82f6',
                sortOrder: s.sortOrder !== undefined ? s.sortOrder : i + 1
            })),
            isDefault: isDefault || false,
            createdBy: req.user.id
        });

        res.status(201).json(pipeline);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'A pipeline with this name already exists' });
        }
        console.error('[Sales Pipeline] createPipeline error:', err);
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/sales/pipelines/:id
exports.updatePipeline = async (req, res) => {
    try {
        const { name, description, stages, isDefault, isActive } = req.body;

        if (isDefault) {
            await SalesPipeline.updateMany({ _id: { $ne: req.params.id } }, { isDefault: false });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (stages !== undefined) {
            updateData.stages = stages.map((s, i) => ({
                name: s.name,
                probability: s.probability || 0,
                color: s.color || '#3b82f6',
                sortOrder: s.sortOrder !== undefined ? s.sortOrder : i + 1
            }));
        }
        if (isDefault !== undefined) updateData.isDefault = isDefault;
        if (isActive !== undefined) updateData.isActive = isActive;

        const pipeline = await SalesPipeline.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!pipeline) return res.status(404).json({ message: 'Pipeline not found' });
        res.json(pipeline);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'A pipeline with this name already exists' });
        }
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/sales/pipelines/:id
exports.deletePipeline = async (req, res) => {
    try {
        const Deal = require('../models/Deal');
        const dealCount = await Deal.countDocuments({ pipelineId: req.params.id });
        if (dealCount > 0) {
            return res.status(400).json({
                message: `Cannot delete pipeline — ${dealCount} deal(s) are using it. Move deals first.`
            });
        }

        const pipeline = await SalesPipeline.findByIdAndDelete(req.params.id);
        if (!pipeline) return res.status(404).json({ message: 'Pipeline not found' });
        res.json({ message: 'Pipeline deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/sales/pipelines/seed-defaults
exports.seedDefaults = async (req, res) => {
    try {
        const existing = await SalesPipeline.countDocuments();
        if (existing > 0) {
            return res.json({ message: 'Pipelines already exist', seeded: 0 });
        }

        const defaults = [
            {
                name: 'Default Sales Pipeline',
                description: 'Standard CRM sales lifecycle',
                isDefault: true,
                stages: [
                    { name: 'Lead', probability: 10, color: '#94a3b8', sortOrder: 1 },
                    { name: 'Qualified', probability: 25, color: '#3b82f6', sortOrder: 2 },
                    { name: 'Contact Made', probability: 40, color: '#8b5cf6', sortOrder: 3 },
                    { name: 'Proposal Sent', probability: 60, color: '#f59e0b', sortOrder: 4 },
                    { name: 'Negotiation', probability: 80, color: '#f97316', sortOrder: 5 },
                    { name: 'Verbal Commitment', probability: 90, color: '#10b981', sortOrder: 6 },
                    { name: 'Won', probability: 100, color: '#22c55e', sortOrder: 7 }
                ],
                createdBy: req.user.id
            }
        ];

        await SalesPipeline.insertMany(defaults);
        res.status(201).json({ message: 'Default pipelines seeded', seeded: defaults.length });
    } catch (err) {
        console.error('[Sales Pipeline] seedDefaults error:', err);
        res.status(500).json({ message: err.message });
    }
};
