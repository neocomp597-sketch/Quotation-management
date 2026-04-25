const Planning = require('../models/Planning');
const MGR = require('../models/MGR');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cleanValue = (value = '') => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeCodeKey = (value = '') => cleanValue(value).toUpperCase();

const resolveMgrCode = async (value, mgrType) => {
    const cleaned = cleanValue(value);
    if (!cleaned) {
        return '';
    }

    const match = await MGR.findOne({
        mgrType,
        code: { $regex: new RegExp(`^${escapeRegex(cleaned)}$`, 'i') }
    });

    return match?.code || cleaned;
};

const normalizePlanningPayload = async (payload = {}) => {
    const normalized = { ...payload };

    if (Object.prototype.hasOwnProperty.call(normalized, 'monthYear')) {
        normalized.monthYear = cleanValue(normalized.monthYear);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'financialYear')) {
        normalized.financialYear = cleanValue(normalized.financialYear);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'customerName')) {
        normalized.customerName = cleanValue(normalized.customerName);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'productName')) {
        normalized.productName = cleanValue(normalized.productName);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'mgrCode')) {
        normalized.mgrCode = await resolveMgrCode(normalized.mgrCode, 'MGR1');
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'mgrCode2')) {
        normalized.mgrCode2 = await resolveMgrCode(normalized.mgrCode2, 'MGR2');
    }

    return normalized;
};

