const Status = require('../models/Status');

exports.getStatuses = async (req, res) => {
    try {
        const statuses = await Status.find().sort({ name: 1 });
        res.json(statuses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createStatus = async (req, res) => {
    try {
        const { name, color } = req.body;
        const status = new Status({
            name,
            color,
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
