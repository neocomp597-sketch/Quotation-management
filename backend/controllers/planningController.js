const Planning = require('../models/Planning');

exports.createEntry = async (req, res) => {
    try {
        const entry = new Planning({
            ...req.body,
            totalValue: (req.body.qty || 0) * (req.body.value || 0),
            createdBy: req.user?._id
        });
        await entry.save();
        res.status(201).json(entry);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllEntries = async (req, res) => {
    try {
        const { financialYear } = req.query;
        const filter = {};
        if (financialYear) filter.financialYear = financialYear;

        const entries = await Planning.find(filter)
            .populate('customerId', 'companyName customerName')
            .populate('productId', 'name')
            .sort({ createdAt: -1 });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        if (updateData.qty !== undefined && updateData.value !== undefined) {
            updateData.totalValue = updateData.qty * updateData.value;
        }

        const updated = await Planning.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true
        });
        if (!updated) return res.status(404).json({ message: 'Entry not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Planning.findByIdAndDelete(id);
        if (!result) return res.status(404).json({ message: 'Entry not found' });
        res.json({ message: 'Entry deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Dynamic MGR Report — month-wise breakdown grouped by MGR codes
exports.getMGRReport = async (req, res) => {
    try {
        const { financialYear, type } = req.query;
        if (!financialYear) {
            return res.status(400).json({ message: 'financialYear is required (e.g. 2026-27)' });
        }

        const mgrType = type || 'MGR1';
        const mgrField = mgrType === 'MGR2' ? 'mgrCode2' : 'mgrCode';

        // Get all entries for the financial year
        const entries = await Planning.find({ financialYear });

        // Get unique MGR codes for the selected field
        const mgrCodes = [...new Set(entries.map(e => e[mgrField]).filter(Boolean))].sort();

        // Define months in financial year order (Apr to Mar)
        const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
        const startYear = parseInt(financialYear.split('-')[0]);

        const monthRows = monthNames.map((name, idx) => {
            const year = idx < 9 ? startYear : startYear + 1;
            const yearShort = year.toString().slice(-2);
            const monthKey = `${name}-${yearShort}`;

            const row = { month: monthKey };
            let total = 0;

            mgrCodes.forEach(mgr => {
                const sum = entries
                    .filter(e => e.monthYear === monthKey && e[mgrField] === mgr)
                    .reduce((acc, e) => acc + (e.totalValue || 0), 0);
                row[mgr] = sum;
                total += sum;
            });

            row.total = total;
            return row;
        });

        const quarters = [
            { name: 'Q1', months: [0, 1, 2] },
            { name: 'Q2', months: [3, 4, 5] },
            { name: 'Q3', months: [6, 7, 8] },
            { name: 'Q4', months: [9, 10, 11] }
        ];

        const quarterTotals = quarters.map(q => {
            const row = { month: `${q.name} ${financialYear}`, isQuarter: true };
            let total = 0;

            mgrCodes.forEach(mgr => {
                const sum = q.months.reduce((acc, i) => acc + (monthRows[i][mgr] || 0), 0);
                row[mgr] = sum;
                total += sum;
            });

            row.total = total;
            return row;
        });

        const grandTotal = { month: 'Total', isTotal: true };
        let gt = 0;
        mgrCodes.forEach(mgr => {
            const sum = monthRows.reduce((acc, r) => acc + (r[mgr] || 0), 0);
            grandTotal[mgr] = sum;
            gt += sum;
        });
        grandTotal.total = gt;

        const percentageRow = { month: 'Percentage %', isPercentage: true };
        mgrCodes.forEach(mgr => {
            percentageRow[mgr] = gt > 0 ? parseFloat(((grandTotal[mgr] / gt) * 100).toFixed(1)) : 0;
        });
        percentageRow.total = 100;

        // Add Previous Year Percentage logic
        const prevYearStart = startYear - 1;
        const prevYearEnd = startYear.toString().slice(-2);
        const prevFinancialYear = `${prevYearStart}-${prevYearEnd}`;
        
        const prevEntries = await Planning.find({ financialYear: prevFinancialYear });
        const prevGT = prevEntries.reduce((acc, e) => acc + (e.totalValue || 0), 0);
        
        const prevPercentageRow = { month: 'Percentage % (Previous Year)', isPercentage: true };
        mgrCodes.forEach(mgr => {
            const prevMgrTotal = prevEntries
                .filter(e => e[mgrField] === mgr)
                .reduce((acc, e) => acc + (e.totalValue || 0), 0);
            prevPercentageRow[mgr] = prevGT > 0 ? parseFloat(((prevMgrTotal / prevGT) * 100).toFixed(1)) : 0;
        });
        prevPercentageRow.total = 100;

        const reportRows = [];
        quarters.forEach((q, qi) => {
            q.months.forEach(mi => {
                reportRows.push(monthRows[mi]);
            });
            reportRows.push(quarterTotals[qi]);
        });
        reportRows.push(grandTotal);
        reportRows.push(percentageRow);
        reportRows.push(prevPercentageRow);

        res.json({
            financialYear,
            mgrCodes,
            rows: reportRows
        });
    } catch (err) {
        console.error('[Planning Error] getMGRReport:', err);
        res.status(500).json({ message: err.message });
    }
};