exports.createEntry = async (req, res) => {
    try {
        const normalizedBody = await normalizePlanningPayload(req.body);
        const entry = new Planning({
            ...normalizedBody,
            totalValue: (normalizedBody.qty || 0) * (normalizedBody.value || 0),
            createdBy: req.user?.id
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
            .populate('productId', 'productName')
            .sort({ createdAt: -1 });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = await normalizePlanningPayload(req.body);
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

        if (!type) {
            const entries = await Planning.find({ financialYear });
            const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
            const startYear = parseInt(financialYear.split('-')[0], 10);
            const monthKeys = monthNames.map((name, idx) => {
                const year = idx < 9 ? startYear : startYear + 1;
                return `${name}-${year.toString().slice(-2)}`;
            });

            const [mgr1Masters, mgr2Masters] = await Promise.all([
                MGR.find({ mgrType: 'MGR1' }).select('code').lean(),
                MGR.find({ mgrType: 'MGR2' }).select('code').lean()
            ]);
            const mgr1MasterMap = new Map(mgr1Masters.map((item) => [normalizeCodeKey(item.code), item.code]));
            const mgr2MasterMap = new Map(mgr2Masters.map((item) => [normalizeCodeKey(item.code), item.code]));

            const collectGroups = (field, masterMap, fallbackLabel) => {
                const seen = new Set();
                const groups = [];

                entries.forEach((entry) => {
                    const rawValue = cleanValue(entry[field]) || fallbackLabel;
                    const key = normalizeCodeKey(rawValue);
                    if (!key || seen.has(key)) {
                        return;
                    }

                    seen.add(key);
                    groups.push({
                        key,
                        label: masterMap.get(key) || rawValue
                    });
                });

                groups.sort((left, right) => left.label.localeCompare(right.label));
                return groups;
            };

            const mgr1Groups = collectGroups('mgrCode', mgr1MasterMap, '');
            const mgr2Groups = collectGroups('mgrCode2', mgr2MasterMap, 'Unassigned');
            const mgrColumns = mgr1Groups.map((group) => group.label);

            const sumEntries = (rowEntries, mgr1Key, mgr2Key = null) => rowEntries
                .filter((entry) => normalizeCodeKey(entry.mgrCode) === mgr1Key)
                .filter((entry) => mgr2Key === null || normalizeCodeKey(cleanValue(entry.mgrCode2) || 'Unassigned') === mgr2Key)
                .reduce((acc, entry) => acc + (entry.totalValue || 0), 0);

            const buildMatrixRow = (periodLabel, rowEntries, flags = {}) => {
                const row = { month: periodLabel, ...flags };
                let total = 0;

                mgr1Groups.forEach((group) => {
                    const sum = flags.categoryKey ? sumEntries(rowEntries, group.key, flags.categoryKey) : sumEntries(rowEntries, group.key);
                    row[group.label] = sum;
                    total += sum;
                });

                row.total = total;
                return row;
            };

            const rows = [];
            monthKeys.forEach((monthKey) => {
                const monthEntries = entries.filter((entry) => entry.monthYear === monthKey);
                rows.push(buildMatrixRow(monthKey, monthEntries, { isMonth: true }));

                mgr2Groups.forEach((category) => {
                    rows.push(buildMatrixRow(category.label, monthEntries, {
                        parentMonth: monthKey,
                        categoryKey: category.key
                    }));
                });
            });

            if (entries.length > 0) {
                rows.push(buildMatrixRow('Total', entries, { isTotal: true }));
            }

            return res.json({
                financialYear,
                mgrCodes: mgrColumns,
                mgrColumns,
                rows
            });
        }

        const mgrType = type || 'MGR1';
        const mgrField = mgrType === 'MGR2' ? 'mgrCode2' : 'mgrCode';
        const masterCodes = await MGR.find({ mgrType }).select('code').lean();
        const masterCodeMap = new Map(masterCodes.map((mgr) => [normalizeCodeKey(mgr.code), mgr.code]));

        // Get all entries for the financial year
        const entries = await Planning.find({ financialYear });

        const mgrCodeGroups = [];
        const seenCodeGroups = new Set();
        entries.forEach((entry) => {
            const codeKey = normalizeCodeKey(entry[mgrField]);
            if (!codeKey || seenCodeGroups.has(codeKey)) {
                return;
            }

            seenCodeGroups.add(codeKey);
            mgrCodeGroups.push({
                key: codeKey,
                label: masterCodeMap.get(codeKey) || cleanValue(entry[mgrField])
            });
        });
        mgrCodeGroups.sort((left, right) => left.label.localeCompare(right.label));
        const mgrCodes = mgrCodeGroups.map((group) => group.label);

        // Define months in financial year order (Apr to Mar)
        const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
        const startYear = parseInt(financialYear.split('-')[0]);

        const monthRows = monthNames.map((name, idx) => {
            const year = idx < 9 ? startYear : startYear + 1;
            const yearShort = year.toString().slice(-2);
            const monthKey = `${name}-${yearShort}`;

            const row = { month: monthKey };
            let total = 0;

            mgrCodeGroups.forEach((mgr) => {
                const sum = entries
                    .filter((entry) => entry.monthYear === monthKey && normalizeCodeKey(entry[mgrField]) === mgr.key)
                    .reduce((acc, e) => acc + (e.totalValue || 0), 0);
                row[mgr.label] = sum;
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

            mgrCodeGroups.forEach((mgr) => {
                const sum = q.months.reduce((acc, i) => acc + (monthRows[i][mgr.label] || 0), 0);
                row[mgr.label] = sum;
                total += sum;
            });

            row.total = total;
            return row;
        });

        const grandTotal = { month: 'Total', isTotal: true };
        let gt = 0;
        mgrCodeGroups.forEach((mgr) => {
            const sum = monthRows.reduce((acc, row) => acc + (row[mgr.label] || 0), 0);
            grandTotal[mgr.label] = sum;
            gt += sum;
        });
        grandTotal.total = gt;

        const percentageRow = { month: 'Percentage %', isPercentage: true };
        mgrCodeGroups.forEach((mgr) => {
            percentageRow[mgr.label] = gt > 0 ? parseFloat(((grandTotal[mgr.label] / gt) * 100).toFixed(1)) : 0;
        });
        percentageRow.total = 100;

        // Add Previous Year Percentage logic
        const prevYearStart = startYear - 1;
        const prevYearEnd = startYear.toString().slice(-2);
        const prevFinancialYear = `${prevYearStart}-${prevYearEnd}`;
        
        const prevEntries = await Planning.find({ financialYear: prevFinancialYear });
        const prevGT = prevEntries.reduce((acc, e) => acc + (e.totalValue || 0), 0);
        
        const prevPercentageRow = { month: 'Percentage % (Previous Year)', isPercentage: true };
        mgrCodeGroups.forEach((mgr) => {
            const prevMgrTotal = prevEntries
                .filter((entry) => normalizeCodeKey(entry[mgrField]) === mgr.key)
                .reduce((acc, e) => acc + (e.totalValue || 0), 0);
            prevPercentageRow[mgr.label] = prevGT > 0 ? parseFloat(((prevMgrTotal / prevGT) * 100).toFixed(1)) : 0;
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
            mgrColumns: mgrCodes,
            rows: reportRows
        });
    } catch (err) {
        console.error('[Planning Error] getMGRReport:', err);
        res.status(500).json({ message: err.message });
    }
};
