import React, { useState, useEffect } from 'react';
import {
    MdTrendingUp,
    MdDescription,
    MdAttachMoney,
    MdDownload,
    MdSearch,
    MdBarChart,
    MdPeople,
    MdStorefront,
    MdInventory,
    MdAssignment,
    MdCalendarMonth,
    MdNotifications,
    MdRefresh,
    MdKeyboardArrowDown
} from 'react-icons/md';
import { quotationService, analyticsService, planningService, statusService } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { formatToLakhs } from '../utils/formatters';
import * as XLSX from 'xlsx-js-style';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    AreaChart,
    Area
} from 'recharts';

const TABS = [
    { key: 'quotations', label: 'Quotations', icon: <MdDescription size={18} /> },
    { key: 'enquiries', label: 'Enquiries', icon: <MdAssignment size={18} /> },
    { key: 'vendors', label: 'Vendors', icon: <MdStorefront size={18} /> },
    { key: 'products', label: 'Products', icon: <MdInventory size={18} /> },
    { key: 'planning', label: 'Planning', icon: <MdCalendarMonth size={18} /> },
    { key: 'revenuePlan', label: 'Revenue Plan', icon: <MdBarChart size={18} /> },
    { key: 'followups', label: 'Follow-ups', icon: <MdNotifications size={18} /> },
];

