const Planning = require('../models/Planning');
const MGR = require('../models/MGR');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cleanValue = (value = '') => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeCodeKey = (value = '') => cleanValue(value).toUpperCase();

const STATUS_COLUMNS = ['Firm', 'MFC', 'B & B', 'Others', 'Invoice', 'Lost', 'Parked', 'Order Received'];
const STATUS_ALIASES = {
    'B & B': 'B&B',
    Others: 'Other'
};
const STATUS_FALLBACK = 'Others';
const STATUS_SEGMENTS = ['Utility', 'UC', 'Industry'];
const FY_MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const QUARTERS = [
    { name: 'Q1', months: [0, 1, 2] },
    { name: 'Q2', months: [3, 4, 5] },
    { name: 'Q3', months: [6, 7, 8] },
    { name: 'Q4', months: [9, 10, 11] }
];

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

const getFinancialYearMonthLabels = (financialYear) => {
    const startYear = parseInt(financialYear.split('-')[0], 10);

    return FY_MONTH_NAMES.map((name, idx) => {
        const year = idx < 9 ? startYear : startYear + 1;
        return `${name}-${year.toString().slice(-2)}`;
    });
};

const buildMonthFilter = (financialYear, month, year) => {
    const cleanedMonth = cleanValue(month);
    const cleanedYear = cleanValue(year);

    if (!cleanedMonth && !cleanedYear) {
        return null;
    }

    if (!cleanedMonth || !cleanedYear) {
        return null;
    }

    const monthLabel = `${cleanedMonth}-${cleanedYear.slice(-2)}`;
    return getFinancialYearMonthLabels(financialYear).includes(monthLabel) ? monthLabel : null;
};

const getLabelForColumn = (value) => STATUS_ALIASES[value] || value;
const normalizeStatusValue = (value = '') => {
    const cleaned = cleanValue(value);
    const matched = STATUS_COLUMNS.find((status) => normalizeCodeKey(status) === normalizeCodeKey(cleaned));
    return matched || STATUS_FALLBACK;
};
const buildEmptyStatusTotals = () => {
    const row = {};
    STATUS_COLUMNS.forEach((status) => {
        row[getLabelForColumn(status)] = 0;
    });
    row.total = 0;
    return row;
};
const buildStatusBreakdown = (sourceEntries = []) => {
    const breakdown = {};

    STATUS_SEGMENTS.forEach((segment) => {
        const segmentEntries = sourceEntries.filter((entry) => normalizeCodeKey(entry.mgrCode2) === normalizeCodeKey(segment));
        const segmentRow = buildEmptyStatusTotals();

        STATUS_COLUMNS.forEach((status) => {
            const label = getLabelForColumn(status);
            const value = segmentEntries
                .filter((entry) => normalizeStatusValue(entry.status) === status)
                .reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0);
            segmentRow[label] = value;
            segmentRow.total += value;
        });

        breakdown[segment] = segmentRow;
    });

    const totalRow = buildEmptyStatusTotals();
    STATUS_COLUMNS.forEach((status) => {
        const label = getLabelForColumn(status);
        totalRow[label] = STATUS_SEGMENTS.reduce((acc, segment) => acc + Number(breakdown[segment][label] || 0), 0);
        totalRow.total += totalRow[label];
    });
    breakdown.Total = totalRow;

    return breakdown;
};

const getMeasureForEntry = (entry, metric) => {
    if (metric === 'count') {
        return 1;
    }

    return Number(entry.totalValue || 0);
};

const buildColumnGroups = (entries, field, fallbackLabel, masterMap) => {
    const groups = [];
    const seen = new Set();

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

    groups.sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' }));
    return groups;
};

