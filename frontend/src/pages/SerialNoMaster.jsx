import React, { useState, useEffect, useMemo } from 'react';
import { csmService, productService, importService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import {
    MdSearch, MdTag, MdInfoOutline, MdSync,
    MdLocalOffer, MdPeople, MdReceipt, MdAssignmentTurnedIn,
    MdFileUpload, MdFileDownload, MdAdd, MdUndo, MdDelete, MdHistory
} from 'react-icons/md';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';
import PaginationControls from '../components/PaginationControls';

const PAGE_SIZE = 15;

const SerialNoMaster = () => {
    const { user, isAdmin, isSuperAdmin } = useAuth();
    const [assets, setAssets] = useState([]);
    const [returnHistory, setReturnHistory] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'returns'

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [selectedProduct, setSelectedProduct] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Permission check for Delete Entry (Requirement #11, #12)
    const canDelete = useMemo(() => {
        if (isAdmin || isSuperAdmin || user?.role === 'admin' || user?.role === 'superadmin') return true;
        const perms = user?.permissions || {};
        return Boolean(perms.invoice_bulk_upload_delete || perms.master_serials_delete);
    }, [user, isAdmin, isSuperAdmin]);

    // Detailed modal view
    const [selectedAssetSerial, setSelectedAssetSerial] = useState(null);
    const [assetSummary, setAssetSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // --- SINGLE ENTRY MODAL ---
    const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
    const [singleSaving, setSingleSaving] = useState(false);
    const [singleForm, setSingleForm] = useState({
        serialNumber: '',
        productCode: '',
        productName: '',
        status: 'IN_STOCK',
        customer: '',
        customerPostalCode: '',
        invoiceNumber: '',
        saleDate: '',
        location: '',
        mgr1: '',
        mgr2: '',
        mgr3: '',
        mgr4: '',
        mgr5: '',
        indicatorField: ''
    });

    // --- SALES RETURN MODAL ---
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [returnTargetAsset, setReturnTargetAsset] = useState(null);
    const [returnReason, setReturnReason] = useState('');
    const [returnSaving, setReturnSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [assetsRes, productsRes] = await Promise.all([
                csmService.getAssets(),
                productService.getAll()
            ]);
            setAssets(assetsRes.data || []);
            setProducts(productsRes.data || []);
        } catch (err) {
            console.error('Error fetching Invoice Bulk Upload data:', err);
            toast.error('Failed to load invoice bulk upload data');
        } finally {
            setLoading(false);
        }
    };

    const fetchReturnHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await csmService.getReturnHistory();
            setReturnHistory(res.data || []);
        } catch (err) {
            console.error('Error fetching return history:', err);
            toast.error('Failed to load return history');
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setCurrentPage(1);
        if (tab === 'returns' && returnHistory.length === 0) {
            fetchReturnHistory();
        }
    };

    // Standardized 15-Column Export (Requirement #2)
    const handleExport = () => {
        const dataToExport = activeTab === 'returns' ? returnHistory : filteredAssets;
        if (!dataToExport || dataToExport.length === 0) {
            toast.error('No records to export');
            return;
        }

        const exportData = dataToExport.map(asset => {
            const prodName = asset.productId?.productName || asset.productName || '';
            const prodCode = asset.productId?.productCode || asset.productCode || '';
            const custName = asset.customerId?.companyName || asset.customerId?.customerName || asset.customerNameStr || asset.customerName || (asset.customerId ? 'Customer' : 'Stock (Unsold)');
            const sDate = asset.saleDate || asset.invoiceDate;

            return {
                'Serial Number': asset.serialNumber || '',
                'Product Name': prodName,
                'Product Code': prodCode,
                'Status': asset.status || 'IN_STOCK',
                'Customer': custName,
                'Customer Postal Code': asset.customerPostalCode || '',
                'Invoice Ref': asset.invoiceNumber || '',
                'Sale Date': sDate ? new Date(sDate).toLocaleDateString('en-IN') : '',
                'Location': asset.location || '',
                'Mgr 1': asset.mgr1 || '',
                'Mgr 2': asset.mgr2 || '',
                'Mgr 3': asset.mgr3 || '',
                'Mgr 4': asset.mgr4 || '',
                'Mgr 5': asset.mgr5 || '',
                'Indicator_Field': asset.indicatorField || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, activeTab === 'returns' ? 'Return History' : 'Invoice Bulk Upload');
        XLSX.writeFile(wb, `Invoice_Bulk_Upload_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success(`Exported ${exportData.length} records`);
    };

    const handleViewDetail = async (serialNumber) => {
        setSelectedAssetSerial(serialNumber);
        setIsDetailModalOpen(true);
        setLoadingSummary(true);
        setAssetSummary(null);
        try {
            const res = await csmService.getAssetSummary({ serialNumber });
            setAssetSummary(res.data);
        } catch (err) {
            console.error('Error fetching asset summary:', err);
            toast.error('Failed to load asset details');
        } finally {
            setLoadingSummary(false);
        }
    };

    // Open Sales Return Modal (Requirement #6)
    const handleOpenReturnModal = (asset) => {
        setReturnTargetAsset(asset);
        setReturnReason('');
        setIsReturnModalOpen(true);
    };

    // Submit Sales Return (Requirement #6, #7, #8)
    const handleSalesReturnSubmit = async () => {
        if (!returnReason.trim()) {
            return toast.error('Please enter return reason');
        }
        if (!returnTargetAsset) return;

        setReturnSaving(true);
        try {
            await csmService.returnAsset(returnTargetAsset._id, returnReason);
            toast.success(`Sales return recorded for Serial: ${returnTargetAsset.serialNumber}`);
            setIsReturnModalOpen(false);
            setReturnTargetAsset(null);
            setReturnReason('');
            fetchData();
            if (activeTab === 'returns') fetchReturnHistory();
        } catch (err) {
            console.error('Sales return error:', err);
            toast.error(err.response?.data?.message || 'Failed to process sales return');
        } finally {
            setReturnSaving(false);
        }
    };

    // Delete Entry (Requirement #11, #12)
    const handleDeleteEntry = async (asset) => {
        if (!window.confirm(`Are you sure you want to delete entry for Serial: "${asset.serialNumber}"?`)) {
            return;
        }

        try {
            await csmService.deleteAsset(asset._id);
            toast.success('Entry deleted successfully');
            fetchData();
        } catch (err) {
            console.error('Delete entry error:', err);
            toast.error(err.response?.data?.message || 'Failed to delete entry');
        }
    };

    // Single Entry Submit (Requirement #15)
    const handleSingleEntrySubmit = async (e) => {
        e.preventDefault();
        if (!singleForm.serialNumber.trim() || !singleForm.productCode.trim()) {
            return toast.error('Serial Number and Product Code are required');
        }

        setSingleSaving(true);
        try {
            await csmService.createSingleAsset(singleForm);
            toast.success('Single entry created successfully!');
            setIsSingleModalOpen(false);
            setSingleForm({
                serialNumber: '',
                productCode: '',
                productName: '',
                status: 'IN_STOCK',
                customer: '',
                customerPostalCode: '',
                invoiceNumber: '',
                saleDate: '',
                location: '',
                mgr1: '',
                mgr2: '',
                mgr3: '',
                mgr4: '',
                mgr5: '',
                indicatorField: ''
            });
            fetchData();
        } catch (err) {
            console.error('Single entry creation error:', err);
            toast.error(err.response?.data?.message || 'Failed to create single entry');
        } finally {
            setSingleSaving(false);
        }
    };

    // Customer Name Search + Product Code + Product Name + Serial No + Invoice Ref (Requirement #10)
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const custName = (
                asset.customerId?.companyName ||
                asset.customerId?.customerName ||
                asset.customerNameStr ||
                ''
            ).toLowerCase();

            const prodName = (asset.productId?.productName || '').toLowerCase();
            const prodCode = (asset.productId?.productCode || '').toLowerCase();
            const serialNo = (asset.serialNumber || '').toLowerCase();
            const invNo = (asset.invoiceNumber || '').toLowerCase();
            const query = searchQuery.trim().toLowerCase();

            const matchesQuery = !query ||
                serialNo.includes(query) ||
                prodName.includes(query) ||
                prodCode.includes(query) ||
                invNo.includes(query) ||
                custName.includes(query);

            const matchesStatus = selectedStatus === 'ALL' || asset.status === selectedStatus;
            const matchesProduct = selectedProduct === 'ALL' || asset.productId?._id === selectedProduct;
            return matchesQuery && matchesStatus && matchesProduct;
        });
    }, [assets, searchQuery, selectedStatus, selectedProduct]);

    const filteredReturns = useMemo(() => {
        return returnHistory.filter(item => {
            const custName = (item.customerId?.companyName || item.customerId?.customerName || item.customerName || '').toLowerCase();
            const prodName = (item.productId?.productName || item.productName || '').toLowerCase();
            const prodCode = (item.productId?.productCode || item.productCode || '').toLowerCase();
            const serialNo = (item.serialNumber || '').toLowerCase();
            const invNo = (item.invoiceNumber || '').toLowerCase();
            const reason = (item.returnReason || '').toLowerCase();
            const query = searchQuery.trim().toLowerCase();

            return !query ||
                serialNo.includes(query) ||
                prodName.includes(query) ||
                prodCode.includes(query) ||
                invNo.includes(query) ||
                custName.includes(query) ||
                reason.includes(query);
        });
    }, [returnHistory, searchQuery]);

    const stats = useMemo(() => {
        const total = assets.length;
        const inStock = assets.filter(a => a.status === 'IN_STOCK').length;
        const sold = assets.filter(a => a.status === 'SOLD').length;
        const returned = assets.filter(a => a.status === 'RETURN' || a.status === 'RETURNED').length;
        return { total, inStock, sold, returned };
    }, [assets]);

    const activeList = activeTab === 'returns' ? filteredReturns : filteredAssets;
    const totalPages = Math.ceil(activeList.length / PAGE_SIZE) || 1;
    const paginatedAssets = useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return activeList.slice(startIndex, startIndex + PAGE_SIZE);
    }, [activeList, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedStatus, selectedProduct, activeTab]);

    return (
        <div className="space-y-6">
            {/* Header (Requirement #1, #16) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 font-outfit uppercase">
                        <MdTag className="text-primary-600" />
                        <span>Invoice Bulk Upload</span>
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">Track serial numbers, invoice information, customers and product transactions.</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center justify-start md:justify-end">
                    <button
                        onClick={() => setIsSingleModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-black transition-all uppercase text-[10px] tracking-widest active:scale-95 shadow-md shadow-emerald-600/10"
                        title="Add Single Invoice/Serial Record"
                    >
                        <MdAdd size={18} />
                        <span>Add Single Entry</span>
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-3 rounded-2xl font-black transition-all uppercase text-[10px] tracking-widest active:scale-95 shadow-md shadow-slate-900/10"
                        title="Import Assets / Serials Excel"
                    >
                        <MdFileUpload size={18} />
                        <span>Import</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-3 rounded-2xl font-black transition-all uppercase text-[10px] tracking-widest active:scale-95 shadow-md shadow-teal-600/10"
                        title="Export Assets / Serials Excel"
                    >
                        <MdFileDownload size={18} />
                        <span>Export</span>
                    </button>
                    <button
                        onClick={() => { fetchData(); if (activeTab === 'returns') fetchReturnHistory(); }}
                        className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-2xl font-black transition-all uppercase text-[10px] tracking-widest active:scale-95 border border-slate-200 shadow-sm"
                        title="Refresh Data"
                    >
                        <MdSync size={18} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-white border border-slate-200/80 rounded-[2rem] shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                    <div className="p-3.5 bg-slate-100 text-slate-600 rounded-2xl"><MdTag size={24} /></div>
                    <div><span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Total Serials</span><span className="text-2xl font-black text-slate-900">{stats.total}</span></div>
                </div>
                <div className="p-5 bg-white border border-slate-200/80 rounded-[2rem] shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                    <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl"><MdLocalOffer size={24} /></div>
                    <div><span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">In Stock</span><span className="text-2xl font-black text-emerald-600">{stats.inStock}</span></div>
                </div>
                <div className="p-5 bg-white border border-slate-200/80 rounded-[2rem] shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                    <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl"><MdPeople size={24} /></div>
                    <div><span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Sold (Customer)</span><span className="text-2xl font-black text-blue-600">{stats.sold}</span></div>
                </div>
                <div className="p-5 bg-white border border-slate-200/80 rounded-[2rem] shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                    <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl"><MdUndo size={24} /></div>
                    <div><span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Returned</span><span className="text-2xl font-black text-amber-600">{stats.returned}</span></div>
                </div>
            </div>

            {/* View Mode Header Switcher & Toolbar Filters (Requirement #10, #16) */}
            <div className="bg-white rounded-[2rem] border border-slate-200/80 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <button
                        onClick={() => handleTabChange('active')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'active'
                                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20 scale-100'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                        }`}
                    >
                        <span>Active Inventory</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>{assets.length}</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('returns')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'returns'
                                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20 scale-100'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                        }`}
                    >
                        <span>Return History</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'returns' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>{returnHistory.length}</span>
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 w-full relative group">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Search by serial number, product, invoice, or customer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:bg-white focus:border-teal-500 transition-all outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                        />
                    </div>
                    {activeTab === 'active' && (
                        <div className="grid grid-cols-2 md:flex gap-3 w-full md:w-auto">
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="IN_STOCK">In Stock</option>
                                <option value="SOLD">Sold</option>
                                <option value="ALLOCATED">Allocated</option>
                                <option value="RETURN">Returned</option>
                                <option value="SCRAPPED">Scrapped</option>
                            </select>
                            <select
                                value={selectedProduct}
                                onChange={(e) => setSelectedProduct(e.target.value)}
                                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all max-w-[200px] truncate"
                            >
                                <option value="ALL">All Products</option>
                                {products.map(p => (
                                    <option key={p._id} value={p._id}>{p.productName}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* List Table (Requirement #16) */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6">
                    {loading || (activeTab === 'returns' && loadingHistory) ? (
                        <div className="py-20 text-center text-slate-400 font-medium">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-xs uppercase font-black tracking-widest">Loading records...</p>
                        </div>
                    ) : activeTab === 'returns' ? (
                        /* RETURN HISTORY TABLE (Requirement #9) */
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 rounded-xl text-xs font-black text-slate-400 uppercase tracking-widest">
                                            <th className="p-4 first:rounded-l-xl">Serial No</th>
                                            <th className="p-4">Product Details</th>
                                            <th className="p-4">Customer</th>
                                            <th className="p-4">Invoice</th>
                                            <th className="p-4">Return Date</th>
                                            <th className="p-4">Return Reason</th>
                                            <th className="p-4 text-right last:rounded-r-xl">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedAssets.map(item => (
                                            <tr key={item._id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 text-sm font-black text-slate-900 font-mono tracking-wide">
                                                    {item.serialNumber}
                                                </td>
                                                <td className="p-4">
                                                    <span className="block text-sm font-bold text-slate-800">
                                                        {item.productId?.productName || item.productName || 'N/A'}
                                                    </span>
                                                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                                        {item.productId?.productCode || item.productCode || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm font-semibold text-slate-700">
                                                    {item.customerId?.companyName || item.customerId?.customerName || item.customerName || 'Customer'}
                                                </td>
                                                <td className="p-4 text-sm font-bold text-slate-800">
                                                    {item.invoiceNumber ? (
                                                        <span className="font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200 text-xs">{item.invoiceNumber}</span>
                                                    ) : '-'}
                                                </td>
                                                <td className="p-4 text-sm font-medium text-slate-600">
                                                    {item.returnDate || item.createdAt ? new Date(item.returnDate || item.createdAt).toLocaleDateString('en-IN') : '-'}
                                                </td>
                                                <td className="p-4 text-sm text-slate-700 max-w-xs font-semibold">
                                                    <div className="p-2 bg-amber-50/60 border border-amber-100 rounded-xl text-amber-900 text-xs">
                                                        {item.returnReason || 'Product Fault / Return'}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-600 border-amber-200">
                                                        RETURN
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredReturns.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-12 text-center text-slate-400 text-sm font-medium">
                                                    No returned product history records found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls pagination={{ page: currentPage, limit: PAGE_SIZE, total: filteredReturns.length, pages: totalPages }} onPageChange={setCurrentPage} />
                        </>
                    ) : (
                        /* ACTIVE INVENTORY TABLE (Requirement #16) */
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 rounded-xl text-xs font-black text-slate-400 uppercase tracking-widest">
                                            <th className="p-4 first:rounded-l-xl">Serial Number</th>
                                            <th className="p-4">Product Details</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4">Customer</th>
                                            <th className="p-4">Invoice Ref</th>
                                            <th className="p-4">Sale Date</th>
                                            <th className="p-4">Location</th>
                                            <th className="p-4 text-right last:rounded-r-xl">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedAssets.map(asset => {
                                            const custDisplay = asset.customerId?.companyName || asset.customerId?.customerName || asset.customerNameStr || (asset.customerId ? 'Customer' : '');
                                            return (
                                                <tr key={asset._id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-4 text-sm font-black text-slate-900 font-mono tracking-wide">
                                                        {asset.serialNumber}
                                                        {asset.indicatorField && (
                                                            <span className="block text-[9px] font-bold text-primary-600 tracking-wider">
                                                                Indicator: {asset.indicatorField}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="block text-sm font-bold text-slate-800">{asset.productId?.productName || 'N/A'}</span>
                                                        <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{asset.productId?.productCode || 'N/A'}</span>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                            asset.status === 'SOLD'
                                                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                                                : asset.status === 'IN_STOCK'
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                                : asset.status === 'RETURN' || asset.status === 'RETURNED'
                                                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                                        }`}>
                                                            {asset.status || 'IN_STOCK'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-sm font-semibold text-slate-700">
                                                        {custDisplay ? (
                                                            <span>{custDisplay}</span>
                                                        ) : (
                                                            <span className="text-slate-400 font-normal italic">Stock (Unsold)</span>
                                                        )}
                                                        {asset.customerPostalCode && (
                                                            <span className="block text-[10px] text-slate-400 font-bold">Pin: {asset.customerPostalCode}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-sm font-bold text-slate-800">
                                                        {asset.invoiceNumber ? (
                                                            <span className="font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200 text-xs">{asset.invoiceNumber}</span>
                                                        ) : <span className="text-slate-300 font-normal">-</span>}
                                                    </td>
                                                    <td className="p-4 text-sm font-medium text-slate-600">
                                                        {asset.saleDate || asset.invoiceDate
                                                            ? new Date(asset.saleDate || asset.invoiceDate).toLocaleDateString('en-IN')
                                                            : <span className="text-slate-300 font-normal">-</span>
                                                        }
                                                    </td>
                                                    <td className="p-4 text-xs font-semibold text-slate-600">
                                                        {asset.location || '-'}
                                                    </td>
                                                    {/* Actions Column: View Info, Sales Return, Delete Entry (Requirement #6, #11, #12, #16) */}
                                                    <td className="p-4 text-right">
                                                        <div className="flex justify-end items-center gap-1.5">
                                                            <button
                                                                onClick={() => handleViewDetail(asset.serialNumber)}
                                                                className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                                title="View Details"
                                                            >
                                                                <MdInfoOutline size={18} />
                                                            </button>
                                                            {asset.status === 'SOLD' && (
                                                                <button
                                                                    onClick={() => handleOpenReturnModal(asset)}
                                                                    className="flex items-center gap-1 px-2.5 py-1 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold transition-all active:scale-95"
                                                                    title="Sales Return"
                                                                >
                                                                    <MdUndo size={16} />
                                                                    <span>Sales Return</span>
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteEntry(asset)}
                                                                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                                    title="Delete Entry (Admin Restricted)"
                                                                >
                                                                    <MdDelete size={18} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredAssets.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="p-12 text-center text-slate-400 text-sm font-medium">
                                                    No serial number assets found matching filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls pagination={{ page: currentPage, limit: PAGE_SIZE, total: filteredAssets.length, pages: totalPages }} onPageChange={setCurrentPage} />
                        </>
                    )}
                </div>
            </div>

            {/* Asset Detail Modal */}
            <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Asset Lifecycle Detail" maxWidth="max-w-xl" footer={<button onClick={() => setIsDetailModalOpen(false)} className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl uppercase text-[10px] tracking-widest active:scale-95">Close</button>}>
                {loadingSummary ? (
                    <div className="py-12 text-center text-slate-400 font-medium"><div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div><p className="text-xs uppercase font-black tracking-widest">Fetching Asset History...</p></div>
                ) : assetSummary ? (
                    <div className="space-y-6">
                        <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 rounded-3xl space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700">🔎 Asset Details</span>
                                <div className="flex gap-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${assetSummary.asset?.status === 'SOLD' ? 'bg-blue-50 text-blue-600 border-blue-200' : assetSummary.asset?.status === 'IN_STOCK' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>Status: {assetSummary.asset?.status || 'IN_STOCK'}</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${assetSummary.warranty?.status === 'Active' || assetSummary.amc?.status === 'Active' ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>{assetSummary.warranty?.status === 'Active' || assetSummary.amc?.status === 'Active' ? 'Covered' : 'Out of Warranty/AMC'}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                                <div><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Customer</span><span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.customerId?.companyName || assetSummary.asset?.customerId?.customerName || assetSummary.asset?.customerNameStr || 'Stock (Unsold)'}</span></div>
                                <div><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Product Name</span><span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.productId?.productName || 'N/A'}</span></div>
                                <div><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Serial Number</span><span className="text-slate-900 font-mono text-sm font-bold">{assetSummary.asset?.serialNumber}</span></div>
                                <div><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Invoice Number</span><span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.invoiceNumber || 'N/A'}</span></div>
                                <div><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Date of Sale</span><span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.saleDate || assetSummary.asset?.invoiceDate ? new Date(assetSummary.asset.saleDate || assetSummary.asset.invoiceDate).toLocaleDateString('en-IN') : 'N/A'}</span></div>
                                <div><span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Postal Code</span><span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.customerPostalCode || 'N/A'}</span></div>
                            </div>
                        </div>

                        {/* Transaction History Log (Requirement #8, #9, #17) */}
                        {assetSummary.history && assetSummary.history.length > 0 && (
                            <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-3">
                                <span className="block text-xs font-black uppercase tracking-wider text-slate-700">📜 Lifecycle Transaction History</span>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {assetSummary.history.map((h, index) => (
                                        <div key={h._id || index} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs">
                                            <div>
                                                <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${h.transactionType === 'RETURN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{h.transactionType || h.status}</span>
                                                <p className="font-bold text-slate-800 mt-1">{h.customerName || 'Customer'} | Invoice: {h.invoiceNumber || 'N/A'}</p>
                                                {h.returnReason && <p className="text-amber-700 italic mt-0.5">Reason: {h.returnReason}</p>}
                                            </div>
                                            <span className="text-[10px] font-semibold text-slate-400">{new Date(h.createdAt).toLocaleDateString('en-IN')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (<div className="py-8 text-center text-slate-400 text-sm">Failed to load detailed asset information.</div>)}
            </Modal>

            {/* --- SINGLE ENTRY MODAL (Requirement #15) --- */}
            <Modal
                isOpen={isSingleModalOpen}
                onClose={() => setIsSingleModalOpen(false)}
                title="+ Add Single Entry"
                maxWidth="max-w-3xl"
            >
                <form onSubmit={handleSingleEntrySubmit} className="space-y-4">
                    <p className="text-xs font-semibold text-slate-500">
                        Manually enter one invoice/product/serial record into the system without uploading an Excel file.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold text-slate-700">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Serial Number *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. SN-100202"
                                value={singleForm.serialNumber}
                                onChange={(e) => setSingleForm({ ...singleForm, serialNumber: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Product Code *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. PROD-001"
                                value={singleForm.productCode}
                                onChange={(e) => setSingleForm({ ...singleForm, productCode: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Product Name *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. 10KVA Transformer"
                                value={singleForm.productName}
                                onChange={(e) => setSingleForm({ ...singleForm, productName: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</label>
                            <select
                                value={singleForm.status}
                                onChange={(e) => setSingleForm({ ...singleForm, status: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            >
                                <option value="IN_STOCK">IN_STOCK</option>
                                <option value="SOLD">SOLD</option>
                                <option value="ALLOCATED">ALLOCATED</option>
                                <option value="RETURN">RETURN</option>
                                <option value="SCRAPPED">SCRAPPED</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer Name / Code</label>
                            <input
                                type="text"
                                placeholder="e.g. Apex Industrial"
                                value={singleForm.customer}
                                onChange={(e) => setSingleForm({ ...singleForm, customer: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer Postal Code</label>
                            <input
                                type="text"
                                placeholder="e.g. 400001"
                                value={singleForm.customerPostalCode}
                                onChange={(e) => setSingleForm({ ...singleForm, customerPostalCode: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Invoice Number</label>
                            <input
                                type="text"
                                placeholder="e.g. INV-2026-001"
                                value={singleForm.invoiceNumber}
                                onChange={(e) => setSingleForm({ ...singleForm, invoiceNumber: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Sale Date</label>
                            <input
                                type="date"
                                value={singleForm.saleDate}
                                onChange={(e) => setSingleForm({ ...singleForm, saleDate: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Location</label>
                            <input
                                type="text"
                                placeholder="e.g. Client Site Alpha"
                                value={singleForm.location}
                                onChange={(e) => setSingleForm({ ...singleForm, location: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mgr 1</label>
                            <input
                                type="text"
                                placeholder="Mgr 1"
                                value={singleForm.mgr1}
                                onChange={(e) => setSingleForm({ ...singleForm, mgr1: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mgr 2</label>
                            <input
                                type="text"
                                placeholder="Mgr 2"
                                value={singleForm.mgr2}
                                onChange={(e) => setSingleForm({ ...singleForm, mgr2: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mgr 3</label>
                            <input
                                type="text"
                                placeholder="Mgr 3"
                                value={singleForm.mgr3}
                                onChange={(e) => setSingleForm({ ...singleForm, mgr3: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mgr 4</label>
                            <input
                                type="text"
                                placeholder="Mgr 4"
                                value={singleForm.mgr4}
                                onChange={(e) => setSingleForm({ ...singleForm, mgr4: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mgr 5</label>
                            <input
                                type="text"
                                placeholder="Mgr 5"
                                value={singleForm.mgr5}
                                onChange={(e) => setSingleForm({ ...singleForm, mgr5: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Indicator Field (Max 20 chars)</label>
                            <input
                                type="text"
                                maxLength={20}
                                placeholder="e.g. SALE or RETURN"
                                value={singleForm.indicatorField}
                                onChange={(e) => setSingleForm({ ...singleForm, indicatorField: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsSingleModalOpen(false)}
                            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold uppercase text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={singleSaving}
                            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95"
                        >
                            {singleSaving ? 'Saving...' : 'Save Single Entry'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* --- SALES RETURN FORM MODAL (Requirement #6) --- */}
            <Modal
                isOpen={isReturnModalOpen}
                onClose={() => { setIsReturnModalOpen(false); setReturnTargetAsset(null); }}
                title="Sales Return Form"
                maxWidth="max-w-lg"
            >
                {returnTargetAsset && (
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs font-semibold text-slate-700">
                            <div className="flex justify-between">
                                <span className="text-slate-400 uppercase font-black text-[9px]">Serial Number:</span>
                                <span className="font-mono font-black text-slate-900">{returnTargetAsset.serialNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400 uppercase font-black text-[9px]">Product Code / Name:</span>
                                <span className="font-bold text-slate-900">{returnTargetAsset.productId?.productCode} - {returnTargetAsset.productId?.productName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400 uppercase font-black text-[9px]">Customer Name:</span>
                                <span className="font-bold text-slate-900">{returnTargetAsset.customerId?.companyName || returnTargetAsset.customerId?.customerName || returnTargetAsset.customerNameStr || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400 uppercase font-black text-[9px]">Invoice Ref:</span>
                                <span className="font-bold text-slate-900">{returnTargetAsset.invoiceNumber || 'N/A'}</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-700 mb-1.5">
                                Return Reason *
                            </label>
                            <textarea
                                required
                                rows={4}
                                placeholder="Explain why the product was returned (e.g. Customer reported product fault)..."
                                value={returnReason}
                                onChange={(e) => setReturnReason(e.target.value)}
                                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => { setIsReturnModalOpen(false); setReturnTargetAsset(null); }}
                                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold uppercase text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSalesReturnSubmit}
                                disabled={returnSaving || !returnReason.trim()}
                                className="px-8 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg shadow-amber-600/20 active:scale-95"
                            >
                                {returnSaving ? 'Processing...' : 'Confirm Sales Return'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Import Modal */}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => {
                    setIsImportModalOpen(false);
                    fetchData();
                }}
                title="Import Invoice Bulk Upload Records"
                type="assets"
                onImport={importService.importAssets}
                onDownloadTemplate={importService.getAssetTemplate}
            />
        </div>
    );
};

export default SerialNoMaster;