const COLORS = ['#6366f1', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const STATUS_COLORS = {
    'New': '#6366f1', 'Follow-up': '#f59e0b', 'Quotation Pending': '#06b6d4',
    'Quotation Received': '#8b5cf6', 'Negotiation': '#ec4899', 'PO Received': '#10b981',
    'Lost': '#ef4444', 'Finalized': '#059669',
};
const REVENUE_SEGMENTS = ['Utility', 'UC', 'Industry', 'Export'];
const REVENUE_STATUS_COLUMNS = ['Firm', 'MFC', 'B&B', 'Invoice'];
const FY_MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const QUARTERS = [
    { key: 'Q1', months: ['Apr', 'May', 'Jun'] },
    { key: 'Q2', months: ['Jul', 'Aug', 'Sep'] },
    { key: 'Q3', months: ['Oct', 'Nov', 'Dec'] },
    { key: 'Q4', months: ['Jan', 'Feb', 'Mar'] }
];
const PLANNING_SEGMENTS = ['Export', 'Industry', 'UC', 'Utility'];
const REVENUE_PLAN_STATUS_OPTIONS = ['Budget', 'Firm', 'MFC', 'B&B', 'Invoice', 'Order Received', 'Lost', 'Parked', 'Other'];
const DEFAULT_REVENUE_PLAN_STATUSES = [];
const REVENUE_PRODUCT_TEMPLATE = [
    { type: 'I', product: '11KV Indoor ' },
    { type: '33K', product: '33KV ID/OD' },
    { type: '11K', product: '11KV Kiosk' },
    { type: 'SPA', product: 'Spares' }
];
const REVENUE_PRODUCT_SEGMENTS = [
    { segment: 'Utility', code: 'UL' },
    { segment: 'UC', code: 'UC' },
    { segment: 'Industry', code: 'IND' },
    { segment: 'Export', code: 'EXP' }
];
const DEFERRED_COLUMNS = [
    'Sr. No.', 'Customer Name', 'Discom', 'Product', 'Qty', 'Rate', 'Values',
    '100% Confidance', 'Extra Efforts', 'Shift to Nov', 'Type', 'Category',
    'Status', 'Confidance', 'Segment', 'Region', 'Remarks', 'CDD',
    'Drawing Submission', 'Drawing Approval', 'Clearance from Engg',
    'Indent Elect', 'Indent Mech'
];

const getFinancialYears = () => {
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return Array.from({ length: 5 }, (_, index) => {
        const start = fyStart - 2 + index;
        return `${start}-${String(start + 1).slice(-2)}`;
    });
};

const getMonthLabels = (financialYear) => {
    const startYear = parseInt(financialYear.split('-')[0], 10);
    return FY_MONTH_NAMES.map((month, index) => `${month}-${String(index < 9 ? startYear : startYear + 1).slice(-2)}`);
};

const getFYSuffix = (fy) => {
    if (!fy) return '27';
    const parts = fy.split('-');
    if (parts.length > 1) return parts[1];
    return fy.slice(-2);
};

const getRevenueWorkbookSheets = (fy) => {
    const suffix = getFYSuffix(fy || '2026-27');
    return [`Summary `, 'Productwise', `Summary Qtr wise`, 'Deffered account Temperarily'];
};

const normalizeRevenueKey = (value = '') => String(value || '').trim().replace(/\s+/g, '').toUpperCase();
const normalizeRevenueSegment = (value = '') => {
    const key = normalizeRevenueKey(value);
    if (key === 'UTILITYCONTRACTOR' || key === 'UC') return 'UC';
    if (key === 'NONUTILITYINDUSTRY' || key === 'IND') return 'Industry';
    if (key === 'UL' || key === 'UTILITY') return 'Utility';
    if (key === 'EXP' || key === 'EXPORT') return 'Export';
    return value || 'Unassigned';
};

const normalizeRevenueStatus = (value = '') => {
    const key = normalizeRevenueKey(value);
    if (key === 'B&B' || key === 'BB' || key === 'BANDB') return 'B&B';
    if (key === 'FIRM') return 'Firm';
    if (key === 'INVOICE') return 'Invoice';
    if (key === 'MFC') return 'MFC';
    return '';
};
const normalizePlanningStatusFilter = (value = '') => {
    const key = normalizeRevenueKey(value);
    if (key === 'B&B' || key === 'BB' || key === 'BANDB') return 'B&B';
    if (key === 'OTHER' || key === 'OTHERS') return 'Other';
    if (key === 'FIRM') return 'Firm';
    if (key === 'MFC') return 'MFC';
    if (key === 'INVOICE') return 'Invoice';
    if (key === 'BUDGET') return 'Budget';
    if (key === 'ORDERRECEIVED') return 'Order Received';
    if (key === 'LOST') return 'Lost';
    if (key === 'PARKED') return 'Parked';
    return String(value || '').trim();
};

const planValue = (value) => Number(value || 0) === 0 ? '-' : formatToLakhs(value, 2);
const planPct = (value) => Number(value || 0) === 0 ? '-' : `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}%`;
const formatReportValue = (value, decimals = 3) => Number(value || 0) === 0 ? '-' : formatToLakhs(value, decimals);
const formatReportPercentage = (value, decimals = 2) =>
    Number(value || 0) === 0 ? '-' : `${Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })}%`;
const getRevenueSegmentLabel = (segment) => segment === 'UC' ? 'Utility Contractor' : segment;
const getRevenueSegmentShortCode = (segment) => REVENUE_PRODUCT_SEGMENTS.find(item => item.segment === normalizeRevenueSegment(segment))?.code || normalizeRevenueSegment(segment);
const inferRevenueProductType = (productName = '') => {
    const key = normalizeRevenueKey(productName);
    if (key.includes('SPARE')) return 'SPA';
    if (key.includes('33KV') || key.includes('33K')) return '33K';
    if (key.includes('KIOSK')) return '11K';
    if (key.includes('11KV') || key.includes('11K') || key.includes('INDOOR')) return 'I';
    return '';
};

const REVENUE_PLAN_COLORS = {
    filter: 'D99694',
    title: 'FFFF00',
    header: '8EB4E3',
    utility: '00FF00',
    utilityContractor: '00FFFF',
    industry: 'DCE6F2',
    export: 'CCC1DA',
    productHeader: 'E6B9B8',
    productMonth: '00B0F0',
    productName: 'FFFF66',
    deferredHeader: 'DBEEF4',
    deferredGroup: 'FAC090',
    deferredTotal: 'FFC000',
    white: 'FFFFFF',
    black: '000000'
};

const cell = (value = '', options = {}) => ({ value, ...options });
const blankRow = (length) => Array.from({ length }, () => '');
const sumValues = (rows = [], key) => rows.reduce((sum, row) => sum + Number(row?.[key] || 0), 0);
const getQuarterMonths = (months = [], quarterIndex) => months.slice(quarterIndex * 3, quarterIndex * 3 + 3);
const getYtdMonths = (months = [], quarterIndex) => months.slice(0, (quarterIndex + 1) * 3);
const getMonthRow = (month, segment) => month?.rows?.find(item => normalizeRevenueKey(item.segment) === normalizeRevenueKey(segment)) || {};

const buildRevenuePlanView = (report) => {
    const monthLabels = report?.monthLabels?.length ? report.monthLabels : getMonthLabels(report?.financialYear || '2026-27');
    const sbuRows = report?.sbuWise || [];
    const segmentSet = new Set(REVENUE_SEGMENTS);
    sbuRows.forEach(row => segmentSet.add(normalizeRevenueSegment(row.segment)));
    const segments = Array.from(segmentSet).filter(Boolean);

    const rows = segments.map(segment => {
        const monthly = monthLabels.map(monthLabel => {
            const rowsForMonth = sbuRows.filter(row =>
                normalizeRevenueKey(row.month) === normalizeRevenueKey(monthLabel)
                && normalizeRevenueKey(normalizeRevenueSegment(row.segment)) === normalizeRevenueKey(segment)
            );
            const budget = rowsForMonth
                .filter(row => normalizePlanningStatusFilter(row.status) === 'Budget')
                .reduce((sum, row) => sum + Number(row.value || 0), 0);
            const statusValues = {};
            REVENUE_STATUS_COLUMNS.forEach(status => {
                statusValues[status] = rowsForMonth
                    .filter(row => normalizeRevenueStatus(row.status) === status)
                    .reduce((sum, row) => sum + Number(row.value || 0), 0);
            });
            const total = Object.values(statusValues).reduce((sum, value) => sum + value, 0);
            return {
                month: monthLabel,
                monthName: monthLabel.split('-')[0],
                budget,
                ...statusValues,
                total
            };
        });

        const yearlyBudgetTotal = monthly.reduce((sum, month) => sum + month.budget, 0);
        const yearlyTotal = monthly.reduce((sum, month) => sum + month.total, 0);
        return {
            segment,
            yearlyBudgetTotal,
            yearlyTotal,
            monthlyAverage: yearlyBudgetTotal / 12,
            quarterlyAverage: yearlyBudgetTotal / 4,
            h2Budget: monthly.slice(6).reduce((sum, month) => sum + month.budget, 0),
            h2Projected: monthly.slice(6).reduce((sum, month) => sum + month.total, 0),
            q1Budget: monthly.slice(0, 3).reduce((sum, month) => sum + month.budget, 0),
            q1Projected: monthly.slice(0, 3).reduce((sum, month) => sum + month.total, 0),
            totalProjected: yearlyTotal,
            monthly
        };
    });

    const grandTotal = rows.reduce((sum, row) => sum + row.yearlyBudgetTotal, 0);
    const projectedGrandTotal = rows.reduce((sum, row) => sum + row.yearlyTotal, 0);
    const months = monthLabels.map(monthLabel => {
        const monthRows = rows.map(row => {
            const month = row.monthly.find(item => item.month === monthLabel);
            return {
                segment: row.segment,
                ...month,
                performance: month.budget > 0 ? (month.total / month.budget) * 100 : 0
            };
        });
        const total = monthRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
        const budget = monthRows.reduce((sum, row) => sum + Number(row.budget || 0), 0);
        return {
            label: monthLabel,
            rows: monthRows,
            total,
            budget,
            variance: total - budget,
            performance: budget > 0 ? (total / budget) * 100 : 0
        };
    });

    const monthsWithData = months.filter(month => month.total > 0 || month.budget > 0);
    const monthLabelsWithData = monthsWithData.map(month => month.label);

    return {
        rows: rows.map(row => ({
            ...row,
            budgetPercent: grandTotal > 0 ? (row.yearlyBudgetTotal / grandTotal) * 100 : 0,
            quarters: QUARTERS.map(quarter => ({
                key: quarter.key,
                value: row.monthly
                    .filter(month => quarter.months.includes(month.monthName))
                    .reduce((sum, month) => sum + month.total, 0)
            }))
        })),
        allMonths: months,
        months: monthsWithData,
        monthLabels: monthLabelsWithData,
        grandTotal,
        projectedGrandTotal,
        monthBudget: grandTotal / 12,
        quarterBudget: grandTotal / 4,
        h2Budget: months.slice(6).reduce((sum, month) => sum + month.budget, 0),
        h2Projected: months.slice(6).reduce((sum, month) => sum + month.total, 0),
        q1Budget: months.slice(0, 3).reduce((sum, month) => sum + month.budget, 0),
        q1Projected: months.slice(0, 3).reduce((sum, month) => sum + month.total, 0)
    };
};

const toSheetRows = (rows) => rows.map(row => row.map(item => typeof item === 'object' && item !== null ? item : cell(item)));

const normalizeHex = (hex = REVENUE_PLAN_COLORS.white) => `#${String(hex).replace('#', '')}`;
const normalizeCellText = (value = '') => String(value || '').trim();
const getRevenueRowLabel = (row = []) => normalizeCellText(row.find(item => normalizeCellText(item.value))?.value);
const getRevenueSegmentFill = (value = '') => {
    const key = normalizeRevenueKey(value);
    if (key === 'UTILITY') return REVENUE_PLAN_COLORS.utility;
    if (key === 'UTILITYCONTRACTOR' || key === 'UC') return REVENUE_PLAN_COLORS.utilityContractor;
    if (key === 'INDUSTRY' || key === 'NONUTILITYINDUSTRY' || key === 'IND') return REVENUE_PLAN_COLORS.industry;
    if (key === 'EXPORT' || key === 'EXP') return REVENUE_PLAN_COLORS.export;
    return '';
};

const getRevenueCellFill = (sheetName = '', rowIndex = 0, cellIndex = 0, row = [], item = {}, options = {}) => {
    const text = normalizeCellText(item.value);
    const rowLabel = getRevenueRowLabel(row);

    if (sheetName.includes('Summary FY') && !sheetName.includes('Qtr')) {
        if (options.filterRows?.includes(rowIndex)) return REVENUE_PLAN_COLORS.filter;
        if (text.includes('Summary of Revenue')) return REVENUE_PLAN_COLORS.title;
        if (options.headerRows?.includes(rowIndex)) return REVENUE_PLAN_COLORS.header;
        if (text === 'Total') return '';
        if (rowLabel === 'Monthly Revenue') return REVENUE_PLAN_COLORS.title;
        return getRevenueSegmentFill(rowLabel);
    }

    if (sheetName.includes('Summary FY') && sheetName.includes('Qtr wise')) {
        if (options.filterRows?.includes(rowIndex)) return '';
        if (text.includes('Summary of Revenue')) return REVENUE_PLAN_COLORS.title;
        if (options.headerRows?.includes(rowIndex)) return REVENUE_PLAN_COLORS.header;
        if (text === 'Total') return '';
        return getRevenueSegmentFill(rowLabel);
    }

    if (sheetName === 'Productwise') {
        if (rowIndex === 0 && cellIndex >= 3) return REVENUE_PLAN_COLORS.productHeader;
        if (rowIndex === 1 && cellIndex >= 3) return REVENUE_PLAN_COLORS.productMonth;
        if (cellIndex === 1 && text) return REVENUE_PLAN_COLORS.productName;
        if ((cellIndex === 0 || cellIndex === 2) && text) return getRevenueSegmentFill(text);
    }

    if (sheetName === 'Deffered account Temperarily') {
        if (text.includes('ULARIA')) return '';
        if (options.headerRows?.includes(rowIndex)) return REVENUE_PLAN_COLORS.deferredHeader;
        if (text === 'GRAND TOTAL') return REVENUE_PLAN_COLORS.deferredTotal;
        if (text === 'Total') return REVENUE_PLAN_COLORS.productName;
        return getRevenueSegmentFill(text) || (text.includes('Utility Contractor Segment') ? REVENUE_PLAN_COLORS.deferredGroup : '');
    }

    return '';
};

const getRevenueCellStyle = (sheetName, rowIndex, cellIndex, row, item, options = {}) => {
    const text = normalizeCellText(item.value);
    const fill = getRevenueCellFill(sheetName, rowIndex, cellIndex, row, item, options);
    const isTitle = text.includes('Summary of Revenue') || text.includes('ULARIA');
    const isHeader = options.headerRows?.includes(rowIndex);
    const isFilter = options.filterRows?.includes(rowIndex);
    const isTotal = text === 'Total' || text === 'GRAND TOTAL';
    const isMonthlyRevenue = sheetName.includes('Summary FY') && !sheetName.includes('Qtr') && getRevenueRowLabel(row) === 'Monthly Revenue';
    const isFirstColumn = cellIndex === 0;
    const isBlank = !text;

    return {
        backgroundColor: fill ? normalizeHex(fill) : REVENUE_PLAN_COLORS.white,
        color: normalizeHex(REVENUE_PLAN_COLORS.black),
        fontWeight: isTitle || isHeader || isFilter || isTotal || isMonthlyRevenue || isFirstColumn ? 800 : 500,
        textAlign: isTitle || isFilter || isFirstColumn ? 'left' : 'right',
        verticalAlign: 'middle',
        height: isBlank && !fill ? '20px' : undefined
    };
};

const getRevenueExportOptions = (sheetName = '') => {
    if (sheetName.includes('Summary FY') && !sheetName.includes('Qtr')) return { headerRows: [1, 2] };
    if (sheetName === 'Productwise') return { headerRows: [0, 1] };
    if (sheetName.includes('Summary FY') && sheetName.includes('Qtr wise')) return { headerRows: [1] };
    if (sheetName === 'Deffered account Temperarily') return { filterRows: [0, 1, 2], headerRows: [5] };
    return {};
};

const buildSummaryWorkbookSheet = (view, financialYear, filters = {}) => {
    const selectedStatuses = filters.statuses?.length ? filters.statuses.join(' / ') : 'All statuses';
    const months = view.allMonths || view.months || [];
    const suffix = getFYSuffix(financialYear);
    const fixedHeaders = ['Segment', 'Yearly Budget', '% Budget', 'Monthly Budget', 'Quarterly Budget', 'H2 Budget', 'H2 Projected ', 'Q1 Budget', ' Q1 Projected', `Total Projected FY${suffix}`];
    const header1 = [...fixedHeaders];
    const header2 = blankRow(fixedHeaders.length);

    months.forEach((month, index) => {
        header1.push(cell(month.label, { colSpan: 5 }), '%');
        header2.push('FIRM', 'MFC', 'B&B', 'Invoice', 'Total', '');

        if ((index + 1) % 3 === 0) {
            const quarterNo = Math.floor(index / 3) + 1;
            header1.push(cell(`Total Q${quarterNo}`, { colSpan: 5 }), '', `YTD Q${quarterNo} Budget`, `YTD Q${quarterNo} Projected`, '% Performance');
            header2.push('FIRM', 'MFC', 'B&B', 'Invoice', 'Total', '', '', '', '');
        }
    });

    const rows = [
        [cell(`Summary of Revenue (Rs L) for Financial Year ${financialYear}`, { colSpan: header1.length })],
        header1,
        header2
    ];

    view.rows.forEach(row => {
        const data = [
            getRevenueSegmentLabel(row.segment),
            planValue(row.yearlyBudgetTotal),
            planPct(row.budgetPercent),
            planValue(row.monthlyAverage),
            planValue(row.quarterlyAverage),
            planValue(row.h2Budget),
            planValue(row.h2Projected),
            planValue(row.q1Budget),
            planValue(row.q1Projected),
            planValue(row.totalProjected)
        ];

        months.forEach((month, index) => {
            const monthRow = getMonthRow(month, row.segment);
            data.push(
                planValue(monthRow.Firm),
                planValue(monthRow.MFC),
                planValue(monthRow['B&B']),
                planValue(monthRow.Invoice),
                planValue(monthRow.total),
                planPct(monthRow.performance)
            );

            if ((index + 1) % 3 === 0) {
                const quarterIndex = Math.floor(index / 3);
                const quarterMonths = getQuarterMonths(months, quarterIndex);
                const ytdMonths = getYtdMonths(months, quarterIndex);
                const quarterRows = quarterMonths.map(item => getMonthRow(item, row.segment));
                const ytdBudget = ytdMonths.reduce((sum, item) => sum + Number(getMonthRow(item, row.segment).budget || 0), 0);
                const ytdProjected = ytdMonths.reduce((sum, item) => sum + Number(getMonthRow(item, row.segment).total || 0), 0);
                data.push(
                    planValue(sumValues(quarterRows, 'Firm')),
                    planValue(sumValues(quarterRows, 'MFC')),
                    planValue(sumValues(quarterRows, 'B&B')),
                    planValue(sumValues(quarterRows, 'Invoice')),
                    planValue(sumValues(quarterRows, 'total')),
                    '',
                    planValue(ytdBudget),
                    planValue(ytdProjected),
                    planPct(ytdBudget > 0 ? (ytdProjected / ytdBudget) * 100 : 0)
                );
            }
        });
        rows.push(data);
    });

    const totalRow = ['Total', planValue(view.grandTotal), '', planValue(view.monthBudget), planValue(view.quarterBudget), planValue(view.h2Budget), planValue(view.h2Projected), planValue(view.q1Budget), planValue(view.q1Projected), planValue(view.projectedGrandTotal)];
    months.forEach((month, index) => {
        totalRow.push(
            planValue(sumValues(month.rows, 'Firm')),
            planValue(sumValues(month.rows, 'MFC')),
            planValue(sumValues(month.rows, 'B&B')),
            planValue(sumValues(month.rows, 'Invoice')),
            planValue(month.total),
            planPct(month.performance)
        );
        if ((index + 1) % 3 === 0) {
            const quarterIndex = Math.floor(index / 3);
            const quarterMonths = getQuarterMonths(months, quarterIndex);
            const ytdMonths = getYtdMonths(months, quarterIndex);
            const quarterRows = quarterMonths.flatMap(item => item.rows || []);
            const ytdBudget = ytdMonths.reduce((sum, item) => sum + Number(item.budget || 0), 0);
            const ytdProjected = ytdMonths.reduce((sum, item) => sum + Number(item.total || 0), 0);
            totalRow.push(
                planValue(sumValues(quarterRows, 'Firm')),
                planValue(sumValues(quarterRows, 'MFC')),
                planValue(sumValues(quarterRows, 'B&B')),
                planValue(sumValues(quarterRows, 'Invoice')),
                planValue(quarterMonths.reduce((sum, item) => sum + Number(item.total || 0), 0)),
                '',
                planValue(ytdBudget),
                planValue(ytdProjected),
                planPct(ytdBudget > 0 ? (ytdProjected / ytdBudget) * 100 : 0)
            );
        }
    });
    rows.push(totalRow);

    const metricRows = [
        'Monthly Revenue ',
        `Budget  (Total Revenue: ${Math.round(view.grandTotal / 100)} Cr)`,
        'Cumulative Budget',
        'Asking Rate',
        'Variance wrt monthly Budget',
        'Variance wrt YTD Budget',
        'Cumulative Revenue '
    ];

    metricRows.forEach(label => {
        const row = [label, '', '', '', '', '', '', '', '', ''];
        months.forEach((month, index) => {
            const ytdBudget = months.slice(0, index + 1).reduce((sum, item) => sum + Number(item.budget || 0), 0);
            const ytdRevenue = months.slice(0, index + 1).reduce((sum, item) => sum + Number(item.total || 0), 0);
            const remainingMonths = Math.max(12 - index, 1);
            const askingRate = (view.grandTotal - months.slice(0, index).reduce((sum, item) => sum + Number(item.total || 0), 0)) / remainingMonths;
            const value = label === 'Monthly Revenue '
                ? month.total
                : label.startsWith('Budget')
                    ? month.budget
                    : label === 'Cumulative Budget'
                        ? ytdBudget
                        : label === 'Asking Rate'
                            ? askingRate
                            : label === 'Variance wrt monthly Budget'
                                ? month.total - month.budget
                                : label === 'Variance wrt YTD Budget'
                                    ? ytdRevenue - ytdBudget
                                    : ytdRevenue;
            row.push(cell(planValue(value), { colSpan: 5 }), '');

            if ((index + 1) % 3 === 0) {
                row.push(cell('', { colSpan: 5 }), '', '', '', '');
            }
        });
        rows.push(row);
    });

    return { name: `Summary FY${suffix}`, rows: toSheetRows(rows) };
};

const buildQuarterWorkbookSheet = (view, financialYear) => {
    const rows = [
        [cell(`Summary of Revenue (Rs L) for Financial Year ${financialYear}`, { colSpan: 7 })],
        ['Segment', 'Yearly Budget', 'Q1', 'Q2', 'Q3', 'Q4', 'Total']
    ];

    rows.push(blankRow(7));
    view.rows.forEach(row => {
        rows.push([
            getRevenueSegmentLabel(row.segment),
            planValue(row.yearlyBudgetTotal),
            ...row.quarters.map(quarter => planValue(quarter.value)),
            planValue(row.totalProjected)
        ]);
    });

    rows.push(blankRow(7));
    rows.push([
        'Total',
        planValue(view.grandTotal),
        ...QUARTERS.map(quarter => planValue((view.allMonths || view.months)
            .filter(month => quarter.months.includes(month.label.split('-')[0]))
            .reduce((sum, month) => sum + month.total, 0))),
        planValue(view.projectedGrandTotal)
    ]);

    const suffix = getFYSuffix(financialYear);
    return { name: `Summary FY${suffix}_Qtr wise`, rows: toSheetRows(rows) };
};

const buildProductwiseWorkbookSheet = (entries = [], monthLabels = []) => {
    const rows = [
        [100, '', '', ...monthLabels.map(() => 'Value'), ...monthLabels.map(() => 'Qty')],
        ['', '', '', ...monthLabels, ...monthLabels]
    ];

    const groupMap = new Map();
    entries.forEach(entry => {
        const productName = entry.productName || entry.productId?.productName || 'Product';
        const key = `${productName}|${normalizeRevenueSegment(entry.mgrCode2)}`;
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                product: productName,
                category: normalizeRevenueSegment(entry.mgrCode2),
                type: inferRevenueProductType(productName) || entry.mgrCode || '',
                values: {},
                qty: {}
            });
        }
        const group = groupMap.get(key);
        group.values[entry.monthYear] = Number(group.values[entry.monthYear] || 0) + Number(entry.totalValue || (Number(entry.qty || 0) * Number(entry.value || 0)));
        group.qty[entry.monthYear] = Number(group.qty[entry.monthYear] || 0) + Number(entry.qty || 0);
    });

    const matchedKeys = new Set();

    REVENUE_PRODUCT_SEGMENTS.forEach(({ segment, code }) => {
        REVENUE_PRODUCT_TEMPLATE.forEach(template => {
            const matches = Array.from(groupMap.entries()).filter(([, group]) =>
                normalizeRevenueKey(group.type) === normalizeRevenueKey(template.type)
                && normalizeRevenueKey(group.category) === normalizeRevenueKey(segment)
            );
            matches.forEach(([key]) => matchedKeys.add(key));
            rows.push([
                template.type,
                template.product,
                code,
                ...monthLabels.map(month => planValue(matches.reduce((sum, [, group]) => sum + Number(group.values[month] || 0), 0))),
                ...monthLabels.map(month => matches.reduce((sum, [, group]) => sum + Number(group.qty[month] || 0), 0) || '-')
            ]);
        });
        rows.push(blankRow(3 + (monthLabels.length * 2)));
    });

    // Append unmatched entries so no data is silently dropped
    const unmatchedGroups = Array.from(groupMap.entries()).filter(([key]) => !matchedKeys.has(key));
    if (unmatchedGroups.length > 0) {
        rows.push(['Others', '', '', ...monthLabels.map(() => ''), ...monthLabels.map(() => '')]);
        unmatchedGroups.forEach(([, group]) => {
            rows.push([
                group.type || '-',
                group.product,
                group.category,
                ...monthLabels.map(month => planValue(group.values[month])),
                ...monthLabels.map(month => Number(group.qty[month] || 0) || '-')
            ]);
        });
        rows.push(blankRow(3 + (monthLabels.length * 2)));
    }

    return { name: 'Productwise', rows: toSheetRows(rows) };
};