const buildSummaryRows = (rows, columns, prevRows, flags = {}) => {
    const grandTotal = { month: 'Total', isTotal: true };
    let totalValue = 0;

    columns.forEach((column) => {
        const sum = rows.reduce((acc, row) => acc + Number(row[column] || 0), 0);
        grandTotal[column] = sum;
        totalValue += sum;
    });
    grandTotal.total = totalValue;

    const percentageRow = { month: 'Percentage %', isPercentage: true };
    columns.forEach((column) => {
        percentageRow[column] = totalValue > 0 ? Number(((grandTotal[column] / totalValue) * 100).toFixed(2)) : 0;
    });
    percentageRow.total = totalValue > 0 ? 100 : 0;

    const prevValueRow = { month: 'Value (Previous Year)', isPreviousYearValue: true };
    let prevTotal = 0;
    columns.forEach((column) => {
        const sum = prevRows.reduce((acc, row) => acc + Number(row[column] || 0), 0);
        prevValueRow[column] = sum;
        prevTotal += sum;
    });
    prevValueRow.total = prevTotal;

    const totalPercentageRow = { month: 'Total Percentage', isTotalPercentage: true };
    columns.forEach((column) => {
        const current = Number(grandTotal[column] || 0);
        const previous = Number(prevValueRow[column] || 0);
        totalPercentageRow[column] = previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : 0;
    });
    totalPercentageRow.total = prevTotal > 0
        ? Number((((totalValue - prevTotal) / prevTotal) * 100).toFixed(2))
        : 0;

    const summaryRows = [grandTotal, percentageRow, prevValueRow, totalPercentageRow];

    if (flags.excludePreviousYearValue) {
        return [grandTotal];
    }

    return summaryRows;
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

exports.getMGRReport = async (req, res) => {
    try {
        const { financialYear, type, month, year } = req.query;
        if (!financialYear) {
            return res.status(400).json({ message: 'financialYear is required (e.g. 2026-27)' });
        }

        const reportType = cleanValue(type || 'SBU').toUpperCase();
        const monthYearFilter = buildMonthFilter(financialYear, month, year);
        const query = { financialYear };
        if (monthYearFilter) {
            query.monthYear = monthYearFilter;
        }

        const [mgr1Masters, mgr2Masters, entries] = await Promise.all([
            MGR.find({ mgrType: 'MGR1' }).select('code').lean(),
            MGR.find({ mgrType: 'MGR2' }).select('code').lean(),
            Planning.find(query).lean()
        ]);

        const mgr1MasterMap = new Map(mgr1Masters.map((item) => [normalizeCodeKey(item.code), item.code]));
        const mgr2MasterMap = new Map(mgr2Masters.map((item) => [normalizeCodeKey(item.code), item.code]));
        const monthLabels = monthYearFilter ? [monthYearFilter] : getFinancialYearMonthLabels(financialYear);
        const startYear = parseInt(financialYear.split('-')[0], 10);
        const prevFinancialYear = `${startYear - 1}-${String(startYear).slice(-2)}`;
        const prevQuery = { financialYear: prevFinancialYear };
        if (monthYearFilter) {
            const [monthName, yearSuffix] = monthYearFilter.split('-');
            const currentYear = Number(`20${yearSuffix}`);
            const prevMonthLabel = `${monthName}-${String(currentYear - 1).slice(-2)}`;
            prevQuery.monthYear = prevMonthLabel;
        }
        const prevEntries = await Planning.find(prevQuery).lean();

        if (reportType === 'STATUS') {
            const sbuGroups = buildColumnGroups(entries, 'mgrCode', 'Unassigned', mgr1MasterMap);
            const rows = [];
            const sourceTotal = entries.reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0);

            const getStatusValue = (rowEntries, segment, status) => rowEntries
                .filter((entry) => normalizeCodeKey(entry.mgrCode2) === normalizeCodeKey(segment))
                .filter((entry) => normalizeStatusValue(entry.status) === status)
                .reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0);

            monthLabels.forEach((monthLabel) => {
                const monthEntries = entries.filter((entry) => entry.monthYear === monthLabel);
                rows.push({ month: monthLabel, isMonth: true });

                sbuGroups.forEach((sbu) => {
                    const sbuEntries = monthEntries.filter((entry) => normalizeCodeKey(entry.mgrCode) === sbu.key);
                    rows.push({ month: sbu.label, parentMonth: monthLabel, isSbu: true });

                    STATUS_SEGMENTS.forEach((segment) => {
                        const row = {
                            month: segment,
                            parentMonth: monthLabel,
                            parentSbu: sbu.label,
                            isSegment: true
                        };
                        let total = 0;
                        STATUS_COLUMNS.forEach((status) => {
                            const value = getStatusValue(sbuEntries, segment, status);
                            row[getLabelForColumn(status)] = value;
                            total += value;
                        });
                        row.total = total;
                        rows.push(row);
                    });

                    const totalRow = {
                        month: 'Total',
                        parentMonth: monthLabel,
                        parentSbu: sbu.label,
                        isTotal: true
                    };
                    let total = 0;
                    STATUS_COLUMNS.forEach((status) => {
                        const value = sbuEntries
                            .filter((entry) => normalizeStatusValue(entry.status) === status)
                            .reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0);
                        totalRow[getLabelForColumn(status)] = value;
                        total += value;
                    });
                    totalRow.total = total;
                    rows.push(totalRow);
                });
            });

            const reportTotal = rows
                .filter((row) => row.isTotal)
                .reduce((acc, row) => acc + Number(row.total || 0), 0);

            return res.json({
                financialYear,
                month: cleanValue(month),
                year: cleanValue(year),
                monthYear: monthYearFilter,
                reportType: 'STATUS',
                metric: 'value',
                mgrCodes: STATUS_COLUMNS.map(getLabelForColumn),
                mgrColumns: STATUS_COLUMNS.map(getLabelForColumn),
                reconciliation: {
                    sourceTotal,
                    reportTotal,
                    matchesSource: sourceTotal === reportTotal
                },
                rows
            });
        }

        if (reportType === 'SEGMENT' || reportType === 'MGR2') {
            const columnGroups = buildColumnGroups(entries, 'mgrCode2', 'Unassigned', mgr2MasterMap);
            const columns = columnGroups.map((group) => group.label);

            const buildMonthRows = (sourceEntries) => monthLabels.map((monthLabel) => {
                const row = { month: monthLabel };
                let total = 0;

                columnGroups.forEach((column) => {
                    const sum = sourceEntries
                        .filter((entry) => entry.monthYear === monthLabel && normalizeCodeKey(entry.mgrCode2) === column.key)
                        .reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0);
                    row[column.label] = sum;
                    total += sum;
                });

                row.total = total;
                return row;
            });

            const monthRows = buildMonthRows(entries);
            const prevMonthRows = buildMonthRows(prevEntries);
            const quarterRows = monthYearFilter
                ? []
                : QUARTERS.map((quarter) => {
                    const row = { month: `${quarter.name} ${financialYear}`, isQuarter: true };
                    let total = 0;
                    columnGroups.forEach((column) => {
                        const sum = quarter.months.reduce((acc, monthIndex) => acc + Number(monthRows[monthIndex]?.[column.label] || 0), 0);
                        row[column.label] = sum;
                        total += sum;
                    });
                    row.total = total;
                    return row;
                });

            const reportRows = [];
            if (monthYearFilter) {
                reportRows.push(...monthRows);
            } else {
                QUARTERS.forEach((quarter, index) => {
                    quarter.months.forEach((monthIndex) => {
                        reportRows.push(monthRows[monthIndex]);
                    });
                    reportRows.push(quarterRows[index]);
                });
            }
            const summaryRows = buildSummaryRows(monthRows, columns, prevMonthRows);
            reportRows.push(...summaryRows);

            return res.json({
                financialYear,
                month: cleanValue(month),
                year: cleanValue(year),
                monthYear: monthYearFilter,
                reportType: 'SEGMENT',
                mgrCodes: columns,
                mgrColumns: columns,
                reconciliation: {
                    sourceTotal: entries.reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0),
                    reportTotal: Number(summaryRows.find((row) => row.isTotal)?.total || 0),
                    matchesSource: entries.reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0) === Number(summaryRows.find((row) => row.isTotal)?.total || 0)
                },
                rows: reportRows
            });
        }

        const columnGroups = buildColumnGroups(entries, 'mgrCode2', 'Unassigned', mgr2MasterMap);
        const columns = columnGroups.map((group) => group.label);
        const sbuGroups = buildColumnGroups(entries, 'mgrCode', 'Unassigned', mgr1MasterMap);

        const buildSbuMonthRow = (monthLabel, sourceEntries, flags = {}) => {
            const row = { month: monthLabel, ...flags };
            let total = 0;

            columnGroups.forEach((column) => {
                const sum = sourceEntries
                    .filter((entry) => !flags.sbuKey || normalizeCodeKey(entry.mgrCode) === flags.sbuKey)
                    .filter((entry) => normalizeCodeKey(entry.mgrCode2) === column.key)
                    .reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0);
                row[column.label] = sum;
                total += sum;
            });

            row.total = total;

            if (flags.includeStatusBreakdown) {
                row.statusBreakdown = buildStatusBreakdown(sourceEntries);
            }

            return row;
        };

        const monthRows = [];
        const prevMonthRows = [];

        monthLabels.forEach((monthLabel) => {
            const monthEntries = entries.filter((entry) => entry.monthYear === monthLabel);
            monthRows.push(buildSbuMonthRow(monthLabel, monthEntries, { isMonth: true }));
            sbuGroups.forEach((sbu) => {
                monthRows.push(buildSbuMonthRow(sbu.label, monthEntries, {
                    parentMonth: monthLabel,
                    sbuKey: sbu.key,
                    isChild: true,
                    includeStatusBreakdown: true
                }));
            });
        });

        monthLabels.forEach((monthLabel) => {
            const prevMonthLabel = monthYearFilter
                ? prevQuery.monthYear
                : `${monthLabel.split('-')[0]}-${String(Number(`20${monthLabel.split('-')[1]}`) - 1).slice(-2)}`;
            const sourceEntries = prevEntries.filter((entry) => entry.monthYear === prevMonthLabel);
            prevMonthRows.push(buildSbuMonthRow(monthLabel, sourceEntries, { isMonth: true }));
        });

        const quarterRows = monthYearFilter
            ? []
            : QUARTERS.map((quarter) => {
                const row = { month: `${quarter.name} ${financialYear}`, isQuarter: true };
                let total = 0;
                columns.forEach((column) => {
                    const sum = quarter.months.reduce((acc, monthIndex) => acc + Number(monthRows.find((item) => item.isMonth && item.month === monthLabels[monthIndex])?.[column] || 0), 0);
                    row[column] = sum;
                    total += sum;
                });
                row.total = total;
                return row;
            });

        const reportRows = [];
        if (monthYearFilter) {
            reportRows.push(...monthRows);
        } else {
            QUARTERS.forEach((quarter, index) => {
                quarter.months.forEach((monthIndex) => {
                    const monthLabel = monthLabels[monthIndex];
                    reportRows.push(...monthRows.filter((row) => row.month === monthLabel || row.parentMonth === monthLabel));
                });
                reportRows.push(quarterRows[index]);
            });
        }
        const summaryRows = buildSummaryRows(
            monthRows.filter((row) => row.isMonth),
            columns,
            prevMonthRows
        );
        reportRows.push(...summaryRows);
        const sbuWise = monthRows
            .filter((row) => row.isChild)
            .map((row) => ({
                month: row.parentMonth,
                sbu: row.month,
                segments: Object.fromEntries(columns.map((column) => [column, Number(row[column] || 0)])),
                total: Number(row.total || 0),
                statusBreakdown: row.statusBreakdown || {}
            }));

        return res.json({
            financialYear,
            month: cleanValue(month),
            year: cleanValue(year),
            monthYear: monthYearFilter,
            reportType: 'SBU',
            mgrCodes: columns,
            mgrColumns: columns,
            statusColumns: STATUS_COLUMNS.map(getLabelForColumn),
            statusSegments: [...STATUS_SEGMENTS, 'Total'],
            reconciliation: {
                sourceTotal: entries.reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0),
                reportTotal: Number(summaryRows.find((row) => row.isTotal)?.total || 0),
                matchesSource: entries.reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0) === Number(summaryRows.find((row) => row.isTotal)?.total || 0)
            },
            sbuWise,
            rows: reportRows
        });
    } catch (err) {
        console.error('[Planning Error] getMGRReport:', err);
        res.status(500).json({ message: err.message });
    }
};
