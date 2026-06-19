const SalesTarget = require('../models/SalesTarget');

// GET /api/sales/targets
exports.getAllTargets = async (req, res) => {
    try {
        const { userId, period, periodLabel } = req.query;
        const filter = {};
        if (userId) filter.userId = userId;
        if (period) filter.period = period;
        if (periodLabel) filter.periodLabel = periodLabel;

        const targets = await SalesTarget.find(filter)
            .populate('userId', 'name email')
            .sort({ periodLabel: -1 })
            .lean();

        // Calculate achievement percentages
        const enriched = targets.map(t => ({
            ...t,
            achievementPercent: t.targetAmount > 0
                ? Math.round((t.achievedAmount / t.targetAmount) * 100)
                : 0
        }));

        res.json(enriched);
    } catch (err) {
        console.error('[Sales Targets] getAllTargets error:', err);
        res.status(500).json({ message: err.message });
    }
};

// POST /api/sales/targets
exports.createTarget = async (req, res) => {
    try {
        const { userId, period, periodLabel, targetAmount } = req.body;

        if (!userId || !period || !periodLabel || targetAmount === undefined) {
            return res.status(400).json({ message: 'userId, period, periodLabel, and targetAmount are required' });
        }

        const target = await SalesTarget.create({
            userId,
            period,
            periodLabel,
            targetAmount,
            achievedAmount: 0,
            createdBy: req.user.id
        });

        const populated = await SalesTarget.findById(target._id)
            .populate('userId', 'name email')
            .lean();

        res.status(201).json(populated);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Target already exists for this user and period' });
        }
        console.error('[Sales Targets] createTarget error:', err);
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/sales/targets/:id
exports.updateTarget = async (req, res) => {
    try {
        const { targetAmount, achievedAmount } = req.body;
        const updateData = {};
        if (targetAmount !== undefined) updateData.targetAmount = targetAmount;
        if (achievedAmount !== undefined) updateData.achievedAmount = achievedAmount;

        const target = await SalesTarget.findByIdAndUpdate(req.params.id, updateData, { new: true })
            .populate('userId', 'name email')
            .lean();

        if (!target) return res.status(404).json({ message: 'Target not found' });
        res.json(target);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/sales/targets/:id
exports.deleteTarget = async (req, res) => {
    try {
        const target = await SalesTarget.findByIdAndDelete(req.params.id);
        if (!target) return res.status(404).json({ message: 'Target not found' });
        res.json({ message: 'Target deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/sales/targets/bulk — Bulk set targets for multiple users
exports.bulkCreateTargets = async (req, res) => {
    try {
        const { targets } = req.body; // [{ userId, period, periodLabel, targetAmount }]
        if (!targets || !Array.isArray(targets) || targets.length === 0) {
            return res.status(400).json({ message: 'targets array is required' });
        }

        const results = [];
        for (const t of targets) {
            try {
                const target = await SalesTarget.findOneAndUpdate(
                    { userId: t.userId, period: t.period, periodLabel: t.periodLabel },
                    {
                        targetAmount: t.targetAmount,
                        createdBy: req.user.id,
                        $setOnInsert: { achievedAmount: 0 }
                    },
                    { upsert: true, new: true }
                );
                results.push(target);
            } catch (e) {
                results.push({ error: e.message, userId: t.userId });
            }
        }

        res.json({ message: `Processed ${results.length} targets`, results });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
