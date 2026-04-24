import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    MdDelete,
    MdCalendarMonth,
    MdSave,
    MdDownload,
    MdRefresh,
    MdEdit,
    MdClose,
    MdKeyboardArrowDown,
    MdFileUpload
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { planningService, customerService, productService, mgrService, importService } from '../services/api';
import * as XLSX from 'xlsx';
import ImportModal from '../components/ImportModal';
import PortalDropdown from '../components/PortalDropdown';

// Financial year months (Apr-Mar)
const FY_MONTHS = [
    'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
    'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'
];

const STATUS_OPTIONS = ['Firm', 'MFC', 'B & B', 'Others', 'Order Received', 'Invoice', 'Lost', 'Parked'];

// Generate financial year options (current + next 2)
const getFinancialYears = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const fyStart = currentMonth >= 3 ? currentYear : currentYear - 1;

    const years = [];
    for (let i = -1; i < 3; i++) {
        const start = fyStart + i;
        const end = (start + 1).toString().slice(-2);
        years.push(`${start}-${end}`);
    }

    return years;
};

// Generate month-year labels for a financial year
const getMonthLabels = (fy) => {
    const startYear = parseInt(fy.split('-')[0], 10);
    return FY_MONTHS.map((month, idx) => {
        const year = idx < 9 ? startYear : startYear + 1;
        return `${month}-${year.toString().slice(-2)}`;
    });
};

const normalizeMgrCode = (value = '') => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();

