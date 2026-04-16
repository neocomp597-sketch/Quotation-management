import React, { useState, useEffect, useMemo } from 'react';
import {
    MdAdd, MdDelete, MdCalendarMonth, MdSave, MdDownload, MdRefresh, MdEdit, MdClose, MdKeyboardArrowDown, MdKeyboardArrowRight
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { planningService, customerService, productService, mgrService } from '../services/api';
import * as XLSX from 'xlsx';

// Financial year months (Apr-Mar)
const FY_MONTHS = [
    'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
    'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'
];

const STATUS_OPTIONS = ['Firm', 'MFC', 'B & B', 'Others'];

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
    const [loading, setLoading] = useState(false);

    // Expand/Collapse state
    const [isGridExpanded, setIsGridExpanded] = useState(true);
    const [isReportExpanded, setIsReportExpanded] = useState(true);
    const [expandedQuarters, setExpandedQuarters] = useState({
        'Q1': true,
        'Q2': true,
        'Q3': true,
        'Q4': true
    });

    // Master data for dropdowns
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [mgrList, setMgrList] = useState([]);

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
        status: ''
    };
    const [newRow, setNewRow] = useState({ ...emptyRow });

    // Search states for type-ahead
    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [showProductDropdown, setShowProductDropdown] = useState(false);

    // Fetch master data on mount
    useEffect(() => {
        const fetchMasters = async () => {
            try {
                const [custRes, prodRes, mgrRes] = await Promise.all([
                    customerService.getAll(),
                    productService.getAll(),
                    mgrService.getAll('MGR1')
                ]);
                setCustomers(custRes.data);
                setProducts(prodRes.data);
                setMgrList(mgrRes.data.filter(m => m.status === 'Active'));
            } catch (err) {
                console.error('Failed to load master data:', err);
            }
        };
        fetchMasters();
    }, []);

    // Fetch entries and report when FY changes
    useEffect(() => {
        fetchData();
    }, [financialYear]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [entriesRes, reportRes] = await Promise.all([
                planningService.getAll(financialYear),
                planningService.getMGRReport(financialYear)
            ]);
            setEntries(entriesRes.data);
            setReportData(reportRes.data);
        } catch (err) {
            console.error('Failed to load planning data:', err);
        } finally {
            setLoading(false);
        }
    };

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

    const handleNewRowChange = (field, value) => {
        setNewRow(prev => ({ ...prev, [field]: value }));
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
            toast.error('Please fill all fields');
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
            productName: entry.productName || entry.productId?.name || '',
            qty: entry.qty,
            value: entry.value,
            mgrCode: entry.mgrCode,
            status: entry.status
        });
        setCustomerSearch(entry.customerName || entry.customerId?.companyName || entry.customerId?.customerName || '');
        setProductSearch(entry.productName || entry.productId?.name || '');
        window.scrollTo({ top: 300, behavior: 'smooth' });
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
        const entriesData = entries.map(e => ({
            'Month': e.monthYear,
            'Customer': e.customerName,
            'Product': e.productName,
            'Qty': e.qty,
            'Value': e.value,
            'Total': e.totalValue,
            'MGR': e.mgrCode,
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

            {/* Data Entry Grid border */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div 
                    className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => setIsGridExpanded(!isGridExpanded)}
                >
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <MdKeyboardArrowDown className={`text-slate-500 transition-transform duration-300 ${!isGridExpanded ? '-rotate-90' : ''}`} size={20}/>
                        Planning Grid
                    </h2>
                </div>

                {isGridExpanded && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-amber-50 border-b border-amber-100">
                                <th className="py-3 px-3 font-black text-slate-700 text-xs">Month & Year</th>
                                <th className="py-3 px-3 font-black text-slate-700 text-xs">Customer Name</th>
                                <th className="py-3 px-3 font-black text-slate-700 text-xs">Product</th>
                                <th className="py-3 px-3 font-black text-slate-700 text-xs text-right">Qty</th>
                                <th className="py-3 px-3 font-black text-slate-700 text-xs text-right">Value</th>
                                <th className="py-3 px-3 font-black text-slate-700 text-xs text-right bg-amber-100">Qty * Value</th>
                                <th className="py-3 px-3 font-black text-slate-700 text-xs">MGR 1</th>
                                <th className="py-3 px-3 font-black text-slate-700 text-xs">Status</th>
                                <th className="py-3 px-3 font-black text-slate-700 text-xs text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {/* New Entry Row */}
                            <tr className="bg-green-50/50 border-b-2 border-green-100">
                                <td className="py-2 px-3">
                                    <select
                                        value={newRow.monthYear}
                                        onChange={(e) => handleNewRowChange('monthYear', e.target.value)}
                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary-500 bg-white"
                                    >
                                        <option value="">Select</option>
                                        {monthLabels.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="py-2 px-3 relative">
                                    <input
                                        type="text"
                                        value={customerSearch}
                                        onChange={(e) => {
                                            setCustomerSearch(e.target.value);
                                            setShowCustomerDropdown(true);
                                        }}
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        placeholder="Type to search..."
                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary-500"
                                    />
                                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                                        <div className="absolute z-50 left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto custom-scrollbar">
                                            {filteredCustomers.map(c => (
                                                <button
                                                    key={c._id}
                                                    onClick={() => selectCustomer(c)}
                                                    className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-primary-50 transition-colors border-b border-slate-50"
                                                >
                                                    {c.companyName || c.customerName}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="py-2 px-3 relative">
                                    <input
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => {
                                            setProductSearch(e.target.value);
                                            setShowProductDropdown(true);
                                        }}
                                        onFocus={() => setShowProductDropdown(true)}
                                        placeholder="Type to search..."
                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary-500"
                                    />
                                    {showProductDropdown && filteredProducts.length > 0 && (
                                        <div className="absolute z-50 left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto custom-scrollbar">
                                            {filteredProducts.map(p => (
                                                <button
                                                    key={p._id}
                                                    onClick={() => selectProduct(p)}
                                                    className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-primary-50 transition-colors border-b border-slate-50"
                                                >
                                                    {p.productName}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="py-2 px-3">
                                    <input
                                        type="number"
                                        min="0"
                                        value={newRow.qty}
                                        onChange={(e) => handleNewRowChange('qty', e.target.value)}
                                        placeholder="0"
                                        className="w-20 px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary-500 text-right"
                                    />
                                </td>
                                <td className="py-2 px-3">
                                    <input
                                        type="number"
                                        min="0"
                                        value={newRow.value}
                                        onChange={(e) => handleNewRowChange('value', e.target.value)}
                                        placeholder="0"
                                        className="w-24 px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary-500 text-right"
                                    />
                                </td>
                                <td className="py-2 px-3 bg-amber-50">
                                    <span className="text-sm font-black text-slate-900">
                                        {calculatedTotal.toLocaleString()}
                                    </span>
                                </td>
                                <td className="py-2 px-3">
                                    <select
                                        value={newRow.mgrCode}
                                        onChange={(e) => handleNewRowChange('mgrCode', e.target.value)}
                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary-500 bg-white"
                                    >
                                        <option value="">Select</option>
                                        {mgrList.map(m => (
                                            <option key={m._id} value={m.code}>{m.code} - {m.description}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="py-2 px-3">
                                    <select
                                        value={newRow.status}
                                        onChange={(e) => handleNewRowChange('status', e.target.value)}
                                        className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary-500 bg-white"
                                    >
                                        <option value="">Select</option>
                                        {STATUS_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="py-2 px-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={handleSaveEntry}
                                            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-white rounded-lg transition-all font-bold text-xs uppercase tracking-widest ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                            title={editingId ? "Update Entry" : "Save Entry"}
                                        >
                                            <MdSave size={16} />
                                            {editingId ? 'Update' : 'Save'}
                                        </button>
                                        {editingId && (
                                            <button
                                                onClick={handleCancelEdit}
                                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all font-bold text-xs uppercase tracking-widest"
                                                title="Cancel Edit"
                                            >
                                                <MdClose size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>

                            {/* Existing Entries */}
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="py-10 text-center">
                                        <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-8 w-8 mx-auto"></div>
                                    </td>
                                </tr>
                            ) : entries.length > 0 ? (
                                entries.map((entry) => (
                                    <tr key={entry._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-3 font-bold text-slate-700 text-xs">{entry.monthYear}</td>
                                        <td className="py-3 px-3 font-bold text-slate-900 text-xs">{entry.customerName}</td>
                                        <td className="py-3 px-3 text-slate-700 text-xs">{entry.productName}</td>
                                        <td className="py-3 px-3 text-right font-bold text-slate-700 text-xs">{entry.qty}</td>
                                        <td className="py-3 px-3 text-right font-bold text-slate-700 text-xs">{entry.value?.toLocaleString()}</td>
                                        <td className="py-3 px-3 text-right font-black text-slate-900 text-xs bg-amber-50/50">
                                            {entry.totalValue?.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-xs">
                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-bold">{entry.mgrCode}</span>
                                        </td>
                                        <td className="py-3 px-3 text-xs">
                                            <span className={`px-2 py-1 rounded font-bold ${
                                                entry.status === 'Firm' ? 'bg-emerald-50 text-emerald-700' :
                                                entry.status === 'MFC' ? 'bg-amber-50 text-amber-700' :
                                                entry.status === 'B & B' ? 'bg-purple-50 text-purple-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {entry.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
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
                                    <td colSpan="9" className="py-10 text-center text-slate-400 font-bold text-sm">
                                        No planning entries for FY {financialYear}. Add your first entry above.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
                        Dynamic MGR Report — FY {financialYear}
                    </h2>
                </div>

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
                                        let currentQuarter = null;
                                        return reportData.rows.map((row, idx) => {
                                            const isQuarter = row.isQuarter;
                                            const isTotal = row.isTotal;
                                            const isPercentage = row.isPercentage;
                                            const isHighlight = isQuarter || isTotal || isPercentage;

                                            // Determine current quarter from the quarter row text "Q1 2026-27"
                                            let rowQuarterPrefix = null;
                                            if (isQuarter) {
                                                rowQuarterPrefix = row.month.substring(0, 2); // "Q1", "Q2" etc.
                                            } else if (!isTotal && !isPercentage) {
                                                // It's a month row. Find which quarter it belongs to based on the next quarter row
                                                const nextQuarterRow = reportData.rows.slice(idx).find(r => r.isQuarter);
                                                if (nextQuarterRow) {
                                                    rowQuarterPrefix = nextQuarterRow.month.substring(0, 2);
                                                }
                                            }

                                            // If it's a month row and the corresponding quarter is collapsed, don't render it
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
        </div>
    );
};

export default PlanningScreen;
