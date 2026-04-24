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
            const mgrTypes = [
                { key: 'MGR1', label: 'MGR 1', field: 'mgrCode' },
                { key: 'MGR2', label: 'MGR 2', field: 'mgrCode2' }
            ];

            const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
            const startYear = parseInt(financialYear.split('-')[0], 10);
            const monthKeys = monthNames.map((name, idx) => {
                const year = idx < 9 ? startYear : startYear + 1;
                return `${name}-${year.toString().slice(-2)}`;
            });

            const mastersByType = await Promise.all(
                mgrTypes.map((mgr) => MGR.find({ mgrType: mgr.key }).select('code').lean())
            );
            const masterLabelMaps = new Map(
                mgrTypes.map((mgr, idx) => [
                    mgr.key,
                    new Map(mastersByType[idx].map((item) => [normalizeCodeKey(item.code), item.code]))
                ])
            );

            const groupsByType = new Map();
            mgrTypes.forEach((mgr) => {
                const masterMap = masterLabelMaps.get(mgr.key);
                const seen = new Set();
                const groups = [];

                entries.forEach((entry) => {
                    const codeKey = normalizeCodeKey(entry[mgr.field]);
                    if (!codeKey || seen.has(codeKey)) {
                        return;
                    }

                    seen.add(codeKey);
                    groups.push({
                        key: codeKey,
                        label: masterMap.get(codeKey) || cleanValue(entry[mgr.field])
                    });
                });

                groups.sort((left, right) => left.label.localeCompare(right.label));
                groupsByType.set(mgr.key, groups);
            });

            const mgrColumns = [];
            const seenColumns = new Set();
            mgrTypes.forEach((mgr) => {
                groupsByType.get(mgr.key).forEach((group) => {
                    if (!seenColumns.has(group.label)) {
                        seenColumns.add(group.label);
                        mgrColumns.push(group.label);
                    }
                });
            });

            const buildTypedRow = (periodLabel, mgr, rowEntries, flags = {}) => {
                const row = { month: periodLabel, mgrType: mgr.label, ...flags };
                let total = 0;

                mgrColumns.forEach((column) => {
                    row[column] = 0;
                });

                groupsByType.get(mgr.key).forEach((group) => {
                    const sum = rowEntries
                        .filter((entry) => normalizeCodeKey(entry[mgr.field]) === group.key)
                        .reduce((acc, entry) => acc + (entry.totalValue || 0), 0);
                    row[group.label] = sum;
                    total += sum;
                });

                row.total = total;
                return row;
            };

            const quarters = [
                { name: 'Q1', months: monthKeys.slice(0, 3) },
                { name: 'Q2', months: monthKeys.slice(3, 6) },
                { name: 'Q3', months: monthKeys.slice(6, 9) },
                { name: 'Q4', months: monthKeys.slice(9, 12) }
            ];

            const rows = [];
            quarters.forEach((quarter) => {
                quarter.months.forEach((monthKey) => {
                    const monthEntries = entries.filter((entry) => entry.monthYear === monthKey);
                    mgrTypes.forEach((mgr) => {
                        rows.push(buildTypedRow(monthKey, mgr, monthEntries));
                    });
                });

                const quarterEntries = entries.filter((entry) => quarter.months.includes(entry.monthYear));
                mgrTypes.forEach((mgr) => {
                    rows.push(buildTypedRow(`${quarter.name} ${financialYear}`, mgr, quarterEntries, { isQuarter: true }));
                });
            });

            const grandTotalRows = mgrTypes.map((mgr) => buildTypedRow('Grand Total', mgr, entries, { isTotal: true }));
            rows.push(...grandTotalRows);

            const grandTotal = grandTotalRows.reduce((acc, row) => acc + (row.total || 0), 0);
            mgrTypes.forEach((mgr, index) => {
                const row = { month: 'Percentage', mgrType: mgr.label, isPercentage: true };
                mgrColumns.forEach((column) => {
                    const value = grandTotal > 0 ? ((grandTotalRows[index][column] || 0) / grandTotal) * 100 : 0;
                    row[column] = parseFloat(value.toFixed(1));
                });
                row.total = grandTotal > 0 ? parseFloat(((grandTotalRows[index].total / grandTotal) * 100).toFixed(1)) : 0;
                rows.push(row);
            });

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
