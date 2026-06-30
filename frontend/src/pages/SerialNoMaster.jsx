import React, { useState, useEffect, useMemo } from 'react';
import { csmService, productService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdSearch, MdTag, MdInfoOutline, MdSync, 
    MdLocalOffer, MdPeople, MdReceipt, MdAssignmentTurnedIn 
} from 'react-icons/md';
import Modal from '../components/Modal';
import PaginationControls from '../components/PaginationControls';

const PAGE_SIZE = 15;

const SerialNoMaster = () => {
    const [assets, setAssets] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [selectedProduct, setSelectedProduct] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    
    // Detailed modal view
    const [selectedAssetSerial, setSelectedAssetSerial] = useState(null);
    const [assetSummary, setAssetSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

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
            console.error('Error fetching Serial No. Master data:', err);
            toast.error('Failed to load assets');
        } finally {
            setLoading(false);
        }
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

    // Front-end search and filter
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const matchesQuery = !searchQuery.trim() || 
                asset.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.productId?.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesStatus = selectedStatus === 'ALL' || asset.status === selectedStatus;
            
            const matchesProduct = selectedProduct === 'ALL' || asset.productId?._id === selectedProduct;

            return matchesQuery && matchesStatus && matchesProduct;
        });
    }, [assets, searchQuery, selectedStatus, selectedProduct]);

    // Summary counts
    const stats = useMemo(() => {
        const total = assets.length;
        const inStock = assets.filter(a => a.status === 'IN_STOCK').length;
        const sold = assets.filter(a => a.status === 'SOLD').length;
        const others = total - inStock - sold;
        return { total, inStock, sold, others };
    }, [assets]);

    // Pagination
    const totalPages = Math.ceil(filteredAssets.length / PAGE_SIZE) || 1;
    const paginatedAssets = useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return filteredAssets.slice(startIndex, startIndex + PAGE_SIZE);
    }, [filteredAssets, currentPage]);

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedStatus, selectedProduct]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <MdTag className="text-primary-600" />
                        <span>Serial No. Master</span>
                    </h1>
                    <p className="text-slate-500 font-medium">Track unique physical asset serial numbers, their current inventory statuses, invoices, and customer assignments.</p>
                </div>
                <div>
                    <button
                        onClick={fetchData}
                        className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest active:scale-95 border border-slate-200"
                    >
                        <MdSync size={18} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex items-center gap-4">
                    <div className="p-3.5 bg-slate-50 text-slate-500 rounded-2xl">
                        <MdTag size={24} />
                    </div>
                    <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Total Serials</span>
                        <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                    </div>
                </div>
                <div className="p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex items-center gap-4">
                    <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <MdLocalOffer size={24} />
                    </div>
                    <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">In Stock</span>
                        <span className="text-2xl font-black text-emerald-600">{stats.inStock}</span>
                    </div>
                </div>
                <div className="p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex items-center gap-4">
                    <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
                        <MdPeople size={24} />
                    </div>
                    <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Sold (Customer)</span>
                        <span className="text-2xl font-black text-blue-600">{stats.sold}</span>
                    </div>
                </div>
                <div className="p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex items-center gap-4">
                    <div className="p-3.5 bg-slate-50 text-slate-400 rounded-2xl">
                        <MdInfoOutline size={24} />
                    </div>
                    <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Other States</span>
                        <span className="text-2xl font-black text-slate-600">{stats.others}</span>
                    </div>
                </div>
            </div>

            {/* Toolbar Filters */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative group">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search by serial number, product name, or invoice number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-600/20 focus:bg-white transition-all outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                    />
                </div>
                <div className="grid grid-cols-2 md:flex gap-4">
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="px-4 py-3 bg-slate-50 border-none rounded-2xl outline-none text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-600/20"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="IN_STOCK">In Stock</option>
                        <option value="SOLD">Sold</option>
                        <option value="ALLOCATED">Allocated</option>
                        <option value="RETURNED">Returned</option>
                        <option value="SCRAPPED">Scrapped</option>
                    </select>
                    <select
                        value={selectedProduct}
                        onChange={(e) => setSelectedProduct(e.target.value)}
                        className="px-4 py-3 bg-slate-50 border-none rounded-2xl outline-none text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-600/20 max-w-[200px] truncate"
                    >
                        <option value="ALL">All Products</option>
                        {products.map(p => (
                            <option key={p._id} value={p._id}>{p.productName}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6">
                    {loading ? (
                        <div className="py-20 text-center text-slate-400 font-medium">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-xs uppercase font-black tracking-widest">Loading assets...</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 rounded-xl">
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest first:rounded-l-xl">Serial Number</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Product Details</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Invoice Ref</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Sale Date</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right last:rounded-r-xl">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedAssets.map(asset => (
                                            <tr key={asset._id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 text-sm font-black text-slate-900 font-mono tracking-wide">{asset.serialNumber}</td>
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
                                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                                    }`}>
                                                        {asset.status || 'IN_STOCK'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm font-semibold text-slate-700">
                                                    {asset.customerId?.companyName || asset.customerId?.customerName || (
                                                        <span className="text-slate-400 font-normal italic">Stock (Unsold)</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-sm font-bold text-slate-800">
                                                    {asset.invoiceNumber || <span className="text-slate-300 font-normal">-</span>}
                                                </td>
                                                <td className="p-4 text-sm font-medium text-slate-600">
                                                    {asset.saleDate || asset.invoiceDate 
                                                        ? new Date(asset.saleDate || asset.invoiceDate).toLocaleDateString('en-IN')
                                                        : <span className="text-slate-300 font-normal">-</span>}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => handleViewDetail(asset.serialNumber)}
                                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                        title="View Lifecycle Details"
                                                    >
                                                        <MdInfoOutline size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredAssets.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-12 text-center text-slate-400 text-sm font-medium">
                                                    No serial number assets found matching filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls 
                                pagination={{
                                    page: currentPage,
                                    limit: PAGE_SIZE,
                                    total: filteredAssets.length,
                                    pages: totalPages
                                }} 
                                onPageChange={setCurrentPage} 
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Detail Life Cycle Modal */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title="Asset Lifecycle Detail"
                maxWidth="max-w-xl"
                footer={
                    <button
                        onClick={() => setIsDetailModalOpen(false)}
                        className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl uppercase text-[10px] tracking-widest active:scale-95"
                    >
                        Close
                    </button>
                }
            >
                {loadingSummary ? (
                    <div className="py-12 text-center text-slate-400 font-medium">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                        <p className="text-xs uppercase font-black tracking-widest">Fetching Asset History...</p>
                    </div>
                ) : assetSummary ? (
                    <div className="space-y-6">
                        {/* Status Header Block */}
                        <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 rounded-3xl space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-700">🔎 Asset Details</span>
                                <div className="flex gap-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                        assetSummary.asset?.status === 'SOLD'
                                            ? 'bg-blue-50 text-blue-600 border-blue-200'
                                            : assetSummary.asset?.status === 'IN_STOCK'
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                    }`}>
                                        Status: {assetSummary.asset?.status || 'IN_STOCK'}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                        assetSummary.warranty?.status === 'Active' || assetSummary.amc?.status === 'Active'
                                            ? 'bg-teal-50 text-teal-600 border-teal-200'
                                            : 'bg-rose-50 text-rose-500 border-rose-200'
                                    }`}>
                                        {assetSummary.warranty?.status === 'Active' || assetSummary.amc?.status === 'Active' ? 'Covered' : 'Out of Warranty/AMC'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Customer</span>
                                    <span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.customerId?.companyName || assetSummary.asset?.customerId?.customerName || 'Stock (Unsold)'}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Product Name</span>
                                    <span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.productId?.productName || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Serial Number</span>
                                    <span className="text-slate-900 font-mono text-sm font-bold">{assetSummary.asset?.serialNumber}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Invoice Number</span>
                                    <span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.invoiceNumber || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Date of Sale</span>
                                    <span className="text-slate-900 text-sm font-bold">
                                        {assetSummary.asset?.saleDate || assetSummary.asset?.invoiceDate
                                            ? new Date(assetSummary.asset.saleDate || assetSummary.asset.invoiceDate).toLocaleDateString('en-IN')
                                            : 'N/A'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Installation Date</span>
                                    <span className="text-slate-900 text-sm font-bold">
                                        {assetSummary.asset?.installationDate ? new Date(assetSummary.asset.installationDate).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Warranty & AMC Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
                                <span className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider">
                                    <MdAssignmentTurnedIn className="text-primary-600" />
                                    <span>Warranty Details</span>
                                </span>
                                <div className="text-xs space-y-1 text-slate-600">
                                    <p>Status: <span className={assetSummary.warranty?.status === 'Active' ? 'text-emerald-600 font-bold' : 'text-slate-400'}>{assetSummary.warranty?.status || 'No Warranty'}</span></p>
                                    {assetSummary.warranty?.startDate && (
                                        <>
                                            <p>Start Date: {new Date(assetSummary.warranty.startDate).toLocaleDateString()}</p>
                                            <p>Expiry Date: {new Date(assetSummary.warranty.expiryDate).toLocaleDateString()}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
                                <span className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider">
                                    <MdLocalOffer className="text-primary-600" />
                                    <span>AMC Details</span>
                                </span>
                                <div className="text-xs space-y-1 text-slate-600">
                                    <p>Status: <span className={assetSummary.amc?.status === 'Active' ? 'text-emerald-600 font-bold' : 'text-slate-400'}>{assetSummary.amc?.status || 'No Active AMC'}</span></p>
                                    {assetSummary.amc?.contractNo && (
                                        <>
                                            <p>Contract No: <span className="font-mono font-bold text-slate-800">{assetSummary.amc.contractNo}</span></p>
                                            <p>Expiry Date: {new Date(assetSummary.amc.endDate).toLocaleDateString()}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* CSM Support Tickets Summary */}
                        <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl space-y-3">
                            <span className="block text-xs font-black uppercase tracking-wider text-slate-700">📞 CSM Tickets History</span>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Open Tickets</span>
                                    <span className="text-lg font-black text-amber-600">{assetSummary.ticketCounts?.open || 0}</span>
                                </div>
                                <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Closed Tickets</span>
                                    <span className="text-lg font-black text-slate-600">{assetSummary.ticketCounts?.closed || 0}</span>
                                </div>
                                <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Last Service Visit</span>
                                    <span className="text-xs font-bold text-slate-800 leading-snug">
                                        {assetSummary.lastServiceDate ? new Date(assetSummary.lastServiceDate).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-8 text-center text-slate-400 text-sm">Failed to load detailed asset information.</div>
                )}
            </Modal>
        </div>
    );
};

export default SerialNoMaster;
