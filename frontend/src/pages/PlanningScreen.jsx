import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    MdDelete, MdCalendarMonth, MdSave, MdDownload, MdRefresh, MdEdit, MdClose, MdKeyboardArrowDown
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { planningService, customerService, productService, mgrService } from '../services/api';
import * as XLSX from 'xlsx';

// Financial year months (Apr-Mar)
const FY_MONTHS = [
    'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
    'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'
];

const STATUS_OPTIONS = ['Firm', 'MFC', 'B & B', 'Others', 'Order Received', 'Lost', 'Parked'];

// Generate financial year options (current + next 2)
const getFinancialYears = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentYear = now.getFullYear();
    const fyStart = currentMonth >= 3 ? currentYear : currentYear - 1; // Apr onwards = current FY

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
    const startYear = parseInt(fy.split('-')[0]);
    return FY_MONTHS.map((m, idx) => {
        const year = idx < 9 ? startYear : startYear + 1;
        return `${m}-${year.toString().slice(-2)}`;
    });
};

const PlanningScreen = () => {
    const [financialYear, setFinancialYear] = useState(getFinancialYears()[1]); // default current FY
    const [entries, setEntries] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [reportData2, setReportData2] = useState(null);
    const [loading, setLoading] = useState(false);

    // Expand/Collapse state
    const [isGridExpanded, setIsGridExpanded] = useState(true);
    const [isReportExpanded, setIsReportExpanded] = useState(false);
    const [isReportExpanded2, setIsReportExpanded2] = useState(false);
    const [expandedQuarters, setExpandedQuarters] = useState({
        'Q1': false,
        'Q2': false,
        'Q3': false,
        'Q4': false
    });

    // Master data for dropdowns
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [mgrList, setMgrList] = useState([]);
    const [mgrList2, setMgrList2] = useState([]);

    const [editingId, setEditingId] = useState(null);

    // New row form
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

    // Search states for type-ahead
    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [filters, setFilters] = useState({
        mgrCode: '',
        mgrCode2: '',
        status: ''
    });

    // Define fetchData function
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [entriesRes, reportRes, report2Res] = await Promise.all([
                planningService.getAll(financialYear),
                planningService.getMGRReport(financialYear, 'MGR1'),
                planningService.getMGRReport(financialYear, 'MGR2')
            ]);
            setEntries(entriesRes.data);
            setReportData(reportRes.data);
            setReportData2(report2Res.data);
        } catch (err) {
            console.error('Failed to load planning data:', err);
        } finally {
            setLoading(false);
        }
    }, [financialYear]);

    // Fetch master data on mount
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
                setMgrList(mgrRes.data.filter(m => m.status === 'Active'));
                setMgrList2(mgr2Res.data.filter(m => m.status === 'Active'));
            } catch (err) {
                console.error('Failed to load master data:', err);
            }
        };
        fetchMasters();
    }, []);

    // Fetch entries and report when FY changes
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Filtered customer/product lists for search
    const filteredCustomers = useMemo(() => {
        if (!customerSearch) return customers.slice(0, 10);
        return customers.filter(c =>
            (c.companyName || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
            (c.customerName || '').toLowerCase().includes(customerSearch.toLowerCase())
        ).slice(0, 10);
    }, [customers, customerSearch]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return products.slice(0, 10);
        return products.filter(p =>
            (p.productName || '').toLowerCase().includes(productSearch.toLowerCase()) ||
            (p.productCode || '').toLowerCase().includes(productSearch.toLowerCase())
        ).slice(0, 10);
    }, [products, productSearch]);

    const filteredEntries = useMemo(() => {
        return entries.filter((entry) => {
            const matchesMgr1 = !filters.mgrCode || entry.mgrCode === filters.mgrCode;
            const matchesMgr2 = !filters.mgrCode2 || entry.mgrCode2 === filters.mgrCode2;
            const matchesStatus = !filters.status || entry.status === filters.status;

            return matchesMgr1 && matchesMgr2 && matchesStatus;
        });
    }, [entries, filters]);

    const hasActiveFilters = Boolean(filters.mgrCode || filters.mgrCode2 || filters.status);

    const handleNewRowChange = (field, value) => {
        setNewRow(prev => ({ ...prev, [field]: value }));
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
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
        setNewRow(prev => ({
            ...prev,
            customerId: customer._id,
            customerName: customer.companyName || customer.customerName
        }));
        setCustomerSearch(customer.companyName || customer.customerName);
        setShowCustomerDropdown(false);
    };

    const selectProduct = (product) => {
        setNewRow(prev => ({
            ...prev,
            productId: product._id,
            productName: product.productName
        }));
        setProductSearch(product.productName);
        setShowProductDropdown(false);
    };

    const handleSaveEntry = async () => {
        // Validate
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
            fetchData();
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
            mgrCode: entry.mgrCode,
            mgrCode2: entry.mgrCode2 || '',
            status: entry.status
        });
        setCustomerSearch(entry.customerName || entry.customerId?.companyName || entry.customerId?.customerName || '');
        setProductSearch(entry.productName || entry.productId?.productName || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setIsGridExpanded(true); // Ensure grid is expanded when editing
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setNewRow({ ...emptyRow });
        setCustomerSearch('');
        setProductSearch('');
    };

    const handleDeleteEntry = async (id) => {
        try {
            await planningService.delete(id);
            toast.success('Entry removed');
            fetchData();
        } catch {
            toast.error('Failed to delete entry');
        }
    };

    const exportToExcel = () => {
        if (!reportData) return;

        const wb = XLSX.utils.book_new();

        // Entries sheet
        const entriesData = filteredEntries.map(e => ({
            'Month': e.monthYear,
            'Customer': e.customerName,
            'Product': e.productName,
            'Qty': e.qty,
            'Value': e.value,
            'Total': e.totalValue,
            'MGR 1': e.mgrCode,
            'MGR 2': e.mgrCode2 || '',
            'Status': e.status
        }));
        const ws1 = XLSX.utils.json_to_sheet(entriesData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Planning Entries');

        // Report sheet
        const reportRows = reportData.rows.map(r => {
            const row = { 'Month': r.month };
            reportData.mgrCodes.forEach(mgr => { row[mgr] = r[mgr] || 0; });
            row['Total'] = r.total || 0;
            return row;
        });
        const ws2 = XLSX.utils.json_to_sheet(reportRows);
        XLSX.utils.book_append_sheet(wb, ws2, 'MGR Report');

        XLSX.writeFile(wb, `Planning-${financialYear}.xlsx`);
        toast.success('Excel downloaded');
    };

    const toggleQuarter = (quarterPrefix) => {
        setExpandedQuarters(prev => ({
            ...prev,
            [quarterPrefix]: !prev[quarterPrefix]
        }));
    };

    const monthLabels = getMonthLabels(financialYear);

    const calculatedTotal = (newRow.qty && newRow.value) ? Number(newRow.qty) * Number(newRow.value) : 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <MdCalendarMonth className="text-primary-600" />
                        Planning Screen
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Plan monthly targets by customer, product, and MGR</p>
                </div>
                <div className="flex gap-3 items-center">
                    <select
                        value={financialYear}
                        onChange={(e) => setFinancialYear(e.target.value)}
                        className="px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                    >
                        {getFinancialYears().map(fy => (
                            <option key={fy} value={fy}>FY {fy}</option>
                        ))}
                    </select>
                    <button onClick={fetchData} className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all">
                        <MdRefresh size={20} />
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
                                        {editingId ? 'Edit Entry' : 'New Entry'}
                                    </p>
                                    <h3 className="text-xl font-black text-slate-900 mt-1">
                                        {editingId ? 'Update Planning Entry' : 'Add Planning Entry'}
                                    </h3>
                                    <p className="text-sm text-slate-500 font-medium mt-1">
                                        Entry controls are now above the grid so the table has more working space.
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

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Month & Year</label>
                                    <select
                                        value={newRow.monthYear}
                                        onChange={(e) => handleNewRowChange('monthYear', e.target.value)}
                                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                                    >
                                        <option value="">Select month</option>
                                        {monthLabels.map((month) => (
                                            <option key={month} value={month}>{month}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="relative">
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Customer Name</label>
                                    <input
                                        type="text"
                                        value={customerSearch}
                                        onChange={(e) => {
                                            setCustomerSearch(e.target.value);
                                            setShowCustomerDropdown(true);
                                        }}
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        placeholder="Type customer name"
                                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                                    />
                                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                            {filteredCustomers.map((customer) => (
                                                <button
                                                    key={customer._id}
                                                    onClick={() => selectCustomer(customer)}
                                                    className="w-full text-left px-3 py-2.5 text-sm font-bold hover:bg-primary-50 transition-colors border-b border-slate-50"
                                                >
                                                    {customer.companyName || customer.customerName}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="relative">
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Product</label>
                                    <input
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => {
                                            setProductSearch(e.target.value);
                                            setShowProductDropdown(true);
                                        }}
                                        onFocus={() => setShowProductDropdown(true)}
                                        placeholder="Type product name"
                                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                                    />
                                    {showProductDropdown && filteredProducts.length > 0 && (
                                        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
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
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Qty</label>
                                    <input
                                        type="number"
                                        value={newRow.qty}
                                        onChange={(e) => handleNewRowChange('qty', e.target.value)}
                                        placeholder="0"
                                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 text-right bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Value</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newRow.value}
                                        onChange={(e) => handleNewRowChange('value', e.target.value)}
                                        placeholder="0"
                                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 text-right bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Qty * Value</label>
                                    <div className="px-3 py-3 rounded-xl bg-amber-50 border border-amber-100 text-lg font-black text-slate-900">
                                        {calculatedTotal.toLocaleString()}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">MGR 1</label>
                                    <select
                                        value={newRow.mgrCode}
                                        onChange={(e) => handleNewRowChange('mgrCode', e.target.value)}
                                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                                    >
                                        <option value="">Select MGR 1</option>
                                        {mgrList.map((mgr) => (
                                            <option key={mgr._id} value={mgr.code}>{mgr.code} - {mgr.description}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">MGR 2</label>
                                    <select
                                        value={newRow.mgrCode2}
                                        onChange={(e) => handleNewRowChange('mgrCode2', e.target.value)}
                                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                                    >
                                        <option value="">Select MGR 2</option>
                                        {mgrList2.map((mgr) => (
                                            <option key={mgr._id} value={mgr.code}>{mgr.code} - {mgr.description}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Status</label>
                                    <select
                                        value={newRow.status}
                                        onChange={(e) => handleNewRowChange('status', e.target.value)}
                                        className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                                    >
                                        <option value="">Select status</option>
                                        {STATUS_OPTIONS.map((status) => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="xl:col-span-2">
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Action</label>
                                    <button
                                        onClick={handleSaveEntry}
                                        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-bold transition-colors ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                    >
                                        <MdSave size={18} />
                                        {editingId ? 'Update Entry' : 'Save Entry'}
                                    </button>
                                </div>
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

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-amber-50 border-b border-amber-100">
                                        <th className="py-3 px-4 font-black text-slate-700 text-xs min-w-[110px]">Month & Year</th>
                                        <th className="py-3 px-4 font-black text-slate-700 text-xs min-w-[180px]">Customer Name</th>
                                        <th className="py-3 px-4 font-black text-slate-700 text-xs min-w-[260px]">Product</th>
                                        <th className="py-3 px-4 font-black text-slate-700 text-xs text-right min-w-[90px]">Qty</th>
                                        <th className="py-3 px-4 font-black text-slate-700 text-xs text-right min-w-[110px]">Value</th>
                                        <th className="py-3 px-4 font-black text-slate-700 text-xs text-right bg-amber-100 min-w-[120px]">Qty * Value</th>
                                        <th className="py-3 px-4 font-black text-slate-700 text-xs min-w-[110px]">MGR 1</th>
                                        <th className="py-3 px-4 font-black text-slate-700 text-xs text-center min-w-[110px]">MGR 2</th>
                                        <th className="py-3 px-4 font-black text-slate-700 text-xs min-w-[150px]">Status</th>
                                        <th className="py-3 px-4 font-black text-slate-700 text-xs text-center min-w-[100px]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="10" className="py-10 text-center">
                                                <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-8 w-8 mx-auto"></div>
                                            </td>
                                        </tr>
                                    ) : filteredEntries.length > 0 ? (
                                        filteredEntries.map((entry) => (
                                            <tr key={entry._id} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-4 font-bold text-slate-700 text-xs">{entry.monthYear}</td>
                                                <td className="py-3 px-4 font-bold text-slate-900 text-xs">{entry.customerName}</td>
                                                <td className="py-3 px-4 text-slate-700 text-xs">{entry.productName}</td>
                                                <td className="py-3 px-4 text-right font-bold text-slate-700 text-xs">{entry.qty}</td>
                                                <td className="py-3 px-4 text-right font-bold text-slate-700 text-xs">{entry.value?.toLocaleString()}</td>
                                                <td className="py-3 px-4 text-right font-black text-slate-900 text-xs bg-amber-50/50">
                                                    {entry.totalValue?.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4 text-xs">
                                                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-bold">{entry.mgrCode}</span>
                                                </td>
                                                <td className="py-3 px-4 text-xs text-center">
                                                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded font-bold">{entry.mgrCode2 || '-'}</span>
                                                </td>
                                                <td className="py-3 px-4 text-xs">
                                                    <span className={`px-2 py-1 rounded font-bold ${getStatusClasses(entry.status)}`}>
                                                        {entry.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
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
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="10" className="py-10 text-center text-slate-400 font-bold text-sm">
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

            {/* Dynamic MGR Report */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div 
                    className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => setIsReportExpanded(!isReportExpanded)}
                >
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <MdKeyboardArrowDown className={`text-slate-500 transition-transform duration-300 ${!isReportExpanded ? '-rotate-90' : ''}`} size={20} />
                        Dynamic MGR 1 Report — FY {financialYear}
                    </h2>
                </div>

                {/* Report Table 1 Contents ... */}
                {isReportExpanded && (
                    reportData && reportData.mgrCodes.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-amber-50 border-b border-amber-100">
                                        <th className="py-3 px-4 font-black text-slate-700 min-w-[100px]"></th>
                                        {reportData.mgrCodes.map(mgr => (
                                            <th key={mgr} className="py-3 px-4 font-black text-slate-700 text-right min-w-[100px]">{mgr}</th>
                                        ))}
                                        <th className="py-3 px-4 font-black text-slate-900 text-right bg-amber-100 min-w-[100px]">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        return reportData.rows.map((row, idx) => {
                                            const isQuarter = row.isQuarter;
                                            const isTotal = row.isTotal;
                                            const isPercentage = row.isPercentage;
                                            const isHighlight = isQuarter || isTotal || isPercentage;

                                            let rowQuarterPrefix = null;
                                            if (isQuarter) {
                                                rowQuarterPrefix = row.month.substring(0, 2);
                                            } else if (!isTotal && !isPercentage) {
                                                const nextQuarterRow = reportData.rows.slice(idx).find(r => r.isQuarter);
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
                                                            const prefix = row.month.substring(0, 2);
                                                            toggleQuarter(prefix);
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
                                                    {reportData.mgrCodes.map(mgr => (
                                                        <td key={mgr} className={`py-3 px-4 text-right ${isHighlight ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                                                            {isPercentage ? `${row[mgr] || 0}%` : (row[mgr] || 0).toLocaleString()}
                                                        </td>
                                                    ))}
                                                    <td className={`py-3 px-4 text-right ${isTotal ? 'bg-amber-100 font-black' : isPercentage ? 'bg-slate-100 font-bold' : 'bg-amber-50/50 font-bold'} text-slate-900`}>
                                                        {isPercentage ? `${row.total}%` : (row.total || 0).toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
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

            {/* Dynamic MGR 2 Report */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div 
                    className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => setIsReportExpanded2(!isReportExpanded2)}
                >
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <MdKeyboardArrowDown className={`text-slate-500 transition-transform duration-300 ${!isReportExpanded2 ? '-rotate-90' : ''}`} size={20} />
                        Dynamic MGR 2 Report — FY {financialYear}
                    </h2>
                </div>

                {isReportExpanded2 && (
                    reportData2 && reportData2.mgrCodes.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-amber-50 border-b border-amber-100">
                                        <th className="py-3 px-4 font-black text-slate-700 min-w-[100px]"></th>
                                        {reportData2.mgrCodes.map(mgr => (
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
                                            const nextQuarterRow = reportData2.rows.slice(idx).find(r => r.isQuarter);
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
                                                        const prefix = row.month.substring(0, 2);
                                                        toggleQuarter(prefix);
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
                                                {reportData2.mgrCodes.map(mgr => (
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
        </div>
    );
};

export default PlanningScreen;