const buildDeferredWorkbookSheet = (entries = []) => {
    const rows = [
        ['Ref:', 'STL/ULA/Rev/Oct'],
        ['Rev', '0'],
        ['Date', ''],
        blankRow(DEFERRED_COLUMNS.length),
        [cell('ULARIA - Deffered account temporarily', { colSpan: DEFERRED_COLUMNS.length })],
        DEFERRED_COLUMNS
    ];

    entries.forEach((entry, index) => {
        const customerName = entry.customerName || entry.customerId?.customerName || '';
        const productName = entry.productName || entry.productId?.productName || '';
        rows.push([
            index + 1,
            customerName,
            customerName,
            productName,
            Number(entry.qty || 0) || '',
            Number(entry.value || 0) || '',
            planValue(entry.totalValue || (Number(entry.qty || 0) * Number(entry.value || 0))),
            planValue(entry.totalValue || (Number(entry.qty || 0) * Number(entry.value || 0))),
            '',
            '',
            entry.mgrCode || '',
            normalizeRevenueSegment(entry.mgrCode2),
            entry.status || '',
            '',
            getRevenueSegmentShortCode(entry.mgrCode2),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            ''
        ]);
    });

    return { name: 'Deffered account Temperarily', rows: toSheetRows(rows) };
};

const buildRevenueWorkbookSheets = (report, entries = [], financialYear = '', filters = {}) => {
    const view = buildRevenuePlanView(report);
    const monthLabels = report?.monthLabels?.length ? report.monthLabels : getMonthLabels(financialYear || report?.financialYear || '2026-27');
    return [
        buildSummaryWorkbookSheet(view, financialYear || report?.financialYear || '', filters),
        buildProductwiseWorkbookSheet(entries, monthLabels),
        buildQuarterWorkbookSheet(view, financialYear || report?.financialYear || ''),
        buildDeferredWorkbookSheet(entries)
    ];
};