const dedupeMgrOptions = (items = []) => {
    const seen = new Set();

    return items.filter((mgr) => {
        const key = normalizeMgrCode(mgr.code);
        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
};

const getCanonicalMgrCode = (value, mgrItems = []) => {
    const normalized = normalizeMgrCode(value);
    if (!normalized) {
        return '';
    }

    const match = mgrItems.find((mgr) => normalizeMgrCode(mgr.code) === normalized);
    return match?.code || String(value || '').trim().replace(/\s+/g, ' ');
};

const getEntityId = (value) => {
    if (!value) {
        return '';
    }

    if (typeof value === 'object') {
        return String(value._id || '');
    }

    return String(value);
};

const getFallbackCode = (prefix, value) => {
    const entityId = getEntityId(value);
    return entityId ? `${prefix}-${entityId.slice(-8).toUpperCase()}` : '';
};

const compareSortValues = (left, right) => {
    if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
    }

    return String(left || '').localeCompare(String(right || ''), undefined, {
        numeric: true,
        sensitivity: 'base'
    });
};

const PlanningScreen = () => {
    const [financialYear, setFinancialYear] = useState(getFinancialYears()[1]);
    const [entries, setEntries] = useState([]);
    const [combinedReportData, setCombinedReportData] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [reportData2, setReportData2] = useState(null);
    const [loading, setLoading] = useState(false);

    const [isGridExpanded, setIsGridExpanded] = useState(true);
    const [isReportExpanded, setIsReportExpanded] = useState(false);
    const [isReportExpanded2, setIsReportExpanded2] = useState(false);
    const [expandedQuarters, setExpandedQuarters] = useState({
        Q1: false,
        Q2: false,
        Q3: false,
        Q4: false
    });

    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [mgrList, setMgrList] = useState([]);
    const [mgrList2, setMgrList2] = useState([]);

    const [editingId, setEditingId] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const emptyRow = {
        monthYear: '',
        customerId: '',
        customerName: '',
        productId: '',
        productName: '',
        qty: '',
        value: '',
        mgrCode: '',
        mgrCode2: '',
        status: ''
    };
    const [newRow, setNewRow] = useState({ ...emptyRow });

    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const customerAnchorRef = useRef(null);
    const productAnchorRef = useRef(null);
    const [filters, setFilters] = useState({
        mgrCode: '',
        mgrCode2: '',
        status: ''
    });
    const [sortConfig, setSortConfig] = useState({
        key: 'monthYear',
        direction: 'asc'
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [entriesRes, combinedReportRes, reportRes, report2Res] = await Promise.all([
                planningService.getAll(financialYear),
                planningService.getMGRReport(financialYear),
                planningService.getMGRReport(financialYear, 'MGR1'),
                planningService.getMGRReport(financialYear, 'MGR2')
            ]);

            setEntries(entriesRes.data);
            setCombinedReportData(combinedReportRes.data);
            setReportData(reportRes.data);
            setReportData2(report2Res.data);
        } catch (err) {
            console.error('Failed to load planning data:', err);
        } finally {
            setLoading(false);
        }
    }, [financialYear]);

    useEffect(() => {
        const fetchMasters = async () => {
            try {
                const [custRes, prodRes, mgrRes, mgr2Res] = await Promise.all([
                    customerService.getAll(),
                    productService.getAll(),
                    mgrService.getAll('MGR1'),
                    mgrService.getAll('MGR2')
                ]);

                setCustomers(custRes.data);
                setProducts(prodRes.data);
                setMgrList(dedupeMgrOptions(mgrRes.data.filter((mgr) => mgr.status === 'Active')));
                setMgrList2(dedupeMgrOptions(mgr2Res.data.filter((mgr) => mgr.status === 'Active')));
            } catch (err) {
                console.error('Failed to load master data:', err);
            }
        };

        fetchMasters();
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredCustomers = useMemo(() => {
        if (!customerSearch) {
            return customers.slice(0, 10);
        }

        return customers.filter((customer) =>
            (customer.externalCode || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
            (customer.companyName || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
            (customer.customerName || '').toLowerCase().includes(customerSearch.toLowerCase())
        ).slice(0, 10);
    }, [customers, customerSearch]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) {
            return products.slice(0, 10);
        }

        return products.filter((product) =>
            (product.productName || '').toLowerCase().includes(productSearch.toLowerCase()) ||
            (product.productCode || '').toLowerCase().includes(productSearch.toLowerCase())
        ).slice(0, 10);
    }, [products, productSearch]);

    const filteredEntries = useMemo(() => {
        return entries.filter((entry) => {
            const matchesMgr1 = !filters.mgrCode || normalizeMgrCode(entry.mgrCode) === normalizeMgrCode(filters.mgrCode);
            const matchesMgr2 = !filters.mgrCode2 || normalizeMgrCode(entry.mgrCode2) === normalizeMgrCode(filters.mgrCode2);
            const matchesStatus = !filters.status || entry.status === filters.status;

            return matchesMgr1 && matchesMgr2 && matchesStatus;
        });
    }, [entries, filters]);

    const hasActiveFilters = Boolean(filters.mgrCode || filters.mgrCode2 || filters.status);
    const monthLabels = getMonthLabels(financialYear);
    const monthOrder = useMemo(
        () => new Map(monthLabels.map((label, index) => [label, index])),
        [monthLabels]
    );
    const customerMap = useMemo(
        () => new Map(customers.map((customer) => [String(customer._id), customer])),
        [customers]
    );
    const productMap = useMemo(
        () => new Map(products.map((product) => [String(product._id), product])),
        [products]
    );

    const getCustomerById = useCallback(
        (customerId) => customerMap.get(getEntityId(customerId)) || null,
        [customerMap]
    );
    const getProductById = useCallback(
        (productId) => productMap.get(getEntityId(productId)) || null,
        [productMap]
    );
    const getCustomerCode = useCallback(
        (customerId) => getCustomerById(customerId)?.externalCode || getFallbackCode('CUST', customerId) || '-',
        [getCustomerById]
    );
    const getProductCode = useCallback(
        (productId) => getProductById(productId)?.productCode || '-',
        [getProductById]
    );

    const sortedEntries = useMemo(() => {
        const rows = [...filteredEntries];

        rows.sort((left, right) => {
            let leftValue;
            let rightValue;

            switch (sortConfig.key) {
                case 'monthYear':
                    leftValue = monthOrder.get(left.monthYear) ?? Number.MAX_SAFE_INTEGER;
                    rightValue = monthOrder.get(right.monthYear) ?? Number.MAX_SAFE_INTEGER;
                    break;
                case 'customerCode':
                    leftValue = getCustomerCode(left.customerId);
                    rightValue = getCustomerCode(right.customerId);
                    break;
                case 'customerName':
                    leftValue = left.customerName;
                    rightValue = right.customerName;
                    break;
                case 'productCode':
                    leftValue = getProductCode(left.productId);
                    rightValue = getProductCode(right.productId);
                    break;
                case 'productName':
                    leftValue = left.productName;
                    rightValue = right.productName;
                    break;
                case 'qty':
                    leftValue = Number(left.qty || 0);
                    rightValue = Number(right.qty || 0);
                    break;
                case 'value':
                    leftValue = Number(left.value || 0);
                    rightValue = Number(right.value || 0);
                    break;
                case 'totalValue':
                    leftValue = Number(left.totalValue || 0);
                    rightValue = Number(right.totalValue || 0);
                    break;
                case 'mgrCode':
                    leftValue = getCanonicalMgrCode(left.mgrCode, mgrList);
                    rightValue = getCanonicalMgrCode(right.mgrCode, mgrList);
                    break;
                case 'mgrCode2':
                    leftValue = getCanonicalMgrCode(left.mgrCode2 || '', mgrList2);
                    rightValue = getCanonicalMgrCode(right.mgrCode2 || '', mgrList2);
                    break;
                case 'status':
                    leftValue = left.status;
                    rightValue = right.status;
                    break;
                default:
                    leftValue = left[sortConfig.key];
                    rightValue = right[sortConfig.key];
            }

            const comparison = compareSortValues(leftValue, rightValue);
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        return rows;
    }, [filteredEntries, sortConfig, monthOrder, mgrList, mgrList2, getCustomerCode, getProductCode]);

    const handleNewRowChange = (field, value) => {
        setNewRow((prev) => ({ ...prev, [field]: value }));
    };

    const handleFilterChange = (field, value) => {
        setFilters((prev) => ({ ...prev, [field]: value }));
    };

    const clearFilters = () => {
        setFilters({
            mgrCode: '',
            mgrCode2: '',
            status: ''
        });
    };

    const getStatusClasses = (status) => {
        switch (status) {
            case 'Firm':
                return 'bg-emerald-50 text-emerald-700';
            case 'MFC':
                return 'bg-amber-50 text-amber-700';
            case 'B & B':
                return 'bg-purple-50 text-purple-700';
            case 'Invoice':
                return 'bg-orange-50 text-orange-700';
            case 'Order Received':
                return 'bg-sky-50 text-sky-700';
            case 'Lost':
                return 'bg-rose-50 text-rose-700';
            case 'Parked':
                return 'bg-slate-200 text-slate-700';
            default:
                return 'bg-slate-100 text-slate-600';
        }
    };

    const selectCustomer = (customer) => {
        const name = customer.companyName || customer.customerName;
        setNewRow((prev) => ({
            ...prev,
            customerId: customer._id,
            customerName: name
        }));
        setCustomerSearch(name);
        setShowCustomerDropdown(false);
    };

    const selectProduct = (product) => {
        setNewRow((prev) => ({
            ...prev,
            productId: product._id,
            productName: product.productName
        }));
        setProductSearch(product.productName);
        setShowProductDropdown(false);
    };

    const handleSaveEntry = async () => {
        if (!newRow.monthYear || !newRow.customerId || !newRow.productId || newRow.qty === '' || newRow.value === '' || !newRow.mgrCode || !newRow.status) {
            toast.error('Please fill all mandatory fields (MGR 2 is optional)');
            return;
        }

        try {
            const dataToSave = {
                ...newRow,
                financialYear,
                qty: Number(newRow.qty),
                value: Number(newRow.value),
                mgrCode: getCanonicalMgrCode(newRow.mgrCode, mgrList),
                mgrCode2: getCanonicalMgrCode(newRow.mgrCode2, mgrList2),
                month: FY_MONTHS.indexOf(newRow.monthYear.split('-')[0]) + 1
            };

            if (editingId) {
                await planningService.update(editingId, dataToSave);
                toast.success('Entry updated');
                setEditingId(null);
            } else {
                await planningService.create(dataToSave);
                toast.success('Entry added');
            }

            setNewRow({ ...emptyRow });
            setCustomerSearch('');
            setProductSearch('');
            setShowCustomerDropdown(false);
            setShowProductDropdown(false);
            await fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || (editingId ? 'Failed to update entry' : 'Failed to add entry'));
        }
    };

    const handleEditEntry = (entry) => {
        setEditingId(entry._id);
        setNewRow({
            monthYear: entry.monthYear,
            customerId: entry.customerId?._id || entry.customerId || '',
            customerName: entry.customerName || entry.customerId?.companyName || entry.customerId?.customerName || '',
            productId: entry.productId?._id || entry.productId || '',
            productName: entry.productName || entry.productId?.productName || '',
            qty: entry.qty,
            value: entry.value,
            mgrCode: getCanonicalMgrCode(entry.mgrCode, mgrList),
            mgrCode2: getCanonicalMgrCode(entry.mgrCode2 || '', mgrList2),
            status: entry.status
        });
        setCustomerSearch(entry.customerName || entry.customerId?.companyName || entry.customerId?.customerName || '');
        setProductSearch(entry.productName || entry.productId?.productName || '');
        setShowCustomerDropdown(false);
        setShowProductDropdown(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setIsGridExpanded(true);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setNewRow({ ...emptyRow });
        setCustomerSearch('');
        setProductSearch('');
        setShowCustomerDropdown(false);
        setShowProductDropdown(false);
    };

    const handleDeleteEntry = async (id) => {
        try {
            await planningService.delete(id);
            toast.success('Entry removed');
            await fetchData();
        } catch {
            toast.error('Failed to delete entry');
        }
    };

    const exportToExcel = () => {
        if (!sortedEntries.length && !reportData && !reportData2) {
            toast.error('No planning data available to export');
            return;
        }

        const workbook = XLSX.utils.book_new();
        const buildReportRows = (data) => data.rows.map((row) => {
            const exportRow = { Month: row.month };
            data.mgrCodes.forEach((mgr) => {
                exportRow[mgr] = row[mgr] || 0;
            });
            exportRow.Total = row.total || 0;
            return exportRow;
        });

        const entriesData = sortedEntries.map((entry) => ({
                Month: entry.monthYear,
                'Customer Code': getCustomerCode(entry.customerId),
                'Customer Name': entry.customerName,
                'Product Code': getProductCode(entry.productId),
                'Product Name': entry.productName,
                Qty: entry.qty,
                Value: entry.value,
                Total: entry.totalValue,
                'MGR 1': getCanonicalMgrCode(entry.mgrCode, mgrList),
                'MGR 2': getCanonicalMgrCode(entry.mgrCode2 || '', mgrList2),
                Status: entry.status
            }));
        const entriesSheet = XLSX.utils.json_to_sheet(entriesData);
        entriesSheet['!cols'] = [
            { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, 
            { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 12 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(workbook, entriesSheet, 'Planning Entries');

        if (reportData) {
            const reportSheet = XLSX.utils.json_to_sheet(buildReportRows(reportData));
            reportSheet['!cols'] = [{ wch: 26 }, ...reportData.mgrCodes.map(() => ({ wch: 16 })), { wch: 16 }];
            XLSX.utils.book_append_sheet(workbook, reportSheet, 'MGR 1 Report');
        }

        if (reportData2) {
            const reportSheet2 = XLSX.utils.json_to_sheet(buildReportRows(reportData2));
            reportSheet2['!cols'] = [{ wch: 26 }, ...reportData2.mgrCodes.map(() => ({ wch: 16 })), { wch: 16 }];
            XLSX.utils.book_append_sheet(workbook, reportSheet2, 'MGR 2 Report');
        }

        XLSX.writeFile(workbook, `Planning-${financialYear}.xlsx`);
        toast.success('Excel downloaded with customer and product code details');
    };

    const exportReportToExcel = (data, reportLabel) => {
        if (!data || !data.mgrCodes?.length) {
            toast.error(`No data available for ${reportLabel}`);
            return;
        }

        const workbook = XLSX.utils.book_new();
        const reportRows = data.rows.map((row) => {
            const exportRow = { Month: row.month };
            if (row.mgrType) {
                exportRow['MGR Type'] = row.mgrType;
            }
            data.mgrCodes.forEach((mgr) => {
                exportRow[mgr] = row[mgr] || 0;
            });
            exportRow.Total = row.total || 0;
            return exportRow;
        });
        const reportSheet = XLSX.utils.json_to_sheet(reportRows);
        reportSheet['!cols'] = [{ wch: 26 }, ...data.mgrCodes.map(() => ({ wch: 16 })), { wch: 16 }];
        XLSX.utils.book_append_sheet(workbook, reportSheet, reportLabel);

        const safeReportLabel = reportLabel.replace(/\s+/g, '-');
        XLSX.writeFile(workbook, `${safeReportLabel}-${financialYear}.xlsx`);
        toast.success(`${reportLabel} exported`);
    };

    const requestSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const renderSortableHeader = (label, key, className = '') => {
        const isActive = sortConfig.key === key;
        const isRightAligned = className.includes('text-right');

        return (
            <th className={`py-3 px-3 ${className}`}>
                <button
                    type="button"
                    onClick={() => requestSort(key)}
                    className={`group inline-flex items-center gap-1.5 font-black text-slate-700 text-xs ${isRightAligned ? 'w-full justify-end' : ''}`}
                >
                    <span>{label}</span>
                    <MdKeyboardArrowDown
                        className={`transition-all duration-200 ${isActive ? 'text-primary-600 opacity-100' : 'text-slate-300 opacity-70 group-hover:text-slate-500'} ${isActive && sortConfig.direction === 'asc' ? 'rotate-180' : ''}`}
                        size={16}
                    />
                </button>
            </th>
        );
    };

    const toggleQuarter = (quarterPrefix) => {
        setExpandedQuarters((prev) => ({
            ...prev,
            [quarterPrefix]: !prev[quarterPrefix]
        }));
    };
    const calculatedTotal = (newRow.qty && newRow.value) ? Number(newRow.qty) * Number(newRow.value) : 0;
    const compactFieldClass = 'w-full px-2.5 py-2.5 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary-500 bg-white';
    const compactNumericFieldClass = `${compactFieldClass} text-right`;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <MdCalendarMonth className="text-primary-600" />
                        Planning Screen
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Plan monthly targets by customer, product, and MGR</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    <select
                        value={financialYear}
                        onChange={(e) => setFinancialYear(e.target.value)}
                        className="px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                    >
                        {getFinancialYears().map((fy) => (
                            <option key={fy} value={fy}>FY {fy}</option>
                        ))}
                    </select>
                    <button onClick={fetchData} className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all">
                        <MdRefresh size={20} />
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <MdFileUpload size={18} />
                        Import
                    </button>
                    <button
                        onClick={exportToExcel}
                        className="px-5 py-3 bg-primary-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary-700 transition-all flex items-center gap-2"
                    >
                        <MdDownload size={18} />
                        Export
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div
                    className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => setIsGridExpanded(!isGridExpanded)}
                >
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <MdKeyboardArrowDown className={`text-slate-500 transition-transform duration-300 ${!isGridExpanded ? '-rotate-90' : ''}`} size={20} />
                        Planning Grid
                    </h2>
                </div>

                {isGridExpanded && (
                    <>
                        <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/60 space-y-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.25em] text-primary-600">
                                        {editingId ? 'Edit Entry' : 'Inline Entry'}
                                    </p>
                                    <h3 className="text-xl font-black text-slate-900 mt-1">
                                        {editingId ? 'Update Planning Entry' : 'Add Planning Entry'}
                                    </h3>
                                    <p className="text-sm text-slate-500 font-medium mt-1">
                                        The data-entry row is back inside the grid for faster single-line entry.
                                    </p>
                                </div>
                                {editingId && (
                                    <button
                                        onClick={handleCancelEdit}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                                    >
                                        <MdClose size={18} />
                                        Cancel Edit
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-4 md:px-5 py-4 border-b border-slate-100 bg-white">
                            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 xl:flex-1">
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Filter MGR 1</label>
                                        <select
                                            value={filters.mgrCode}
                                            onChange={(e) => handleFilterChange('mgrCode', e.target.value)}
                                            className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                                        >
                                            <option value="">All MGR 1</option>
                                            {mgrList.map((mgr) => (
                                                <option key={mgr._id} value={mgr.code}>{mgr.code}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Filter MGR 2</label>
                                        <select
                                            value={filters.mgrCode2}
                                            onChange={(e) => handleFilterChange('mgrCode2', e.target.value)}
                                            className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                                        >
                                            <option value="">All MGR 2</option>
                                            {mgrList2.map((mgr) => (
                                                <option key={mgr._id} value={mgr.code}>{mgr.code}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Filter Status</label>
                                        <select
                                            value={filters.status}
                                            onChange={(e) => handleFilterChange('status', e.target.value)}
                                            className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                                        >
                                            <option value="">All Statuses</option>
                                            {STATUS_OPTIONS.map((status) => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold">
                                        {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
                                    </span>
                                    <button
                                        onClick={clearFilters}
                                        disabled={!hasActiveFilters}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <MdRefresh size={18} />
                                        Clear Filters
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden">
                            <table className="w-full table-fixed text-left text-sm">
                                <colgroup>
                                    <col className="w-[8%]" />
                                    <col className="w-[17%]" />
                                    <col className="w-[21%]" />
                                    <col className="w-[6%]" />
                                    <col className="w-[8%]" />
                                    <col className="w-[9%]" />
                                    <col className="w-[9%]" />
                                    <col className="w-[9%]" />
                                    <col className="w-[13%]" />
                                </colgroup>
                                <thead>
                                    <tr className="bg-amber-50 border-b border-amber-100">
                                        {renderSortableHeader('Month', 'monthYear', 'px-2 py-3')}
                                        {renderSortableHeader('Customer', 'customerName', 'px-2 py-3')}
                                        {renderSortableHeader('Product Name', 'productName', 'px-2 py-3')}
                                        {renderSortableHeader('Qty', 'qty', 'px-2 py-3 text-right')}
                                        {renderSortableHeader('Value', 'value', 'px-2 py-3 text-right')}
                                        {renderSortableHeader('Total', 'totalValue', 'px-2 py-3 text-right bg-amber-100')}
                                        {renderSortableHeader('MGR 1', 'mgrCode', 'px-2 py-3')}
                                        {renderSortableHeader('MGR 2', 'mgrCode2', 'px-2 py-3')}
                                        {renderSortableHeader('Status', 'status', 'px-2 py-3')}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    <tr className="bg-primary-50/40 border-b border-primary-100 align-top">
                                        <td className="py-2 px-2">
                                            <select
                                                value={newRow.monthYear}
                                                onChange={(e) => handleNewRowChange('monthYear', e.target.value)}
                                                className={compactFieldClass}
                                            >
                                                <option value="">Select month</option>
                                                {monthLabels.map((month) => (
                                                    <option key={month} value={month}>{month}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td ref={customerAnchorRef} className="py-2 px-2">
                                            <input
                                                type="text"
                                                value={customerSearch}
                                                onChange={(e) => {
                                                    setCustomerSearch(e.target.value);
                                                    handleNewRowChange('customerId', '');
                                                    handleNewRowChange('customerName', '');
                                                    setShowCustomerDropdown(true);
                                                }}
                                                onFocus={() => setShowCustomerDropdown(true)}
                                                placeholder="Type customer name"
                                                className={compactFieldClass}
                                            />
                                            <PortalDropdown isOpen={showCustomerDropdown && filteredCustomers.length > 0} anchorRef={customerAnchorRef}>
                                                <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                                    {filteredCustomers.map((customer) => (
                                                        <button
                                                            key={customer._id}
                                                            onClick={() => selectCustomer(customer)}
                                                            className="w-full text-left px-3 py-2.5 text-sm font-bold hover:bg-primary-50 transition-colors border-b border-slate-50"
                                                        >
                                                            <div>{customer.companyName || customer.customerName}</div>
                                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                                {customer.externalCode || getFallbackCode('CUST', customer._id)}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </PortalDropdown>
                                        </td>
                                        <td ref={productAnchorRef} className="py-2 px-2">
                                            <input
                                                type="text"
                                                value={productSearch}
                                                onChange={(e) => {
                                                    setProductSearch(e.target.value);
                                                    handleNewRowChange('productId', '');
                                                    handleNewRowChange('productName', '');
                                                    setShowProductDropdown(true);
                                                }}
                                                onFocus={() => setShowProductDropdown(true)}
                                                placeholder="Type product name"
                                                className={compactFieldClass}
                                            />
                                            <PortalDropdown isOpen={showProductDropdown && filteredProducts.length > 0} anchorRef={productAnchorRef}>
                                                <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                                    {filteredProducts.map((product) => (
                                                        <button
                                                            key={product._id}
                                                            onClick={() => selectProduct(product)}
                                                            className="w-full text-left px-3 py-2.5 text-sm font-bold hover:bg-primary-50 transition-colors border-b border-slate-50"
                                                        >
                                                            {product.productName}
                                                        </button>
                                                    ))}
                                                </div>
                                            </PortalDropdown>
                                        </td>
                                        <td className="py-2 px-2">
                                            <input
                                                type="number"
                                                value={newRow.qty}
                                                onChange={(e) => handleNewRowChange('qty', e.target.value)}
                                                placeholder="0"
                                                className={compactNumericFieldClass}
                                            />
                                        </td>
                                        <td className="py-2 px-2">
                                            <input
                                                type="number"
                                                min="0"
                                                value={newRow.value}
                                                onChange={(e) => handleNewRowChange('value', e.target.value)}
                                                placeholder="0"
                                                className={compactNumericFieldClass}
                                            />
                                        </td>
                                        <td className="py-2 px-2 bg-amber-50/80">
                                            <div className="px-2.5 py-2.5 rounded-lg bg-amber-50 border border-amber-100 text-sm font-black text-slate-900 text-right">
                                                {calculatedTotal.toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="py-2 px-2">
                                            <select
                                                value={newRow.mgrCode}
                                                onChange={(e) => handleNewRowChange('mgrCode', e.target.value)}
                                                className={compactFieldClass}
                                            >
                                                <option value="">Select MGR 1</option>
                                                {mgrList.map((mgr) => (
                                                    <option key={mgr._id} value={mgr.code}>{mgr.code} - {mgr.description}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-2 px-2">
                                            <select
                                                value={newRow.mgrCode2}
                                                onChange={(e) => handleNewRowChange('mgrCode2', e.target.value)}
                                                className={compactFieldClass}
                                            >
                                                <option value="">Select MGR 2</option>
                                                {mgrList2.map((mgr) => (
                                                    <option key={mgr._id} value={mgr.code}>{mgr.code} - {mgr.description}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-2 px-2">
                                            <div className="space-y-2">
                                                <select
                                                    value={newRow.status}
                                                    onChange={(e) => handleNewRowChange('status', e.target.value)}
                                                    className={compactFieldClass}
                                                >
                                                    <option value="">Select status</option>
                                                    {STATUS_OPTIONS.map((status) => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={handleSaveEntry}
                                                        className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-white text-xs font-bold transition-colors ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                                    >
                                                        <MdSave size={16} />
                                                        {editingId ? 'Update' : 'Save'}
                                                    </button>
                                                    {editingId && (
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                                                        >
                                                            <MdClose size={16} />
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>

                                    {loading ? (
                                        <tr>
                                            <td colSpan="9" className="py-10 text-center">
                                                <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-8 w-8 mx-auto"></div>
                                            </td>
                                        </tr>
                                    ) : sortedEntries.length > 0 ? (
                                        sortedEntries.map((entry) => (
                                            <tr key={entry._id} className={`hover:bg-slate-50 transition-colors ${editingId === entry._id ? 'bg-primary-50/60' : ''}`}>
                                                <td className="py-3 px-2 font-bold text-slate-700 text-xs whitespace-nowrap">{entry.monthYear}</td>
                                                <td className="py-3 px-2 font-bold text-slate-900 text-xs">
                                                    <p className="truncate" title={entry.customerName}>{entry.customerName}</p>
                                                </td>
                                                <td className="py-3 px-2 text-slate-700 text-xs">
                                                    <p className="truncate" title={entry.productName}>{entry.productName}</p>
                                                </td>
                                                <td className="py-3 px-2 text-right font-bold text-slate-700 text-xs whitespace-nowrap">{entry.qty}</td>
                                                <td className="py-3 px-2 text-right font-bold text-slate-700 text-xs whitespace-nowrap">{entry.value?.toLocaleString()}</td>
                                                <td className="py-3 px-2 text-right font-black text-slate-900 text-xs bg-amber-50/50 whitespace-nowrap">
                                                    {entry.totalValue?.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-2 text-xs whitespace-nowrap">
                                                    <span className="block truncate px-2 py-1 bg-blue-50 text-blue-700 rounded font-bold" title={getCanonicalMgrCode(entry.mgrCode, mgrList)}>
                                                        {getCanonicalMgrCode(entry.mgrCode, mgrList)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-xs whitespace-nowrap">
                                                    <span className="block truncate px-2 py-1 bg-indigo-50 text-indigo-700 rounded font-bold" title={getCanonicalMgrCode(entry.mgrCode2 || '', mgrList2) || '-'}>
                                                        {getCanonicalMgrCode(entry.mgrCode2 || '', mgrList2) || '-'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-xs">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className={`truncate px-2 py-1 rounded font-bold whitespace-nowrap ${getStatusClasses(entry.status)}`} title={entry.status}>
                                                            {entry.status}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleEditEntry(entry)}
                                                                className={`p-1.5 rounded-lg transition-all ${editingId === entry._id ? 'text-primary-600 bg-primary-50' : 'text-slate-400 hover:text-primary-600 hover:bg-primary-50'}`}
                                                                title="Edit Entry"
                                                            >
                                                                <MdEdit size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteEntry(entry._id)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                                title="Delete Entry"
                                                            >
                                                                <MdDelete size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="9" className="py-10 text-center text-slate-400 font-bold text-sm">
                                                {hasActiveFilters
                                                    ? 'No planning entries match the selected filters.'
                                                    : `No planning entries for FY ${financialYear}. Add your first entry above.`}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div
                    className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => setIsReportExpanded(!isReportExpanded)}
                >
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <MdKeyboardArrowDown className={`text-slate-500 transition-transform duration-300 ${!isReportExpanded ? '-rotate-90' : ''}`} size={20} />
                        MGR Report - FY {financialYear}
                    </h2>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            exportReportToExcel(combinedReportData, 'MGR Report');
                        }}
                        disabled={!combinedReportData || !combinedReportData.mgrCodes?.length}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MdDownload size={16} />
                        Export
                    </button>
                </div>

                {isReportExpanded && (
                    combinedReportData && combinedReportData.mgrCodes.length > 0 ? (
                        <div className="overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-amber-50 border-b border-amber-100">
                                        <th className="py-3 px-4 font-black text-slate-700 min-w-[100px]"></th>
                                        <th className="py-3 px-4 font-black text-slate-700 min-w-[80px]">Type</th>
                                        {combinedReportData.mgrCodes.map((mgr) => (
                                            <th key={mgr} className="py-3 px-4 font-black text-slate-700 text-right min-w-[100px]">{mgr}</th>
                                        ))}
                                        <th className="py-3 px-4 font-black text-slate-900 text-right bg-amber-100 min-w-[100px]">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {combinedReportData.rows.map((row, idx) => {
                                        const isQuarter = row.isQuarter;
                                        const isTotal = row.isTotal;
                                        const isPercentage = row.isPercentage;
                                        const isHighlight = isQuarter || isTotal || isPercentage;

                                        let rowQuarterPrefix = null;
                                        if (isQuarter) {
                                            rowQuarterPrefix = row.month.substring(0, 2);
                                        } else if (!isTotal && !isPercentage) {
                                            const nextQuarterRow = combinedReportData.rows.slice(idx).find((reportRow) => reportRow.isQuarter);
                                            if (nextQuarterRow) {
                                                rowQuarterPrefix = nextQuarterRow.month.substring(0, 2);
                                            }
                                        }

                                        if (!isHighlight && rowQuarterPrefix && !expandedQuarters[rowQuarterPrefix]) {
                                            return null;
                                        }

                                        return (
                                            <tr
                                                key={idx}
                                                className={`border-b transition-colors ${
                                                    isTotal ? 'bg-amber-50 border-amber-200 font-black' :
                                                    isPercentage ? 'bg-slate-50 border-slate-200' :
                                                    isQuarter ? 'bg-blue-50/50 border-blue-100 font-bold cursor-pointer hover:bg-blue-100/50' :
                                                    'border-slate-50 hover:bg-slate-50'
                                                }`}
                                                onClick={() => {
                                                    if (isQuarter) {
                                                        toggleQuarter(row.month.substring(0, 2));
                                                    }
                                                }}
                                            >
                                                <td className={`py-3 px-4 ${isHighlight ? 'font-black text-slate-900' : 'font-semibold text-slate-600'} ${isQuarter ? 'pl-2' : 'pl-8'}`}>
                                                    <div className="flex items-center gap-1">
                                                        {isQuarter && (
                                                            <MdKeyboardArrowDown
                                                                className={`text-blue-500 transition-transform duration-300 ${!expandedQuarters[row.month.substring(0, 2)] ? '-rotate-90' : ''}`}
                                                                size={18}
                                                            />
                                                        )}
                                                        {row.month}
                                                    </div>
                                                </td>
                                                <td className={`py-3 px-4 text-xs font-black uppercase tracking-widest ${row.mgrType === 'MGR 2' ? 'text-indigo-700' : 'text-blue-700'}`}>
                                                    {row.mgrType || '-'}
                                                </td>
                                                {combinedReportData.mgrCodes.map((mgr) => (
                                                    <td key={mgr} className={`py-3 px-4 text-right ${isHighlight ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                                                        {isPercentage ? `${row[mgr] || 0}%` : (row[mgr] || 0).toLocaleString()}
                                                    </td>
                                                ))}
                                                <td className={`py-3 px-4 text-right ${isTotal ? 'bg-amber-100 font-black' : isPercentage ? 'bg-slate-100 font-bold' : 'bg-amber-50/50 font-bold'} text-slate-900`}>
                                                    {isPercentage ? `${row.total}%` : (row.total || 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-10 text-center text-slate-400 font-bold">
                            {loading ? (
                                <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-8 w-8 mx-auto"></div>
                            ) : (
                                'No data available. Add planning entries above to generate the MGR report.'
                            )}
                        </div>
                    )
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div
                    className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => setIsReportExpanded2(!isReportExpanded2)}
                >
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <MdKeyboardArrowDown className={`text-slate-500 transition-transform duration-300 ${!isReportExpanded2 ? '-rotate-90' : ''}`} size={20} />
                        MGR 2 Report - FY {financialYear}
                    </h2>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            exportReportToExcel(reportData2, 'MGR 2 Report');
                        }}
                        disabled={!reportData2 || !reportData2.mgrCodes?.length}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MdDownload size={16} />
                        Export
                    </button>
                </div>

                {isReportExpanded2 && (
                    reportData2 && reportData2.mgrCodes.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-amber-50 border-b border-amber-100">
                                        <th className="py-3 px-4 font-black text-slate-700 min-w-[100px]"></th>
                                        {reportData2.mgrCodes.map((mgr) => (
                                            <th key={mgr} className="py-3 px-4 font-black text-slate-700 text-right min-w-[100px]">{mgr}</th>
                                        ))}
                                        <th className="py-3 px-4 font-black text-slate-900 text-right bg-amber-100 min-w-[100px]">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData2.rows.map((row, idx) => {
                                        const isQuarter = row.isQuarter;
                                        const isTotal = row.isTotal;
                                        const isPercentage = row.isPercentage;
                                        const isHighlight = isQuarter || isTotal || isPercentage;

                                        let rowQuarterPrefix = null;
                                        if (isQuarter) {
                                            rowQuarterPrefix = row.month.substring(0, 2);
                                        } else if (!isTotal && !isPercentage) {
                                            const nextQuarterRow = reportData2.rows.slice(idx).find((reportRow) => reportRow.isQuarter);
                                            if (nextQuarterRow) {
                                                rowQuarterPrefix = nextQuarterRow.month.substring(0, 2);
                                            }
                                        }

                                        if (!isHighlight && rowQuarterPrefix && !expandedQuarters[rowQuarterPrefix]) {
                                            return null;
                                        }

                                        return (
                                            <tr
                                                key={idx}
                                                className={`border-b transition-colors ${
                                                    isTotal ? 'bg-amber-50 border-amber-200 font-black' :
                                                    isPercentage ? 'bg-slate-50 border-slate-200' :
                                                    isQuarter ? 'bg-blue-50/50 border-blue-100 font-bold cursor-pointer hover:bg-blue-100/50' :
                                                    'border-slate-50 hover:bg-slate-50'
                                                }`}
                                                onClick={() => {
                                                    if (isQuarter) {
                                                        toggleQuarter(row.month.substring(0, 2));
                                                    }
                                                }}
                                            >
                                                <td className={`py-3 px-4 ${isHighlight ? 'font-black text-slate-900' : 'font-semibold text-slate-600'} ${isQuarter ? 'pl-2' : 'pl-8'}`}>
                                                    <div className="flex items-center gap-1">
                                                        {isQuarter && (
                                                            <MdKeyboardArrowDown
                                                                className={`text-blue-500 transition-transform duration-300 ${!expandedQuarters[row.month.substring(0, 2)] ? '-rotate-90' : ''}`}
                                                                size={18}
                                                            />
                                                        )}
                                                        {row.month}
                                                    </div>
                                                </td>
                                                {reportData2.mgrCodes.map((mgr) => (
                                                    <td key={mgr} className={`py-3 px-4 text-right ${isHighlight ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                                                        {isPercentage ? `${row[mgr] || 0}%` : (row[mgr] || 0).toLocaleString()}
                                                    </td>
                                                ))}
                                                <td className={`py-3 px-4 text-right ${isTotal ? 'bg-amber-100 font-black' : isPercentage ? 'bg-slate-100 font-bold' : 'bg-amber-50/50 font-bold'} text-slate-900`}>
                                                    {isPercentage ? `${row.total}%` : (row.total || 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-10 text-center text-slate-400 font-bold">
                            {loading ? (
                                <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-8 w-8 mx-auto"></div>
                            ) : (
                                'No data available for MGR 2. Add entries with MGR 2 codes to generate this report.'
                            )}
                        </div>
                    )
                )}
            </div>

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title={`Import Planning - FY ${financialYear}`}
                type="planning"
                onImport={async (file) => {
                    const result = await importService.importPlanning(file, financialYear);
                    await fetchData();
                    return result;
                }}
                onDownloadTemplate={() => importService.getPlanningTemplate(financialYear)}
            />
        </div>
    );
};

export default PlanningScreen;
