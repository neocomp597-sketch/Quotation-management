const CSMRcaReport = require('../models/CSMRcaReport');

exports.getReports = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = companyId ? { companyId } : {};
        const reports = await CSMRcaReport.find(filter)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(reports);
    } catch (error) {
        console.error('Error fetching RCA reports:', error);
        res.status(500).json({ message: 'Failed to fetch RCA reports' });
    }
};

exports.getReportById = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = { _id: req.params.id };
        if (companyId) filter.companyId = companyId;

        const report = await CSMRcaReport.findOne(filter)
            .populate('createdBy', 'name email');
        if (!report) {
            return res.status(404).json({ message: 'RCA report not found' });
        }
        res.json(report);
    } catch (error) {
        console.error('Error fetching RCA report:', error);
        res.status(500).json({ message: 'Failed to fetch RCA report' });
    }
};

exports.createReport = async (req, res) => {
    try {
        const companyId = req.user?.companyId || null;
        
        // Auto-generate RCA Number if not provided
        let rcaNumber = req.body.rcaNumber;
        if (!rcaNumber) {
            const count = await CSMRcaReport.countDocuments(companyId ? { companyId } : {});
            rcaNumber = `RCA-2026-${String(count + 1).padStart(3, '0')}`;
        }

        const report = new CSMRcaReport({
            ...req.body,
            rcaNumber,
            companyId,
            createdBy: req.user?._id
        });

        await report.save();
        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating RCA report:', error);
        res.status(500).json({ message: error.message || 'Failed to create RCA report' });
    }
};

exports.updateReport = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = { _id: req.params.id };
        if (companyId) filter.companyId = companyId;

        const report = await CSMRcaReport.findOneAndUpdate(
            filter,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!report) {
            return res.status(404).json({ message: 'RCA report not found' });
        }

        res.json(report);
    } catch (error) {
        console.error('Error updating RCA report:', error);
        res.status(500).json({ message: error.message || 'Failed to update RCA report' });
    }
};

exports.deleteReport = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = { _id: req.params.id };
        if (companyId) filter.companyId = companyId;

        const report = await CSMRcaReport.findOneAndDelete(filter);
        if (!report) {
            return res.status(404).json({ message: 'RCA report not found' });
        }
        res.json({ message: 'RCA report deleted successfully' });
    } catch (error) {
        console.error('Error deleting RCA report:', error);
        res.status(500).json({ message: 'Failed to delete RCA report' });
    }
};
