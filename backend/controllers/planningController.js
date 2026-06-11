const Planning = require('../models/Planning');
const MGR = require('../models/MGR');
const { getCachedJson, makeCacheKey, setCachedJson } = require('../utils/apiCache');
const { invalidateViaQueueOrNow } = require('../queues/cacheInvalidationQueue');
const { getTenantId } = require('../middlewares/tenantContext');
const RolePermission = require('../models/RolePermission');
const { resolvePermissions } = require('../config/authorization');
const { createCompanyNotifications } = require('../utils/notificationHelper');

const normalizeFinancialYear = (fy) => {
    if (!fy) return fy;
    let clean = String(fy).trim().replace(/[\s\-\/]+/g, '-');
    const match = clean.match(/^(\d{2,4})-(\d{2,4})$/);
    if (match) {
        let start = match[1];
        let end = match[2];
        if (start.length === 2) {
            start = '20' + start;
        }
        if (end.length === 4) {
            end = end.slice(-2);
        }
        return `${start}-${end}`;
    }
    return fy;
};

const isPreviousYear = (financialYear) => {
    if (!financialYear) return false;
    const normalizedFY = normalizeFinancialYear(financialYear);
    const startYear = parseInt(normalizedFY.split('-')[0], 10);
    if (isNaN(startYear)) return false;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentFYStartYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    
    return startYear < currentFYStartYear;
};


const getRolePermissions = async (role) => {
    const { DEFAULT_ROLE_PERMISSIONS } = require('../config/authorization');
    if (role === 'admin') {
        return { ...DEFAULT_ROLE_PERMISSIONS.admin };
    }
    const document = await RolePermission.findOne({ role }).select('menuVisibility').lean();
    return resolvePermissions(role, document?.menuVisibility || {});
};

const checkPrevYearEditPermission = async (user, financialYear) => {
    if (!financialYear) return true;
    if (user.role === 'admin') return true;
    
    if (isPreviousYear(financialYear)) {
        const permissions = await getRolePermissions(user.role);
        if (!permissions.planning_edit_prev_year) {
            return false;
        }
    }
    return true;
};


const PLANNING_LIST_CACHE_TTL_SECONDS = Number(process.env.PLANNING_LIST_CACHE_TTL_SECONDS || 120);
const PLANNING_REPORT_CACHE_TTL_SECONDS = Number(process.env.PLANNING_REPORT_CACHE_TTL_SECONDS || 300);
const MGR_MASTER_CACHE_TTL_SECONDS = Number(process.env.MGR_MASTER_CACHE_TTL_SECONDS || 600);
const PLANNING_REPORT_SELECT = 'financialYear monthYear mgrCode mgrCode2 status qty value totalValue';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cleanValue = (value = '') => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeCodeKey = (value = '') => String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();

