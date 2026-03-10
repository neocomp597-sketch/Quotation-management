const MGR = require('../models/MGR');

// Get all MGRs
exports.getAllMGRs = async (req, res) => {
    try {
        const { type } = req.query;
        let query = {};
        if (type) {
            query.mgrType = type;
        }
        const mgrs = await MGR.find(query).sort({ mgrType: 1, createdAt: -1 });
        res.json(mgrs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get MGR by ID
exports.getMGRById = async (req, res) => {
    try {
        const mgr = await MGR.findById(req.params.id);
        if (!mgr) return res.status(404).json({ message: 'MGR not found' });
        res.json(mgr);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Create a new MGR
exports.createMGR = async (req, res) => {
    const mgr = new MGR(req.body);
    try {
        const newMGR = await mgr.save();
        res.status(201).json(newMGR);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'MGR code already exists for this type' });
        }
        res.status(400).json({ message: err.message });
    }
};

// Update an existing MGR
exports.updateMGR = async (req, res) => {
    try {
        const updatedMGR = await MGR.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedMGR) return res.status(404).json({ message: 'MGR not found' });
        res.json(updatedMGR);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'MGR code already exists for this type' });
        }
        res.status(400).json({ message: err.message });
    }
};

// Delete an MGR
exports.deleteMGR = async (req, res) => {
    try {
        const deletedMGR = await MGR.findByIdAndDelete(req.params.id);
        if (!deletedMGR) return res.status(404).json({ message: 'MGR not found' });
        res.json({ message: 'MGR deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
