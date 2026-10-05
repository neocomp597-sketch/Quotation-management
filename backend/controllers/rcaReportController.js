const CSMRcaReport = require('../models/CSMRcaReport');
const Ticket = require('../models/Ticket');
const { buildRcaSheetWorkbook } = require('../services/rcaSheetExcel');
const { scopedBranchCondition } = require('../utils/branchScope');

// CSMRcaReport is not run through tenantPlugin, so the active branch is applied here.
const withBranchScope = (filter) => {
    const branchCondition = scopedBranchCondition();
    return branchCondition ? { ...filter, ...branchCondition } : filter;
};

/** The branch an RCA report belongs to: its ticket's branch, else the active branch. */
const resolveReportBranch = async (ticketNo, companyId, req) => {
    if (ticketNo) {
        const ticketFilter = { ticketNo: String(ticketNo).trim() };
        if (companyId) ticketFilter.companyId = companyId;
        const ticket = await Ticket.findOne(ticketFilter).select('branchId').setOptions({ bypassBranch: true }).lean();
        if (ticket?.branchId) return ticket.branchId;
    }
    return req.user?.activeBranchId || null;
};

exports.getReports = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = withBranchScope(companyId ? { companyId } : {});
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

        const report = await CSMRcaReport.findOne(withBranchScope(filter))
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
            branchId: req.body.branchId || await resolveReportBranch(req.body.ticketNo, companyId, req),
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

/** The report as the Why-Why Analysis Sheet in Excel, laid out like the printed sheet. */
exports.exportReportSheet = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const filter = { _id: req.params.id };
        if (companyId) filter.companyId = companyId;

        const report = await CSMRcaReport.findOne(filter).lean();
        if (!report) {
            return res.status(404).json({ message: 'RCA report not found' });
        }

        const workbook = await buildRcaSheetWorkbook(report, { companyId, userId: req.user?.id });
        const safeName = String(report.rcaNumber || 'RCA-Report').replace(/[^A-Za-z0-9._-]+/g, '-');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${safeName}.xlsx`);
        return res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
    } catch (error) {
        console.error('Error exporting RCA sheet:', error);
        return res.status(500).json({ message: 'Failed to export the RCA sheet', error: error.message });
    }
};