const STATUS_COLUMNS = ['Budget', 'Firm', 'MFC', 'B & B', 'Others', 'Invoice', 'Lost', 'Parked', 'Order Received'];
const STATUS_ALIASES = {
    'B & B': 'B&B',
    Others: 'Other'
};
const normalizeSbuValue = (sbuName = '') => {
    const cleaned = String(sbuName || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');

    if (cleaned === 'SBU1') return 'SBU1';
    if (cleaned === 'SBU2') return 'SBU2';
    if (cleaned === 'SBU3') return 'SBU3';
    if (cleaned === 'EPC') return 'EPC';

    return cleaned;
};
const STATUS_FALLBACK = 'Others';
const STATUS_SEGMENTS = ['Export', 'Industry', 'UC', 'Utility'];
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

const getMgrMasters = async (mgrType) => {
    const cacheKey = `planning:mgr-masters:${getTenantId() || 'unknown'}:${mgrType}`;
    const { redis, value: cachedMasters } = await getCachedJson(cacheKey);
    if (cachedMasters) return cachedMasters;

    const masters = await MGR.find({ mgrType }).select('code').lean();
    await setCachedJson(redis, cacheKey, masters, MGR_MASTER_CACHE_TTL_SECONDS);
    return masters;
};

const normalizePlanningPayload = async (payload = {}) => {
    const normalized = { ...payload };

    if (Object.prototype.hasOwnProperty.call(normalized, 'monthYear')) {
        normalized.monthYear = cleanValue(normalized.monthYear);
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'financialYear')) {
        normalized.financialYear = normalizeFinancialYear(cleanValue(normalized.financialYear));
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
    const normalizedFY = normalizeFinancialYear(financialYear);
    const startYear = parseInt(normalizedFY.split('-')[0], 10);

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
    const totalRow = buildEmptyStatusTotals();

    // First calculate status-wise totals for all entries (The Grand Total)
    STATUS_COLUMNS.forEach((status) => {
        const label = getLabelForColumn(status);
        const value = sourceEntries
            .filter((entry) => normalizeStatusValue(entry.status) === status)
            .reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0);
        totalRow[label] = value;
        totalRow.total += value;
    });

    const breakdown = { Total: totalRow };

    // Then calculate for individual segments
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

    return breakdown;
};

const getMeasureForEntry = (entry, metric) => {
    if (metric === 'count') {
        return 1;
    }

    return Number(entry.totalValue || (Number(entry.qty || 0) * Number(entry.value || 0)));
};

const buildColumnGroups = (entries, field, fallbackLabel, masterMap) => {
    const groups = [];
    const seen = new Set();

    const defaults = field === 'mgrCode'
        ? ['EPC', 'SBU1', 'SBU2', 'SBU3']
        : ['Export', 'Industry', 'UC', 'Utility'];

    const addGroup = (value) => {
        const rawValue = cleanValue(value) || fallbackLabel;
        const key = normalizeCodeKey(rawValue);
        if (!key || seen.has(key)) {
            return;
        }

        seen.add(key);
        groups.push({
            key,
            label: masterMap.get(key) || rawValue
        });
    };

    defaults.forEach(addGroup);

    entries.forEach((entry) => {
        addGroup(entry[field]);
    });

    groups.sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' }));
    return groups;
};

const getReportColumnLabel = (field, label) => {
    if (field === 'mgrCode') {
        return normalizeSbuValue(label);
    }

    return label;
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

    const percentageRow = { month: 'Percentage CY', isPercentage: true };
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

    const totalPercentageRow = { month: 'Percentage PY', isTotalPercentage: true };
    columns.forEach((column) => {
        const previous = Number(prevValueRow[column] || 0);
        totalPercentageRow[column] = prevTotal > 0 ? Number(((previous / prevTotal) * 100).toFixed(2)) : 0;
    });
    totalPercentageRow.total = prevTotal > 0 ? 100 : 0;

    const summaryRows = [grandTotal, percentageRow, prevValueRow, totalPercentageRow];

    if (flags.excludePreviousYearValue) {
        return [grandTotal];
    }

    return summaryRows;
};