const flattenSheetRows = (rows = []) => rows.map(row => {
    const flattened = [];
    row.forEach(item => {
        flattened.push(item.value ?? '');
        for (let i = 1; i < Number(item.colSpan || 1); i += 1) {
            flattened.push('');
        }
    });
    return flattened;
});

const revenueSheetToWorksheet = (sheet) => {
    const aoa = flattenSheetRows(sheet.rows);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const merges = [];
    const styleOptions = getRevenueExportOptions(sheet.name);

    sheet.rows.forEach((row, rowIndex) => {
        let colIndex = 0;
        row.forEach(item => {
            const span = Number(item.colSpan || 1);
            if (span > 1) {
                merges.push({
                    s: { r: rowIndex, c: colIndex },
                    e: { r: rowIndex, c: colIndex + span - 1 }
                });
            }
            colIndex += span;
        });
    });

    if (merges.length) {
        ws['!merges'] = merges;
    }

    sheet.rows.forEach((row, rowIndex) => {
        let colIndex = 0;
        row.forEach(item => {
            const span = Number(item.colSpan || 1);
            for (let offset = 0; offset < span; offset += 1) {
                const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex + offset });
                if (!ws[address]) ws[address] = { t: 's', v: '' };
                const fill = getRevenueCellFill(sheet.name, rowIndex, colIndex, row, item, styleOptions);
                const text = normalizeCellText(item.value);
                const isHeader = styleOptions.headerRows?.includes(rowIndex);
                const isFilter = styleOptions.filterRows?.includes(rowIndex);
                const isTitle = text.includes('Summary of Revenue') || text.includes('ULARIA');
                const isTotal = text === 'Total' || text === 'GRAND TOTAL';
                ws[address].s = {
                    font: { bold: Boolean(isHeader || isFilter || isTitle || isTotal || colIndex === 0), color: { rgb: REVENUE_PLAN_COLORS.black } },
                    alignment: { horizontal: isTitle || isFilter || colIndex === 0 ? 'left' : 'right', vertical: 'center', wrapText: false },
                    border: {
                        top: { style: 'thin', color: { rgb: REVENUE_PLAN_COLORS.black } },
                        right: { style: 'thin', color: { rgb: REVENUE_PLAN_COLORS.black } },
                        bottom: { style: 'thin', color: { rgb: REVENUE_PLAN_COLORS.black } },
                        left: { style: 'thin', color: { rgb: REVENUE_PLAN_COLORS.black } }
                    }
                };
                if (fill) {
                    ws[address].s.fill = { patternType: 'solid', fgColor: { rgb: fill } };
                }
            }
            colIndex += span;
        });
    });

    const colCount = aoa.reduce((max, row) => Math.max(max, row.length), 0);
    ws['!rows'] = aoa.map((row, rowIndex) => {
        const options = getRevenueExportOptions(sheet.name);
        const rowText = row.join(' ');
        if (rowText.includes('Summary of Revenue') || rowText.includes('ULARIA')) return { hpt: 22 };
        if (options.headerRows?.includes(rowIndex) || options.filterRows?.includes(rowIndex)) return { hpt: 20 };
        return { hpt: 18 };
    });
    ws['!cols'] = Array.from({ length: colCount }, (_, index) => {
        if (sheet.name.startsWith('Summary FY') && !sheet.name.includes('_Qtr')) {
            if (index === 0) return { wch: 22 };
            if (index < 10) return { wch: 13 };
            return { wch: 9 };
        }
        if (sheet.name === 'Productwise') {
            if (index === 0) return { wch: 8 };
            if (index === 1) return { wch: 22 };
            if (index === 2) return { wch: 10 };
            return { wch: 11 };
        }
        if (sheet.name === 'Deffered account Temperarily') {
            return { wch: [8, 22, 18, 32, 10, 10, 14, 18, 16, 15, 10, 10, 12, 14, 12, 12, 34][index] || 14 };
        }
        return { wch: index === 0 ? 20 : 12 };
    });

    return ws;
};

const StatCard = ({ icon, label, value, color = 'primary' }) => {
    const colorMap = {
        primary: 'bg-primary-50 text-primary-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        rose: 'bg-rose-50 text-rose-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        violet: 'bg-violet-50 text-violet-600',
    };
    return (
        <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
            <div className={`w-12 h-12 ${colorMap[color]} rounded-2xl flex items-center justify-center mb-4`}>
                {icon}
            </div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</h3>
            <p className="text-2xl font-black text-slate-900 font-outfit tracking-tighter">{value}</p>
        </div>
    );
};

