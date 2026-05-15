const Status = require('../models/Status');

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
};

exports.getStatuses = async (req, res) => {
    try {
        if (req.query.page || req.query.limit) {
            const { page, limit, skip } = getPagination(req.query);
            const [statuses, total] = await Promise.all([
                Status.find()
                    .select('name color isActive createdAt updatedAt')
                    .sort({ name: 1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Status.countDocuments()
            ]);

            return res.json({
                data: statuses,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit) || 1
                }
            });
        }

        const statuses = await Status.find()
            .select('name color isActive createdAt updatedAt')
            .sort({ name: 1 })
            .lean();
        res.json(statuses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createStatus = async (req, res) => {
    try {
        const { name, color, isActive } = req.body;
        const status = new Status({
            name,
            color,
            isActive: isActive !== undefined ? isActive : true,
            createdBy: req.user._id
        });
        await status.save();
        res.status(201).json(status);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { name, color, isActive } = req.body;
        const status = await Status.findByIdAndUpdate(
            req.params.id,
            { name, color, isActive },
            { new: true }
        );
        if (!status) return res.status(404).json({ message: 'Status not found' });
        res.json(status);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteStatus = async (req, res) => {
    try {
        const status = await Status.findByIdAndDelete(req.params.id);
        if (!status) return res.status(404).json({ message: 'Status not found' });
        res.json({ message: 'Status deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