exports.createEntry = async (req, res) => {
    try {
        const normalizedBody = await normalizePlanningPayload(req.body);
        
        const canEdit = await checkPrevYearEditPermission(req.user, normalizedBody.financialYear);
        if (!canEdit) {
            return res.status(403).json({ message: 'You do not have permission to add entries in previous financial years.' });
        }

        const entry = new Planning({
            ...normalizedBody,
            totalValue: (normalizedBody.qty || 0) * (normalizedBody.value || 0),
            createdBy: req.user?.id
        });
        await entry.save();
        await invalidateViaQueueOrNow('planning:*');

        // Trigger notification
        const creatorName = req.user?.name || 'A user';
        await createCompanyNotifications({
            companyId: req.user?.companyId,
            title: 'New Planning Entry',
            message: `Planning entry for FY ${entry.financialYear} (${entry.monthYear}) has been added for ${entry.customerName} by ${creatorName} (Total: ₹${(entry.totalValue || 0).toLocaleString()}).`,
            type: 'Planning',
            relatedId: entry._id,
            excludeUserId: req.user?.id
        });

        res.status(201).json(entry);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllEntries = async (req, res) => {
    try {
        const { financialYear: rawFY, month, mgr1, mgr2, status, limit = 5, offset = 0 } = req.query;
        const financialYear = normalizeFinancialYear(rawFY);
        const filter = {};
        if (financialYear) filter.financialYear = financialYear;
        if (month) filter.monthYear = month;
        if (mgr1) filter.mgrCode = mgr1;
        if (mgr2) filter.mgrCode2 = mgr2;
        if (status) {
            const statuses = String(status)
                .split(',')
                .map((item) => cleanValue(item))
                .map((item) => normalizeStatusValue(item))
                .filter(Boolean);
            if (statuses.length === 1) {
                filter.status = statuses[0];
            } else if (statuses.length > 1) {
                filter.status = { $in: statuses };
            }
        }

        if (req.query.excludeStatus) {
            const excluded = req.query.excludeStatus.split(',').map(s => cleanValue(s)).filter(Boolean);
            if (excluded.length > 0) {
                if (filter.status) {
                    if (typeof filter.status === 'string') {
                        filter.status = { $in: [filter.status], $nin: excluded };
                    } else if (filter.status.$in) {
                        filter.status.$nin = excluded;
                    }
                } else {
                    filter.status = { $nin: excluded };
                }
            }
        }

        const cacheKey = makeCacheKey('planning:list', req, { filter });
        const { redis, value: cachedEntries } = await getCachedJson(cacheKey);
        if (cachedEntries) {
            return res.json(cachedEntries);
        }

        const [total, entries] = await Promise.all([
            Planning.countDocuments(filter),
            Planning.find(filter)
                .select('customerId productId productName customerName financialYear monthYear mgrCode mgrCode2 status qty value totalValue remarks createdAt updatedAt')
                .populate('customerId', 'companyName customerName')
                .populate('productId', 'productName')
                .sort({ createdAt: -1 })
                .skip(Number(offset))
                .limit(Number(limit))
                .lean(),
        ]);

        const response = {
            total,
            data: entries
        };
        await setCachedJson(redis, cacheKey, response, PLANNING_LIST_CACHE_TTL_SECONDS);
        res.json(response);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await Planning.findById(id);
        if (!entry) return res.status(404).json({ message: 'Entry not found' });

        const updateData = await normalizePlanningPayload(req.body);

        const canEditOriginal = await checkPrevYearEditPermission(req.user, entry.financialYear);
        const canEditNew = await checkPrevYearEditPermission(req.user, updateData.financialYear || entry.financialYear);
        if (!canEditOriginal || !canEditNew) {
            return res.status(403).json({ message: 'You do not have permission to edit/update previous year entries.' });
        }

        if (updateData.qty !== undefined && updateData.value !== undefined) {
            updateData.totalValue = updateData.qty * updateData.value;
        }

        const updated = await Planning.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true
        });
        await invalidateViaQueueOrNow('planning:*');

        // Trigger notification
        const updaterName = req.user?.name || 'A user';
        await createCompanyNotifications({
            companyId: req.user?.companyId,
            title: 'Planning Entry Updated',
            message: `Planning entry for FY ${updated.financialYear} (${updated.monthYear}) for ${updated.customerName} has been updated by ${updaterName}.`,
            type: 'Planning',
            relatedId: updated._id,
            excludeUserId: req.user?.id
        });

        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await Planning.findById(id);
        if (!entry) return res.status(404).json({ message: 'Entry not found' });

        const canEdit = await checkPrevYearEditPermission(req.user, entry.financialYear);
        if (!canEdit) {
            return res.status(403).json({ message: 'You do not have permission to delete previous year entries.' });
        }

        await Planning.findByIdAndDelete(id);
        await invalidateViaQueueOrNow('planning:*');

        // Trigger notification
        const performerName = req.user?.name || 'A user';
        await createCompanyNotifications({
            companyId: req.user?.companyId,
            title: 'Planning Entry Deleted',
            message: `Planning entry for FY ${entry.financialYear} (${entry.monthYear}) for ${entry.customerName} has been deleted by ${performerName}.`,
            type: 'Planning',
            relatedId: entry._id,
            excludeUserId: req.user?.id
        });

        res.json({ message: 'Entry deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getMGRReport = async (req, res) => {
    try {
        const { financialYear: rawFY, type, month, year, mgr1, mgr2, status, excludeStatus } = req.query;
        const financialYear = normalizeFinancialYear(rawFY);
        if (!financialYear) {
            return res.status(400).json({ message: 'financialYear is required (e.g. 2026-27)' });
        }

        const reportType = cleanValue(type || 'SBU').toUpperCase();
        const monthYearFilter = buildMonthFilter(financialYear, month, year);
        const query = { financialYear };
        if (monthYearFilter) {
            query.monthYear = monthYearFilter;
        }
        if (cleanValue(mgr1)) {
            query.mgrCode = cleanValue(mgr1);
        }
        if (cleanValue(mgr2)) {
            query.mgrCode2 = cleanValue(mgr2);
        }
        if (cleanValue(status)) {
            const statuses = String(status)
                .split(',')
                .map((item) => cleanValue(item))
                .map((item) => normalizeStatusValue(item))
                .filter(Boolean);
            if (statuses.length === 1) {
                query.status = statuses[0];
            } else if (statuses.length > 1) {
                query.status = { $in: statuses };
            }
        }
        if (cleanValue(excludeStatus)) {
            const excludedStatuses = String(excludeStatus)
                .split(',')
                .map((item) => cleanValue(item))
                .map((item) => normalizeStatusValue(item))
                .filter(Boolean);
            if (excludedStatuses.length > 0) {
                if (typeof query.status === 'string') {
                    query.status = { $in: [query.status], $nin: excludedStatuses };
                } else if (query.status && query.status.$in) {
                    query.status.$nin = excludedStatuses;
                } else {
                    query.status = { $nin: excludedStatuses };
                }
            }
        }

        const cacheKey = makeCacheKey('planning:mgr-report', req, { query, reportType, monthYearFilter });
        const { redis, value: cachedReport } = await getCachedJson(cacheKey);
        if (cachedReport) {
            return res.json(cachedReport);
        }

        const startYear = parseInt(financialYear.split('-')[0], 10);
        const prevFinancialYear = `${startYear - 1}-${String(startYear).slice(-2)}`;
        const prevQuery = { financialYear: prevFinancialYear };
        
        if (query.status) prevQuery.status = query.status;

        if (monthYearFilter) {
            const [monthName, yearSuffix] = monthYearFilter.split('-');
            const currentYear = Number(`20${yearSuffix}`);
            const prevMonthLabel = `${monthName}-${String(currentYear - 1).slice(-2)}`;
            prevQuery.monthYear = prevMonthLabel;
        }

        const [mgr1Masters, mgr2Masters, entries, prevEntries] = await Promise.all([
            getMgrMasters('MGR1'),
            getMgrMasters('MGR2'),
            Planning.find(query).select(PLANNING_REPORT_SELECT).lean(),
            Planning.find(prevQuery).select(PLANNING_REPORT_SELECT).lean()
        ]);

        const mgr1MasterMap = new Map(mgr1Masters.map((item) => [normalizeCodeKey(item.code), item.code]));
        const mgr2MasterMap = new Map(mgr2Masters.map((item) => [normalizeCodeKey(item.code), item.code]));
        const monthLabels = monthYearFilter ? [monthYearFilter] : getFinancialYearMonthLabels(financialYear);

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

            const response = {
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
            };
            await setCachedJson(redis, cacheKey, response, PLANNING_REPORT_CACHE_TTL_SECONDS);
            return res.json(response);
        }

        if (reportType === 'SEGMENT' || reportType === 'MGR2') {
            const columnGroups = buildColumnGroups(entries, 'mgrCode2', 'Unassigned', mgr2MasterMap);
            const columns = columnGroups.map((group) => getReportColumnLabel('mgrCode2', group.label));
            const visibleMonthLabels = monthYearFilter
                ? [monthYearFilter]
                : monthLabels;

            const buildMonthRows = (sourceEntries, labels = visibleMonthLabels) => labels.map((monthLabel) => {
                const row = { month: monthLabel, monthLabel, monthName: monthLabel.split('-')[0], isMonth: true };
                let total = 0;

                columnGroups.forEach((column) => {
                    const sum = sourceEntries
                        .filter((entry) => entry.monthYear === monthLabel && normalizeCodeKey(entry.mgrCode2) === column.key)
                        .reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0);
                    row[getReportColumnLabel('mgrCode2', column.label)] = sum;
                    total += sum;
                });

                row.total = total;
                return row;
            });

            const monthRows = buildMonthRows(entries, visibleMonthLabels);
            const prevMonthRows = buildMonthRows(prevEntries, visibleMonthLabels.map((monthLabel) => {
                const [monthName, yearSuffix] = monthLabel.split('-');
                return `${monthName}-${String(Number(`20${yearSuffix}`) - 1).slice(-2)}`;
            }));

            const monthSegmentBreakdown = {};
            const reportRows = [];

            visibleMonthLabels.forEach((monthLabel) => {
                const monthName = monthLabel.split('-')[0];
                const monthEntries = entries.filter((entry) => entry.monthYear === monthLabel);
                const monthRow = buildMonthRows(monthEntries, [monthLabel])[0];
                monthSegmentBreakdown[monthName] = {};
                reportRows.push(monthRow);

                columnGroups.forEach((segment) => {
                    const segmentEntries = monthEntries.filter((entry) => normalizeCodeKey(entry.mgrCode2) === segment.key);
                    const segmentRow = {
                        ...buildMonthRows(segmentEntries, [monthLabel])[0],
                        month: segment.label,
                        monthLabel,
                        monthName,
                        isSegment: true,
                        parentMonth: monthLabel
                    };

                    monthSegmentBreakdown[monthName][normalizeCodeKey(segment.label).toLowerCase()] = segmentRow;
                    reportRows.push(segmentRow);
                });
            });

            const summaryRows = buildSummaryRows(monthRows, columns, prevMonthRows);
            reportRows.push(...summaryRows);

            const response = {
                financialYear,
                month: cleanValue(month),
                year: cleanValue(year),
                monthYear: monthYearFilter,
                reportType: 'SEGMENT',
                mgrCodes: columns,
                mgrColumns: columns,
                monthLabels: visibleMonthLabels,
                monthSegmentBreakdown,
                reconciliation: {
                    sourceTotal: entries.reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0),
                    reportTotal: Number(summaryRows.find((row) => row.isTotal)?.total || 0),
                    matchesSource: entries.reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0) === Number(summaryRows.find((row) => row.isTotal)?.total || 0)
                },
                rows: reportRows
            };
            await setCachedJson(redis, cacheKey, response, PLANNING_REPORT_CACHE_TTL_SECONDS);
            return res.json(response);
        }

        const sbuGroups = buildColumnGroups(entries, 'mgrCode', 'Unassigned', mgr1MasterMap);
        const columns = sbuGroups.map((group) => getReportColumnLabel('mgrCode', group.label));
        const visibleMonthLabels = monthYearFilter
            ? [monthYearFilter]
            : monthLabels;

        const buildSbuValueRow = (label, sourceEntries, flags = {}) => {
            const row = { month: label, ...flags };
            let total = 0;

            sbuGroups.forEach((sbu) => {
                const sum = sourceEntries
                    .filter((entry) => normalizeCodeKey(entry.mgrCode) === sbu.key)
                    .reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0);
                row[getReportColumnLabel('mgrCode', sbu.label)] = sum;
                total += sum;
            });

            row.total = total;
            return row;
        };

        const buildPeriodRows = (sourceEntries, labels = visibleMonthLabels, labelResolver = (monthLabel) => monthLabel) => labels.map((monthLabel) => {
            const sourceMonthLabel = labelResolver(monthLabel);
            const monthEntries = sourceEntries.filter((entry) => entry.monthYear === sourceMonthLabel);
            return buildSbuValueRow(monthLabel, monthEntries, {
                isMonth: true,
                monthLabel,
                monthName: monthLabel.split('-')[0]
            });
        });

        const currentPeriodRows = buildPeriodRows(entries, visibleMonthLabels);
        const prevPeriodRows = buildPeriodRows(prevEntries, visibleMonthLabels, (monthLabel) => {
            const [monthName, yearSuffix] = monthLabel.split('-');
            return `${monthName}-${String(Number(`20${yearSuffix}`) - 1).slice(-2)}`;
        });
        const reportRows = [];
        const monthSegmentBreakdown = {};

        visibleMonthLabels.forEach((monthLabel) => {
            const monthName = monthLabel.split('-')[0];
            const monthEntries = entries.filter((entry) => entry.monthYear === monthLabel);

            reportRows.push(buildSbuValueRow(monthLabel, monthEntries, {
                isMonth: true,
                monthLabel,
                monthName
            }));

            monthSegmentBreakdown[monthName] = {};

            STATUS_SEGMENTS.forEach((segment) => {
                const segmentEntries = monthEntries.filter((entry) => normalizeCodeKey(entry.mgrCode2) === normalizeCodeKey(segment));
                const segmentRow = buildSbuValueRow(segment, segmentEntries, {
                    isSegment: true,
                    parentMonth: monthLabel,
                    monthLabel,
                    monthName
                });
                monthSegmentBreakdown[monthName][normalizeCodeKey(segment).toLowerCase()] = segmentRow;
                reportRows.push(segmentRow);
            });
        });

        const summaryRows = buildSummaryRows(
            currentPeriodRows,
            columns,
            prevPeriodRows
        );
        reportRows.push(...summaryRows);

        const sbuWise = entries.map((entry) => ({
            month: entry.monthYear,
            sbu: cleanValue(entry.mgrCode) || 'Unassigned',
            segment: cleanValue(entry.mgrCode2) || 'Unassigned',
            status: getLabelForColumn(normalizeStatusValue(entry.status)),
            value: getMeasureForEntry(entry, 'value')
        }));

        const response = {
            financialYear,
            month: cleanValue(month),
            year: cleanValue(year),
            monthYear: monthYearFilter,
            reportType: 'SBU',
            mgrCodes: columns,
            mgrColumns: columns,
            monthLabels: visibleMonthLabels,
            monthSegmentBreakdown,
            statusColumns: STATUS_COLUMNS.map(getLabelForColumn),
            statusSegments: [...STATUS_SEGMENTS, 'Total'],
            reconciliation: {
                sourceTotal: entries.reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0),
                reportTotal: Number(summaryRows.find((row) => row.isTotal)?.total || 0),
                matchesSource: entries.reduce((acc, entry) => acc + getMeasureForEntry(entry, 'value'), 0) === Number(summaryRows.find((row) => row.isTotal)?.total || 0)
            },
            sbuWise,
            prevYearStatusTotals: buildStatusBreakdown(prevEntries).Total,
            rows: reportRows
        };
        await setCachedJson(redis, cacheKey, response, PLANNING_REPORT_CACHE_TTL_SECONDS);
        return res.json(response);
    } catch (err) {
        console.error('[Planning Error] getMGRReport:', err);
        res.status(500).json({ message: err.message });
    }
};