const Reports = () => {
    const [activeTab, setActiveTab] = useState('quotations');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter] = useState({ start: '', end: '' });

    // Quotation data
    const [reportData, setReportData] = useState(null);
    const [allQuotations, setAllQuotations] = useState([]);

    // Enquiry data
    const [enquirySummary, setEnquirySummary] = useState(null);
    const [enquiryStages, setEnquiryStages] = useState([]);
    const [enquiryTrends, setEnquiryTrends] = useState([]);

    // Vendor data
    const [vendorData, setVendorData] = useState([]);

    // Product data
    const [productData, setProductData] = useState([]);

    // Planning data
    const [planningReport, setPlanningReport] = useState(null);
    const [planningFY, setPlanningFY] = useState('');
    const [expandedPlanningMonths, setExpandedPlanningMonths] = useState({});

    // Follow-up data
    const [followUpData, setFollowUpData] = useState(null);

    // Revenue plan data
    const [revenuePlanReport, setRevenuePlanReport] = useState(null);
    const [revenuePlanEntries, setRevenuePlanEntries] = useState([]);
    const [revenuePlanFY, setRevenuePlanFY] = useState('');
    const [revenuePlanSheet, setRevenuePlanSheet] = useState('Summary FY27');
    const [expandedRevenueMonths, setExpandedRevenueMonths] = useState({});
    const [revenuePlanError, setRevenuePlanError] = useState('');
    const [revenuePlanFilters, setRevenuePlanFilters] = useState({
        mgr1: '',
        segment: '',
        statuses: DEFAULT_REVENUE_PLAN_STATUSES
    });
    const [statusOptions, setStatusOptions] = useState([]);

    useEffect(() => {
        const fetchStatuses = async () => {
            try {
                const res = await statusService.getAll();
                const activeStatuses = res.data.filter(s => s.isActive).map(s => s.name);
                setStatusOptions(activeStatuses);
            } catch (err) {
                console.error('Error fetching statuses:', err);
            }
        };
        fetchStatuses();
    }, []);

    useEffect(() => {
        // Set default FY
        const now = new Date();
        const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const fy = `${fyStart}-${String(fyStart + 1).slice(-2)}`;
        setPlanningFY(fy);
        setRevenuePlanFY(fy);
    }, []);

    useEffect(() => {
        if (revenuePlanFY) {
            const suffix = getFYSuffix(revenuePlanFY);
            setRevenuePlanSheet(prev => {
                if (prev.startsWith('Summary FY') && prev.endsWith('_Qtr wise')) {
                    return `Summary FY${suffix}_Qtr wise`;
                } else if (prev.startsWith('Summary FY')) {
                    return `Summary FY${suffix}`;
                }
                return prev;
            });
        }
    }, [revenuePlanFY]);

    useEffect(() => {
        fetchTabData(activeTab);
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'revenuePlan') {
            fetchTabData('revenuePlan');
        }
    }, [revenuePlanFilters, revenuePlanFY]);

    const fetchTabData = async (tab) => {
        setLoading(true);
        try {
            const params = {};
            if (dateFilter.start) params.from = dateFilter.start;
            if (dateFilter.end) params.to = dateFilter.end;

            switch (tab) {
                case 'quotations': {
                    const [reportRes, qtnRes] = await Promise.all([
                        quotationService.getReports(),
                        quotationService.getAll()
                    ]);
                    setReportData(reportRes.data);
                    setAllQuotations(qtnRes.data);
                    break;
                }
                case 'enquiries': {
                    const [summaryRes, stagesRes, trendsRes] = await Promise.all([
                        analyticsService.getSummary(params),
                        analyticsService.getStages(params),
                        analyticsService.getTrends('monthly', params)
                    ]);
                    setEnquirySummary(summaryRes.data);
                    setEnquiryStages(stagesRes.data);
                    setEnquiryTrends(trendsRes.data);
                    break;
                }
                case 'vendors': {
                    const res = await analyticsService.getVendors(params);
                    setVendorData(res.data);
                    break;
                }
                case 'products': {
                    const res = await analyticsService.getProducts(params);
                    setProductData(res.data);
                    break;
                }
                case 'planning': {
                    if (planningFY) {
                        const res = await planningService.getMGRReport(planningFY, 'SBU', { excludeStatus: 'Budget' });
                        setPlanningReport(res.data);
                    }
                    break;
                }
                case 'followups': {
                    const res = await analyticsService.getFollowUps(params);
                    setFollowUpData(res.data);
                    break;
                }
                case 'revenuePlan': {
                    const fy = revenuePlanFY || planningFY;
                    if (fy) {
                        setRevenuePlanError('');
                        const reportStatus = (revenuePlanFilters.statuses || []).join(',');
                        const reportFilters = {};
                        if (reportStatus) {
                            reportFilters.status = reportStatus;
                        }
                        if (revenuePlanFilters.mgr1) reportFilters.mgr1 = revenuePlanFilters.mgr1;
                        if (revenuePlanFilters.segment) reportFilters.mgr2 = revenuePlanFilters.segment;
                        const entryFilters = { financialYear: fy, limit: 100000, offset: 0 };
                        if (reportStatus) {
                            entryFilters.status = reportStatus;
                        }

                        const [reportRes, entriesRes] = await Promise.all([
                            planningService.getMGRReport(fy, 'SBU', reportFilters),
                            planningService.getAll(entryFilters)
                        ]);
                        setRevenuePlanReport(reportRes.data);
                        setRevenuePlanEntries(entriesRes.data?.data || []);
                    }
                    break;
                }
            }
        } catch (err) {
            console.error(`Error fetching ${tab} data:`, err);
            if (tab === 'revenuePlan') {
                setRevenuePlanError(err.message || 'Revenue plan data could not be loaded');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => fetchTabData(activeTab);

    const getFilteredRevenuePlanEntries = (entries = revenuePlanEntries) => {
        const selectedStatuses = new Set((revenuePlanFilters.statuses || []).map(normalizePlanningStatusFilter));
        return (entries || []).filter(entry => {
            const matchesMgr1 = revenuePlanFilters.mgr1 ? normalizeRevenueKey(entry.mgrCode) === normalizeRevenueKey(revenuePlanFilters.mgr1) : true;
            const matchesSegment = revenuePlanFilters.segment ? normalizeRevenueKey(normalizeRevenueSegment(entry.mgrCode2)) === normalizeRevenueKey(revenuePlanFilters.segment) : true;
            const matchesStatus = selectedStatuses.size
                ? selectedStatuses.has(normalizePlanningStatusFilter(entry.status))
                : true;
            return matchesMgr1 && matchesSegment && matchesStatus;
        });
    };

    const toggleRevenuePlanStatusFilter = (status) => {
        setRevenuePlanFilters(prev => {
            const hasStatus = prev.statuses.includes(status);
            return {
                ...prev,
                statuses: hasStatus
                    ? prev.statuses.filter(item => item !== status)
                    : [...prev.statuses, status]
            };
        });
    };

    const resetRevenuePlanFilters = () => {
        setRevenuePlanFilters({
            mgr1: '',
            segment: '',
            statuses: DEFAULT_REVENUE_PLAN_STATUSES
        });
    };

    // Excel exports per tab
    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        let ws, fileName;

        switch (activeTab) {
            case 'quotations': {
                const data = allQuotations.map(q => ({
                    'Quotation No': q.quotationNo,
                    'Date': new Date(q.createdAt).toLocaleDateString(),
                    'Customer': q.customerId?.customerName || q.customerName,
                    'Company': q.customerId?.companyName || 'N/A',
                    'Subtotal': q.subtotal,
                    'GST': q.grandTotal - q.subtotal,
                    'Grand Total': q.grandTotal,
                    'Status': q.status,
                    'Created By': q.createdBy?.name || 'Admin'
                }));
                ws = XLSX.utils.json_to_sheet(data);
                fileName = 'Quotation_Report';
                break;
            }
            case 'enquiries': {
                const stageData = (enquiryStages || []).map(s => ({ Stage: s._id || s.status, Count: s.count }));
                ws = XLSX.utils.json_to_sheet(stageData);
                fileName = 'Enquiry_Report';
                break;
            }
            case 'vendors': {
                const data = (vendorData || []).map(v => ({
                    'Vendor': v._id || v.vendorName,
                    'Quotes': v.quoteCount || 0,
                    'Wins': v.winCount || 0,
                    'Losses': v.lossCount || 0,
                    'Win %': v.winCount && v.quoteCount ? ((v.winCount / v.quoteCount) * 100).toFixed(1) + '%' : '0%',
                    'Avg Price': v.avgPrice ? Math.round(v.avgPrice) : 0
                }));
                ws = XLSX.utils.json_to_sheet(data);
                fileName = 'Vendor_Report';
                break;
            }
            case 'products': {
                const data = (productData || []).map(p => ({
                    'Product': p._id || p.productName,
                    'Enquiries': p.enquiryCount || 0,
                    'Conversion %': p.conversionRate ? p.conversionRate.toFixed(1) + '%' : '0%',
                    'Vendors': p.vendorCount || 0,
                    'Lost': p.lostCount || 0
                }));
                ws = XLSX.utils.json_to_sheet(data);
                fileName = 'Product_Report';
                break;
            }
            case 'planning': {
                if (planningReport?.rows) {
                    const data = planningReport.rows.map(r => {
                        const row = { Month: r.month };
                        if (r.mgrType) {
                            row['MGR Type'] = r.mgrType;
                        }
                        (planningReport.mgrColumns || []).forEach(col => {
                            row[col] = r[col] || 0;
                        });
                        row['Total'] = r.total || 0;
                        return row;
                    });
                    ws = XLSX.utils.json_to_sheet(data);
                } else {
                    ws = XLSX.utils.json_to_sheet([{ Message: 'No planning data' }]);
                }
                fileName = 'Planning_Report';
                break;
            }
            case 'followups': {
                const all = [
                    ...(followUpData?.overdue || []).map(f => ({ ...f, Category: 'Overdue' })),
                    ...(followUpData?.today || []).map(f => ({ ...f, Category: 'Today' })),
                    ...(followUpData?.upcoming || []).map(f => ({ ...f, Category: 'Upcoming' })),
                ];
                const data = all.map(f => ({
                    'Category': f.Category,
                    'Enquiry No': f.enquiryNo,
                    'Customer': f.customerName,
                    'Follow-up Date': f.followUpDate ? new Date(f.followUpDate).toLocaleDateString() : '',
                    'Status': f.status,
                    'Probability': f.probability ? f.probability + '%' : ''
                }));
                ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Message: 'No follow-up data' }]);
                fileName = 'FollowUp_Report';
                break;
            }
            case 'revenuePlan': {
                const sheets = buildRevenueWorkbookSheets(revenuePlanReport, getFilteredRevenuePlanEntries(), revenuePlanFY, revenuePlanFilters);
                sheets.forEach(sheet => {
                    const sheetWs = revenueSheetToWorksheet(sheet);
                    XLSX.utils.book_append_sheet(wb, sheetWs, sheet.name.slice(0, 31));
                });
                XLSX.writeFile(wb, `Revenue_Plan_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
                return;
            }
        }

        XLSX.utils.book_append_sheet(wb, ws, activeTab);
        XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filteredQuotations = allQuotations.filter(q => {
        const matchesSearch = (q.quotationNo + q.customerName + (q.customerId?.customerName || '')).toLowerCase().includes(searchTerm.toLowerCase());
        const qDate = new Date(q.createdAt);
        const matchesStart = !dateFilter.start || qDate >= new Date(dateFilter.start);
        const matchesEnd = !dateFilter.end || qDate <= new Date(dateFilter.end);
        return matchesSearch && matchesStart && matchesEnd;
    });

    // ——— Tab Content Renderers ———

    const renderQuotations = () => {
        if (!reportData) return null;
        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon={<MdDescription size={24} />} label="Total Quotations" value={reportData.summary.totalQuotations} color="primary" />
                    <StatCard icon={<MdAttachMoney size={24} />} label="Total Revenue (Ordered)" value={`₹${reportData.summary.totalValue?.toLocaleString()}`} color="emerald" />
                    <StatCard icon={<MdTrendingUp size={24} />} label="Conversion Rate" value={`${reportData.summary.totalQuotations > 0 ? ((reportData.summary.statusBreakdown.ordered / reportData.summary.totalQuotations) * 100).toFixed(1) : 0}%`} color="amber" />
                    <StatCard icon={<MdBarChart size={24} />} label="Draft Count" value={`${reportData.summary.statusBreakdown.draft || 0}`} color="indigo" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-lg font-black text-slate-900 uppercase">Revenue Growth Trend</h2>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-primary-600 rounded-full"></span>
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Monthly Sales</span>
                            </div>
                        </div>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={reportData.monthlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                    <YAxis hide />
                                    <Tooltip cursor={{ fill: '#f8fafc', radius: 12 }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="total" radius={[8, 8, 8, 8]} barSize={40}>
                                        {reportData.monthlyTrend.map((_, i) => (
                                            <Cell key={i} fill={i === reportData.monthlyTrend.length - 1 ? '#0d9488' : '#e2e8f0'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-black text-slate-900 uppercase mb-8">Quotation Funnel</h2>
                        <div className="space-y-4">
                            {Object.entries(reportData.summary.statusBreakdown || {}).map(([status, count]) => (
                                <div key={status} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{status}</span>
                                        <span className="text-lg font-black text-slate-900">{count}</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div className={`h-full ${status === 'ordered' ? 'bg-emerald-500' : status === 'final' ? 'bg-primary-600' : 'bg-amber-400'}`}
                                            style={{ width: `${(count / (reportData.summary.totalQuotations || 1)) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quotation table */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Transaction Log</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Detailed quotation history</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 font-bold text-sm w-56 transition-all" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quote #</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Company</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Value</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredQuotations.map(q => (
                                    <tr key={q._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-black text-slate-900">#{q.quotationNo}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{q.customerId?.customerName || q.customerName}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-500">{q.customerId?.companyName || 'N/A'}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm font-black text-slate-900">{formatCurrency(q.grandTotal)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${q.status === 'ordered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : q.status === 'final' ? 'bg-primary-50 text-primary-600 border border-primary-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                                {q.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderEnquiries = () => {
        if (!enquirySummary) return null;
        const stageChartData = (enquiryStages || []).map(s => ({ name: s._id || s.status, value: s.count }));

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon={<MdAssignment size={24} />} label="Total Enquiries" value={enquirySummary.total || 0} color="primary" />
                    <StatCard icon={<MdTrendingUp size={24} />} label="Conversion Rate" value={`${(enquirySummary.conversionRate || 0).toFixed(1)}%`} color="emerald" />
                    <StatCard icon={<MdNotifications size={24} />} label="Overdue Follow-ups" value={enquirySummary.overdueCount || 0} color="rose" />
                    <StatCard icon={<MdDescription size={24} />} label="Avg Probability" value={`${(enquirySummary.avgProbability || 0).toFixed(0)}%`} color="amber" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Stage distribution */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-black text-slate-900 uppercase mb-6">Stage Distribution</h2>
                        {stageChartData.length > 0 ? (
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <BarChart data={stageChartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                        <YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                                        <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                                            {stageChartData.map((entry, i) => (
                                                <Cell key={i} fill={STATUS_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm font-semibold text-center py-12">No stage data available</p>
                        )}
                    </div>

                    {/* Trends */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-black text-slate-900 uppercase mb-6">Monthly Trends</h2>
                        {enquiryTrends.length > 0 ? (
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <AreaChart data={enquiryTrends}>
                                        <defs>
                                            <linearGradient id="colorEnquiries" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                        <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#colorEnquiries)" name="Enquiries" />
                                        <Area type="monotone" dataKey="wonCount" stroke="#10b981" strokeWidth={2} fill="url(#colorWon)" name="Won" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm font-semibold text-center py-12">No trend data available</p>
                        )}
                    </div>
                </div>

                {/* Stage breakdown table */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <h2 className="text-lg font-black text-slate-900">Stage Breakdown</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stage</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Count</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">% of Total</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {stageChartData.map(s => {
                                    const pct = enquirySummary.total > 0 ? ((s.value / enquirySummary.total) * 100).toFixed(1) : 0;
                                    return (
                                        <tr key={s.name} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{s.name}</td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-900">{s.value}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-slate-500">{pct}%</td>
                                            <td className="px-6 py-4 w-48">
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s.name] || '#6366f1' }}></div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderVendors = () => {
        if (!vendorData || vendorData.length === 0) {
            return <div className="text-center py-20 text-slate-400 font-semibold">No vendor data available</div>;
        }

        const topVendors = [...vendorData].sort((a, b) => (b.quoteCount || 0) - (a.quoteCount || 0)).slice(0, 8);
        const chartData = topVendors.map(v => ({
            name: v._id || v.vendorName || 'Unknown',
            quotes: v.quoteCount || 0,
            wins: v.winCount || 0
        }));

        const bestWinRatio = [...vendorData].sort((a, b) => {
            const ratioA = a.quoteCount ? (a.winCount || 0) / a.quoteCount : 0;
            const ratioB = b.quoteCount ? (b.winCount || 0) / b.quoteCount : 0;
            return ratioB - ratioA;
        })[0];

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon={<MdStorefront size={24} />} label="Total Vendors" value={vendorData.length} color="primary" />
                    <StatCard icon={<MdTrendingUp size={24} />} label="Most Active" value={topVendors[0]?._id || topVendors[0]?.vendorName || '-'} color="emerald" />
                    <StatCard icon={<MdBarChart size={24} />} label="Best Win Ratio" value={bestWinRatio?._id || bestWinRatio?.vendorName || '-'} color="violet" />
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900 uppercase mb-6">Top Vendors — Quotes vs Wins</h2>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="quotes" fill="#e2e8f0" radius={[8, 8, 0, 0]} barSize={32} name="Quotes" />
                                <Bar dataKey="wins" fill="#10b981" radius={[8, 8, 0, 0]} barSize={32} name="Wins" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <h2 className="text-lg font-black text-slate-900">Vendor Performance Table</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quotes</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Wins</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Losses</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Win %</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {vendorData.map((v, i) => {
                                    const winPct = v.quoteCount ? ((v.winCount || 0) / v.quoteCount * 100).toFixed(1) : '0.0';
                                    return (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{v._id || v.vendorName}</td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-900">{v.quoteCount || 0}</td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600">{v.winCount || 0}</td>
                                            <td className="px-6 py-4 text-sm font-black text-rose-500">{v.lossCount || 0}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${parseFloat(winPct) >= 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    {winPct}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-500">{v.avgPrice ? formatCurrency(Math.round(v.avgPrice)) : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderProducts = () => {
        if (!productData || productData.length === 0) {
            return <div className="text-center py-20 text-slate-400 font-semibold">No product data available</div>;
        }

        const topProducts = [...productData].sort((a, b) => (b.enquiryCount || 0) - (a.enquiryCount || 0)).slice(0, 10);
        const chartData = topProducts.map(p => ({
            name: (p._id || p.productName || 'Unknown').substring(0, 20),
            enquiries: p.enquiryCount || 0,
            converted: p.convertedCount || 0
        }));

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon={<MdInventory size={24} />} label="Products Tracked" value={productData.length} color="primary" />
                    <StatCard icon={<MdTrendingUp size={24} />} label="Most Enquired" value={(topProducts[0]?._id || topProducts[0]?.productName || '-').substring(0, 25)} color="emerald" />
                    <StatCard icon={<MdBarChart size={24} />} label="Total Enquiries" value={productData.reduce((s, p) => s + (p.enquiryCount || 0), 0)} color="violet" />
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900 uppercase mb-6">Top Products by Demand</h2>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={chartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                                <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="enquiries" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={22} name="Enquiries" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <h2 className="text-lg font-black text-slate-900">Product Demand Table</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enquiries</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Conversion %</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendors</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {productData.map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{p._id || p.productName}</td>
                                        <td className="px-6 py-4 text-sm font-black text-slate-900">{p.enquiryCount || 0}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${(p.conversionRate || 0) >= 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {(p.conversionRate || 0).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-500">{p.vendorCount || 0}</td>
                                        <td className="px-6 py-4 text-sm font-black text-rose-500">{p.lostCount || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderPlanning = () => {
        const fyOptions = getFinancialYears();
        const planningColumns = planningReport?.mgrCodes?.length > 0
            ? planningReport.mgrCodes
            : planningReport?.mgrColumns?.length > 0
                ? planningReport.mgrColumns
                : ['EPC', 'SBU1', 'SBU2', 'SBU3'];
        const monthRows = (planningReport?.rows || []).filter(row => row.isMonth && !row.isSegment);
        const segmentRows = (planningReport?.rows || []).filter(row => row.isSegment);
        const visibleMonths = planningReport?.monthLabels?.length > 0
            ? planningReport.monthLabels
            : (monthRows.length > 0 ? monthRows.map(row => row.monthLabel || row.month) : getMonthLabels(planningFY));
        const summaryRows = planningReport ? [
            (planningReport.rows || []).find(row => row.isTotal),
            (planningReport.rows || []).find(row => row.isPercentage),
            (planningReport.rows || []).find(row => row.isPreviousYearValue),
            (planningReport.rows || []).find(row => row.isTotalPercentage)
        ].filter(Boolean) : [];
        const togglePlanningMonth = (month) => {
            setExpandedPlanningMonths(prev => ({
                ...prev,
                [month]: !prev[month]
            }));
        };

        return (
            <div className="space-y-8">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-black text-slate-600 uppercase tracking-widest">Financial Year</label>
                    <select value={planningFY} onChange={(e) => setPlanningFY(e.target.value)}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 outline-none">
                        {fyOptions.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                    <button onClick={() => fetchTabData('planning')} className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary-700 transition-colors">
                        Load Report
                    </button>
                </div>

                {planningReport ? (
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                            <h2 className="text-lg font-black text-slate-900">MGR Planning Report — FY {planningFY}</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Date-first breakdown, paired MGR 1 then MGR 2</p>
                        </div>
                        <div className="overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white">
                                        <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Month</th>
                                        <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Type</th>
                                        {planningColumns.map(col => (
                                            <th key={col} className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{col}</th>
                                        ))}
                                        <th className="px-4 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {visibleMonths.map(monthLabel => {
                                        const monthRow = monthRows.find(row => (row.monthLabel || row.month) === monthLabel) || { month: monthLabel, total: 0 };
                                        const monthSegments = segmentRows.filter(row => row.parentMonth === monthLabel);
                                        const isOpen = expandedPlanningMonths[monthLabel] ?? false;
                                        return (
                                            <React.Fragment key={monthLabel}>
                                                <tr
                                                    className="bg-blue-50 font-bold cursor-pointer hover:bg-blue-100/60 transition-colors"
                                                    onClick={() => togglePlanningMonth(monthLabel)}
                                                >
                                                    <td className="px-4 py-3 text-sm font-black text-slate-900">
                                                        <div className="flex items-center gap-2">
                                                            <MdKeyboardArrowDown
                                                                className={`text-slate-700 transition-transform duration-300 ${!isOpen ? '-rotate-90' : ''}`}
                                                                size={18}
                                                            />
                                                            <span>{monthRow.month}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-black uppercase tracking-widest text-blue-700">-</td>
                                                    {planningColumns.map(col => {
                                                        const cellValue = Number(monthRow[col] || 0);
                                                        return (
                                                            <td key={`${monthLabel}-${col}`} className={`px-4 py-3 text-sm font-bold text-slate-900 text-right ${cellValue > 0 ? 'bg-blue-100/60' : ''}`}>
                                                                {formatReportValue(cellValue, 2)}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className={`px-4 py-3 text-sm font-black text-slate-900 text-right ${Number(monthRow.total || 0) > 0 ? 'bg-blue-100/60' : 'bg-slate-50'}`}>
                                                        {formatReportValue(monthRow.total || 0, 2)}
                                                    </td>
                                                </tr>
                                                {isOpen && (monthSegments.length > 0 ? monthSegments : PLANNING_SEGMENTS.map(segment => ({
                                                    month: segment,
                                                    total: 0
                                                }))).map(segmentRow => (
                                                    <tr key={`${monthLabel}-${segmentRow.month}`} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 pl-12 text-sm font-bold text-slate-700">{segmentRow.month}</td>
                                                        <td className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400">-</td>
                                                        {planningColumns.map(col => {
                                                            const cellValue = Number(segmentRow[col] || 0);
                                                            return (
                                                                <td key={`${monthLabel}-${segmentRow.month}-${col}`} className={`px-4 py-3 text-sm font-semibold text-slate-600 text-right ${cellValue > 0 ? 'bg-blue-50/60' : ''}`}>
                                                                    {formatReportValue(cellValue, 2)}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-4 py-3 text-sm font-black text-slate-900 text-right bg-slate-50">
                                                            {formatReportValue(segmentRow.total || 0, 2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                                    {summaryRows.map((summaryRow, idx) => (
                                        <tr key={idx} className="bg-slate-100 font-bold">
                                            <td className="px-4 py-3 text-sm font-black text-slate-900">{summaryRow.month || summaryRow.label}</td>
                                            <td className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700">-</td>
                                            {planningColumns.map(col => {
                                                const cellValue = Number(summaryRow[col] || 0);
                                                const isPct = summaryRow.isPercentage || summaryRow.isTotalPercentage;
                                                return (
                                                    <td key={`summary-${idx}-${col}`} className="px-4 py-3 text-sm font-bold text-slate-900 text-right">
                                                        {isPct ? formatReportPercentage(cellValue) : formatReportValue(cellValue, 2)}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-3 text-sm font-black text-slate-900 text-right bg-slate-200">
                                                {summaryRow.isPercentage || summaryRow.isTotalPercentage
                                                    ? formatReportPercentage(summaryRow.total)
                                                    : formatReportValue(summaryRow.total || 0, 2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400 text-sm font-semibold">No planning data available</div>
                )}
            </div>
        );
    };

    const renderWorkbookTable = (rows = [], options = {}) => (
        <div className="overflow-auto">
            <table className="border-collapse min-w-max text-xs">
                <tbody>
                    {rows.map((row, rowIndex) => (
                        <tr key={`${options.keyPrefix || 'row'}-${rowIndex}`}>
                            {row.map((item, cellIndex) => {
                                const style = getRevenueCellStyle(
                                    options.sheetName,
                                    rowIndex,
                                    cellIndex,
                                    row,
                                    item,
                                    options
                                );
                                return (
                                    <td
                                        key={`${options.keyPrefix || 'cell'}-${rowIndex}-${cellIndex}`}
                                        colSpan={item.colSpan || 1}
                                        className="border border-black px-3 py-2 whitespace-nowrap"
                                        style={style}
                                    >
                                        {item.value}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderRevenuePlan = () => {
        const fyOptions = getFinancialYears();
        const filteredRevenuePlanEntries = getFilteredRevenuePlanEntries();
        const sheets = revenuePlanReport
            ? buildRevenueWorkbookSheets(revenuePlanReport, filteredRevenuePlanEntries, revenuePlanFY, revenuePlanFilters)
            : [];
        const sheetNames = getRevenueWorkbookSheets(revenuePlanFY || '2026-27');
        const activeSheet = sheets.find(sheet => sheet.name === revenuePlanSheet) || sheets[0];
        const hasData = Boolean(revenuePlanReport);
        const mgr1Options = Array.from(new Set((revenuePlanEntries || [])
            .map(entry => entry.mgrCode)
            .filter(Boolean)))
            .sort();
        const segmentOptions = Array.from(new Set([
            ...REVENUE_SEGMENTS,
            ...(revenuePlanEntries || []).map(entry => normalizeRevenueSegment(entry.mgrCode2)).filter(Boolean)
        ])).sort((left, right) => left.localeCompare(right));

        return (
            <div className="space-y-6">
                <div className="bg-white border border-black shadow-sm overflow-hidden">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-4 border-b border-black" style={{ backgroundColor: normalizeHex(REVENUE_PLAN_COLORS.title) }}>
                        <div>
                            <h2 className="text-lg font-black text-black uppercase">Revenue Plan</h2>
                            {revenuePlanError && <p className="text-xs font-bold text-red-700 mt-1">{revenuePlanError}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={revenuePlanFY}
                                onChange={(e) => setRevenuePlanFY(e.target.value)}
                                className="px-4 py-2.5 bg-white border border-black font-bold text-sm outline-none"
                            >
                                {fyOptions.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                            </select>
                            <button onClick={() => fetchTabData('revenuePlan')} className="px-4 py-2.5 bg-black text-white border border-black font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors">
                                Load Plan
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(150px,1.2fr)_minmax(150px,1.2fr)_1fr_auto] gap-3 p-4 border-b border-black" style={{ backgroundColor: normalizeHex(REVENUE_PLAN_COLORS.filter) }}>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-black mb-1">MGR 1</label>
                            <select
                                value={revenuePlanFilters.mgr1}
                                onChange={(e) => setRevenuePlanFilters(prev => ({ ...prev, mgr1: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-black font-bold text-sm outline-none"
                            >
                                <option value="">All MGR 1</option>
                                {mgr1Options.map(option => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-black mb-1">Segment</label>
                            <select
                                value={revenuePlanFilters.segment}
                                onChange={(e) => setRevenuePlanFilters(prev => ({ ...prev, segment: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-black font-bold text-sm outline-none"
                            >
                                <option value="">All Segments</option>
                                {segmentOptions.map(option => <option key={option} value={option}>{getRevenueSegmentLabel(option)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black uppercase tracking-widest text-black mb-1">Status</label>
                            <div className="flex flex-wrap gap-1.5 items-center">
                                {(statusOptions.length > 0 ? statusOptions : REVENUE_PLAN_STATUS_OPTIONS)
                                    .filter(status => {
                                        const normalized = normalizeRevenueKey(status);
                                        return ['MFC', 'INVOICE', 'FIRM', 'B&B', 'BB', 'BANDB', 'BUDGET'].includes(normalized);
                                    })
                                    .map(status => {
                                        const isSelected = revenuePlanFilters.statuses.includes(status);
                                        return (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => toggleRevenuePlanStatusFilter(status)}
                                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border border-black transition-all duration-150 ${isSelected
                                                    ? 'bg-black text-white shadow-sm'
                                                    : 'bg-white text-black hover:bg-slate-50'
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={resetRevenuePlanFilters}
                                className="w-full px-4 py-2.5 bg-white border border-black text-black font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1 p-2 bg-white border-b border-black">
                        {sheetNames.map(sheetName => (
                            <button
                                key={sheetName}
                                type="button"
                                onClick={() => setRevenuePlanSheet(sheetName)}
                                className={`px-4 py-2 border border-black text-[10px] font-black uppercase tracking-widest ${revenuePlanSheet === sheetName
                                    ? 'bg-black text-white'
                                    : 'bg-white text-black hover:bg-slate-100'
                                    }`}
                            >
                                {sheetName}
                            </button>
                        ))}
                    </div>
                </div>

                {!hasData ? (
                    <div className="text-center py-20 text-slate-400 font-semibold">Select a financial year and click Load Plan</div>
                ) : (
                    <div className="bg-white border border-black shadow-sm overflow-hidden">
                        <div className="max-h-[72vh] overflow-auto p-3">
                            {activeSheet
                                ? renderWorkbookTable(activeSheet.rows || [], {
                                    keyPrefix: activeSheet.name,
                                    sheetName: activeSheet.name,
                                    ...getRevenueExportOptions(activeSheet.name)
                                })
                                : <div className="text-center py-12 text-slate-400 font-semibold">No revenue plan data available</div>}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderFollowUps = () => {
        if (!followUpData) return <div className="text-center py-20 text-slate-400 font-semibold">No follow-up data available</div>;

        const sections = [
            { key: 'overdue', label: 'Overdue', color: 'rose', data: followUpData.overdue || [] },
            { key: 'today', label: 'Due Today', color: 'amber', data: followUpData.today || [] },
            { key: 'upcoming', label: 'Upcoming (7 days)', color: 'blue', data: followUpData.upcoming || [] },
        ];

        const colorMap = {
            rose: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-700' },
            amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
            blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
        };

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon={<MdNotifications size={24} />} label="Overdue" value={sections[0].data.length} color="rose" />
                    <StatCard icon={<MdNotifications size={24} />} label="Due Today" value={sections[1].data.length} color="amber" />
                    <StatCard icon={<MdNotifications size={24} />} label="Upcoming 7 Days" value={sections[2].data.length} color="primary" />
                </div>

                {sections.map(section => {
                    const colors = colorMap[section.color];
                    return (
                        <div key={section.key} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className={`p-6 border-b ${colors.border} ${colors.bg}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${colors.badge}`}>
                                        {section.label}
                                    </span>
                                    <span className="text-sm font-black text-slate-600">{section.data.length} enquiries</span>
                                </div>
                            </div>
                            {section.data.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-white">
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enquiry #</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Follow-up Date</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Probability</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {section.data.map((f, i) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="px-6 py-3 text-sm font-black text-slate-900">{f.enquiryNo}</td>
                                                    <td className="px-6 py-3 text-sm font-bold text-slate-700">{f.customerName}</td>
                                                    <td className="px-6 py-3 text-sm font-semibold text-slate-500">{f.followUpDate ? formatDate(f.followUpDate) : '-'}</td>
                                                    <td className="px-6 py-3">
                                                        <span className="inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                                                            {f.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-black text-slate-900">{f.probability ? `${f.probability}%` : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm font-semibold">No {section.label.toLowerCase()} follow-ups</div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderTabContent = () => {
        if (loading) {
            return (
                <div className="flex h-72 items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
                </div>
            );
        }
        switch (activeTab) {
            case 'quotations': return renderQuotations();
            case 'enquiries': return renderEnquiries();
            case 'vendors': return renderVendors();
            case 'products': return renderProducts();
            case 'planning': return renderPlanning();
            case 'revenuePlan': return renderRevenuePlan();
            case 'followups': return renderFollowUps();
            default: return null;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">Reports</h1>
                    <p className="text-slate-500 font-semibold mt-1">Business performance across all modules</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleRefresh}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
                        <MdRefresh size={18} />
                        Refresh
                    </button>
                    <button onClick={handleExport}
                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-slate-900/20 uppercase text-xs tracking-widest active:scale-95">
                        <MdDownload size={18} />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 flex flex-wrap gap-1">
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === tab.key
                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600'
                            }`}>
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {renderTabContent()}
        </div>
    );
};

export default Reports;
