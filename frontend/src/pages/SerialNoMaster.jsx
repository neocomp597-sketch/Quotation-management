import React, { useState, useEffect, useMemo } from 'react';
import { csmService, productService, customerService, importService } from '../services/api';
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
import SearchableSelect from '../components/SearchableSelect';

const PAGE_SIZE = 15;

const SerialNoMaster = () => {
    const { user, isAdmin, isSuperAdmin } = useAuth();
    const [assets, setAssets] = useState([]);
    const [returnHistory, setReturnHistory] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'returns'

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('SOLD');
    const [selectedProduct, setSelectedProduct] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Permission check for Delete Entry (Requirement #11, #12)
    const canDelete = useMemo(() => {
        if (isAdmin || isSuperAdmin || user?.role === 'admin' || user?.role === 'superadmin') return true;
        const perms = user?.permissions || {};
        return Boolean(perms.invoice_bulk_upload_delete || perms.master_serials_delete);
    }, [user, isAdmin, isSuperAdmin]);

    // Detailed view state: 'list' | 'single' | 'detail'
    const [selectedAssetSerial, setSelectedAssetSerial] = useState(null);
    const [assetSummary, setAssetSummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);

    // Page View State: 'list' | 'single'
    const [pageView, setPageView] = useState('list');
    const [singleSaving, setSingleSaving] = useState(false);
    const [singleForm, setSingleForm] = useState({
        serialNumber: '',
        productCode: '',
        productName: '',
        status: 'SOLD',
        customerCode: '',
        customer: '',
        customerPostalCode: '',
        customerMobile: '',
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

    // --- SALES RETURN INLINE STATE ---
    const [returnReason, setReturnReason] = useState('');
    const [returnSaving, setReturnSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [assetsRes, productsRes, customersRes] = await Promise.all([
                csmService.getAssets(),
                productService.getAll({ limit: 1000 }),
                customerService.getAll({ limit: 1000 })
            ]);
            setAssets(assetsRes.data || []);
            setProducts(productsRes.data?.data || productsRes.data || []);
            setCustomers(customersRes.data?.data || customersRes.data || []);
        } catch (err) {
            console.error('Error fetching Invoice Bulk Upload data:', err);
            toast.error('Failed to load invoice bulk upload data');
        } finally {
            setLoading(false);
        }
    };

    const customerOptions = useMemo(() => {
        return customers.map(c => {
            const nameStr = c.companyName && c.customerName && c.companyName !== c.customerName
                ? `${c.companyName} (${c.customerName})`
                : c.companyName || c.customerName || 'Unnamed Customer';
            const codeStr = c.externalCode ? ` [${c.externalCode}]` : '';
            return {
                id: c._id,
                value: c.externalCode || c.companyName || c.customerName || '',
                label: c.externalCode ? `[${c.externalCode}] ${nameStr}` : nameStr,
                customerCode: c.externalCode || '',
                customerName: c.companyName || c.customerName || '',
                pincode: c.billingAddress?.pincode || c.pincode || '',
                customerObj: c
            };
        });
    }, [customers]);

    const productOptions = useMemo(() => {
        return products.map(p => {
            const code = p.productCode || '';
            const name = p.productName || '';
            return {
                id: p._id,
                value: code || p._id,
                label: code && name ? `${code} - ${name}` : (code || name),
                productCode: code,
                productName: name,
                productObj: p
            };
        });
    }, [products]);

    const productFilterOptions = useMemo(() => {
        return [
            { value: 'ALL', label: 'All Products' },
            ...products.map(p => ({
                value: p._id,
                label: p.productCode ? `${p.productCode} - ${p.productName}` : p.productName
            }))
        ];
    }, [products]);

    const handleSelectCustomer = (val, option) => {
        const custObj = option?.customerObj;
        const custCode = custObj?.externalCode || option?.customerCode || (customers.find(c => c.externalCode === val)?.externalCode || '');
        const custName = custObj?.companyName || custObj?.customerName || option?.customerName || option?.label || val;
        const pincode = custObj?.billingAddress?.pincode || custObj?.pincode || '';
        const mobile = custObj?.mobile || '';
        setSingleForm(prev => ({
            ...prev,
            customerCode: custCode || prev.customerCode || '',
            customer: val || custName || '',
            customerPostalCode: pincode,
            customerMobile: mobile || prev.customerMobile || ''
        }));
    };

    const formatMgrVal = (mgr) => {
        if (!mgr) return '';
        if (typeof mgr === 'string') return mgr;
        if (mgr.code && mgr.description && mgr.code.toLowerCase() !== mgr.description.toLowerCase()) {
            return `${mgr.code} - ${mgr.description}`;
        }
        return mgr.description || mgr.code || '';
    };

    const handleSelectProduct = (val, option) => {
        const prodObj = option?.productObj || products.find(p => p.productCode === val || p.productName === val || p._id === val);
        const prodCode = prodObj?.productCode || option?.productCode || val;
        const prodName = prodObj?.productName || option?.productName || '';

        setSingleForm(prev => ({
            ...prev,
            productCode: prodCode || '',
            productName: prodName || prev.productName || '',
            mgr1: prodObj ? formatMgrVal(prodObj.mgr1) : prev.mgr1,
            mgr2: prodObj ? formatMgrVal(prodObj.mgr2) : prev.mgr2,
            mgr3: prodObj ? formatMgrVal(prodObj.mgr3) : prev.mgr3,
            mgr4: prodObj ? formatMgrVal(prodObj.mgr4) : prev.mgr4,
            mgr5: prodObj ? formatMgrVal(prodObj.mgr5) : prev.mgr5,
        }));
    };

    const handleProductInputChange = (field, value) => {
        const updatedForm = { ...singleForm, [field]: value };
        const cleanVal = String(value || '').trim().toLowerCase();
        if (cleanVal) {
            const matchedProduct = products.find(p =>
                (p.productName && p.productName.trim().toLowerCase() === cleanVal) ||
                (p.productCode && p.productCode.trim().toLowerCase() === cleanVal)
            );
            if (matchedProduct) {
                if (field === 'productName' && matchedProduct.productCode) {
                    updatedForm.productCode = matchedProduct.productCode;
                }
                if (field === 'productCode' && matchedProduct.productName) {
                    updatedForm.productName = matchedProduct.productName;
                }
                if (matchedProduct.mgr1) updatedForm.mgr1 = formatMgrVal(matchedProduct.mgr1);
                if (matchedProduct.mgr2) updatedForm.mgr2 = formatMgrVal(matchedProduct.mgr2);
                if (matchedProduct.mgr3) updatedForm.mgr3 = formatMgrVal(matchedProduct.mgr3);
                if (matchedProduct.mgr4) updatedForm.mgr4 = formatMgrVal(matchedProduct.mgr4);
                if (matchedProduct.mgr5) updatedForm.mgr5 = formatMgrVal(matchedProduct.mgr5);
            }
        }
        setSingleForm(updatedForm);
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

    // Standardized 16-Column Export (Requirement #3)
    const handleExport = () => {
        const dataToExport = activeTab === 'returns' ? returnHistory : filteredAssets;
        if (!dataToExport || dataToExport.length === 0) {
            toast.error('No records to export');
            return;
        }

        const exportData = dataToExport.map(asset => {
            const prodName = asset.productId?.productName || asset.productName || '';
            const prodCode = asset.productId?.productCode || asset.productCode || '';
            const custCode = asset.customerId?.externalCode || asset.customerCode || '';
            const custName = asset.customerId?.companyName || asset.customerId?.customerName || asset.customerNameStr || asset.customerName || (asset.customerId ? 'Customer' : 'Stock (Unsold)');
            const postalCode = asset.customerId?.billingAddress?.pincode || asset.customerId?.pincode || asset.customerPostalCode || '';
            const sDate = asset.saleDate || asset.invoiceDate;

            return {
                'Serial Num': asset.serialNumber || '',
                'Product Name': prodName,
                'Product Code': prodCode,
                'Status': asset.status || 'IN_STOCK',
                'Customer Code': custCode,
                'Customer Name': custName,
                'Mobile Number': asset.customerMobile || asset.customerId?.mobile || '',
                'Postal Code (From Master)': postalCode,
                'Invoice Ref': asset.invoiceNumber || '',
                'Sale Date': sDate ? new Date(sDate).toLocaleDateString('en-IN') : '',
                'Location': asset.location || '',
                'Mgr 1': asset.mgr1 || '',
                'Mgr 2': asset.mgr2 || '',
                'Mgr 3': asset.mgr3 || '',
                'Mgr 4': asset.mgr4 || '',
                'Mgr 5': asset.mgr5 || ''
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
        setPageView('detail');
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

    // Single Entry Submit (Requirement #15, #3 Mobile Mandatory)
    const handleSingleEntrySubmit = async (e) => {
        e.preventDefault();
        if (!singleForm.serialNumber.trim() || !singleForm.productCode.trim()) {
            return toast.error('Serial Number and Product Code are required');
        }
        if (!singleForm.customerMobile || !singleForm.customerMobile.trim()) {
            return toast.error('Mobile Number is mandatory. Please enter a valid mobile number.');
        }
        const cleanMobile = singleForm.customerMobile.trim().replace(/\D/g, '');
        if (cleanMobile.length !== 10) {
            return toast.error('Please enter a valid 10-digit mobile number');
        }

        setSingleSaving(true);
        try {
            await csmService.createSingleAsset(singleForm);
            toast.success('Single entry created successfully!');
            setPageView('list');
            setSingleForm({
                serialNumber: '',
                productCode: '',
                productName: '',
                status: 'SOLD',
                customerCode: '',
                customer: '',
                customerPostalCode: '',
                customerMobile: '',
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

    // Customer Name Search + Product Code + Product Name + Serial No + Invoice Ref (Requirement #10, #1 Sold Only)
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            // Requirement #1: Show only products/entries from the Sold List (exclude unsold stock entries)
            if (asset.status === 'IN_STOCK' && selectedStatus !== 'IN_STOCK') {
                return false;
            }

            const custCode = (
                asset.customerId?.externalCode ||
                asset.customerCode ||
                ''
            ).toLowerCase();

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
                custCode.includes(query) ||
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
            {pageView === 'single' && (
                /* --- FULL PAGE SINGLE ENTRY FORM (Requirement #15) --- */
                <div className="space-y-6 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <button
                                type="button"
                                onClick={() => setPageView('list')}
                                className="text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 mb-2 flex items-center gap-1 transition-all cursor-pointer"
                            >
                                ← Back to Invoice Bulk Upload
                            </button>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                                Add Single Entry
                            </h1>
                            <p className="text-slate-500 font-semibold text-sm">
                                Manually enter one invoice, product, or serial record into the system without uploading an Excel file.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setPageView('list')}
                                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="single-entry-form"
                                disabled={singleSaving}
                                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                {singleSaving ? 'Saving Entry...' : 'Save Single Entry'}
                            </button>
                        </div>
                    </div>

                    <div className="glass shadow-premium rounded-[2rem] p-6 md:p-8 bg-white border border-slate-100">
                        <form id="single-entry-form" onSubmit={handleSingleEntrySubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs font-bold text-slate-700">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Serial Number *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. SN-100202"
                                        value={singleForm.serialNumber}
                                        onChange={(e) => setSingleForm({ ...singleForm, serialNumber: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1.5">Search & Select Product</label>
                                    <SearchableSelect
                                        options={productOptions}
                                        value={singleForm.productCode}
                                        onChange={handleSelectProduct}
                                        placeholder="Type or select product..."
                                        noResultsText="No matching products found"
                                        allowCustom={true}
                                        inputClass="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900 text-xs text-left cursor-pointer"
                                        menuClass="max-h-60"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Product Code *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. PROD-001"
                                        value={singleForm.productCode}
                                        onChange={(e) => handleProductInputChange('productCode', e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Product Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. 10KVA Transformer"
                                        value={singleForm.productName}
                                        onChange={(e) => handleProductInputChange('productName', e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Status</label>
                                    <select
                                        value={singleForm.status}
                                        onChange={(e) => setSingleForm({ ...singleForm, status: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    >
                                        <option value="IN_STOCK">IN_STOCK</option>
                                        <option value="SOLD">SOLD</option>
                                        <option value="ALLOCATED">ALLOCATED</option>
                                        <option value="RETURN">RETURN</option>
                                        <option value="SCRAPPED">SCRAPPED</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1.5">Search & Select Customer</label>
                                    <SearchableSelect
                                        options={customerOptions}
                                        value={singleForm.customer}
                                        onChange={handleSelectCustomer}
                                        placeholder="Type or select customer..."
                                        noResultsText="No matching customers found"
                                        allowCustom={true}
                                        inputClass="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900 text-xs text-left cursor-pointer"
                                        menuClass="max-h-60"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Customer Code</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. CUST-101"
                                        value={singleForm.customerCode}
                                        onChange={(e) => {
                                            const code = e.target.value;
                                            const matchedCust = customers.find(c => c.externalCode && c.externalCode.toLowerCase() === code.trim().toLowerCase());
                                            setSingleForm(prev => ({
                                                ...prev,
                                                customerCode: code,
                                                customer: matchedCust ? (matchedCust.companyName || matchedCust.customerName) : prev.customer,
                                                customerPostalCode: matchedCust ? (matchedCust.billingAddress?.pincode || matchedCust.pincode || '') : prev.customerPostalCode,
                                                customerMobile: matchedCust ? (matchedCust.mobile || prev.customerMobile) : prev.customerMobile
                                            }));
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Customer Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Apex Industrial"
                                        value={singleForm.customer}
                                        onChange={(e) => setSingleForm({ ...singleForm, customer: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Postal Code</label>
                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">From Customer Master</span>
                                    </div>
                                    <input
                                        type="text"
                                        readOnly={true}
                                        placeholder="Auto-fetched from Customer Master"
                                        value={singleForm.customerPostalCode}
                                        className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl outline-none font-semibold text-slate-600 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1.5">Mobile Number *</label>
                                    <input
                                        type="tel"
                                        required
                                        maxLength={10}
                                        placeholder="e.g. 9823012345"
                                        value={singleForm.customerMobile}
                                        onChange={(e) => setSingleForm({ ...singleForm, customerMobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Invoice Number</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. INV-2026-001"
                                        value={singleForm.invoiceNumber}
                                        onChange={(e) => setSingleForm({ ...singleForm, invoiceNumber: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Sale Date</label>
                                    <input
                                        type="date"
                                        value={singleForm.saleDate}
                                        onChange={(e) => setSingleForm({ ...singleForm, saleDate: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Location</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Client Site Alpha"
                                        value={singleForm.location}
                                        onChange={(e) => setSingleForm({ ...singleForm, location: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div className="col-span-full pt-2">
                                    <div className="flex items-center gap-2 p-3 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-amber-900 text-xs font-bold">
                                        <MdInfoOutline size={20} className="text-amber-600 flex-shrink-0" />
                                        <span>Product Grouping (Mgr 1 to Mgr 5): Automatically populated from Product Master when Product Name or Product Code matches.</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Mgr 1</label>
                                    <input
                                        type="text"
                                        placeholder="Mgr 1"
                                        value={singleForm.mgr1}
                                        onChange={(e) => setSingleForm({ ...singleForm, mgr1: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Mgr 2</label>
                                    <input
                                        type="text"
                                        placeholder="Mgr 2"
                                        value={singleForm.mgr2}
                                        onChange={(e) => setSingleForm({ ...singleForm, mgr2: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Mgr 3</label>
                                    <input
                                        type="text"
                                        placeholder="Mgr 3"
                                        value={singleForm.mgr3}
                                        onChange={(e) => setSingleForm({ ...singleForm, mgr3: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Mgr 4</label>
                                    <input
                                        type="text"
                                        placeholder="Mgr 4"
                                        value={singleForm.mgr4}
                                        onChange={(e) => setSingleForm({ ...singleForm, mgr4: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Mgr 5</label>
                                    <input
                                        type="text"
                                        placeholder="Mgr 5"
                                        value={singleForm.mgr5}
                                        onChange={(e) => setSingleForm({ ...singleForm, mgr5: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Indicator Field (Max 20 chars)</label>
                                    <input
                                        type="text"
                                        maxLength={20}
                                        placeholder="e.g. SALE or RETURN"
                                        value={singleForm.indicatorField}
                                        onChange={(e) => setSingleForm({ ...singleForm, indicatorField: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none font-semibold text-slate-900"
                                    />
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {pageView === 'detail' && (
                /* --- FULL PAGE ASSET LIFECYCLE & SALES RETURN DETAIL VIEW --- */
                <div className="space-y-6 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <button
                                type="button"
                                onClick={() => { setPageView('list'); setSelectedAssetSerial(null); setAssetSummary(null); }}
                                className="text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 mb-2 flex items-center gap-1 transition-all cursor-pointer"
                            >
                                ← Back to Invoice Bulk Upload
                            </button>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase flex items-center gap-3">
                                <span>Asset Lifecycle Detail</span>
                                {selectedAssetSerial && (
                                    <span className="font-mono text-base font-bold text-primary-600 bg-primary-50 border border-primary-200 px-3 py-1 rounded-xl">
                                        {selectedAssetSerial}
                                    </span>
                                )}
                            </h1>
                            <p className="text-slate-500 font-semibold text-sm">
                                Complete asset specifications, customer details, lifecycle history, and sales return processing.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => { setPageView('list'); setSelectedAssetSerial(null); setAssetSummary(null); }}
                                className="px-6 py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer"
                            >
                                Back to List
                            </button>
                        </div>
                    </div>

                    {loadingSummary ? (
                        <div className="glass shadow-premium rounded-[2rem] p-12 text-center text-slate-400 font-medium bg-white border border-slate-100">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-xs uppercase font-black tracking-widest">Fetching Asset Details & Lifecycle History...</p>
                        </div>
                    ) : assetSummary ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Main Content Area - Left 2 Columns */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Asset Details Card */}
                                <div className="glass shadow-premium rounded-[2rem] p-6 md:p-8 bg-white border border-slate-100 space-y-5">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                        <span className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                            <MdInfoOutline size={20} className="text-primary-600" />
                                            Asset Specifications & Customer Details
                                        </span>
                                        <div className="flex gap-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${assetSummary.asset?.status === 'SOLD' ? 'bg-blue-50 text-blue-600 border-blue-200' : assetSummary.asset?.status === 'IN_STOCK' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>Status: {assetSummary.asset?.status || 'IN_STOCK'}</span>
                                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${assetSummary.warranty?.status === 'Active' || assetSummary.amc?.status === 'Active' ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>{assetSummary.warranty?.status === 'Active' || assetSummary.amc?.status === 'Active' ? 'Covered' : 'Out of Warranty/AMC'}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-600">
                                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Serial Number</span>
                                            <span className="text-slate-900 font-mono text-sm font-bold">{assetSummary.asset?.serialNumber}</span>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Product Name</span>
                                            <span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.productId?.productName || assetSummary.asset?.productName || 'N/A'}</span>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Product Code</span>
                                            <span className="text-slate-900 font-mono text-sm font-bold">{assetSummary.asset?.productId?.productCode || assetSummary.asset?.productCode || 'N/A'}</span>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer Code</span>
                                            <span className="text-slate-900 font-mono text-sm font-bold">{assetSummary.asset?.customerId?.externalCode || assetSummary.asset?.customerCode || 'N/A'}</span>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer Name</span>
                                            <span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.customerId?.companyName || assetSummary.asset?.customerId?.customerName || assetSummary.asset?.customerNameStr || 'Stock (Unsold)'}</span>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Invoice Ref</span>
                                            <span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.invoiceNumber || 'N/A'}</span>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Date of Sale</span>
                                            <span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.saleDate || assetSummary.asset?.invoiceDate ? new Date(assetSummary.asset.saleDate || assetSummary.asset.invoiceDate).toLocaleDateString('en-IN') : 'N/A'}</span>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Postal Code (Customer Master)</span>
                                            <span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.customerId?.billingAddress?.pincode || assetSummary.asset?.customerId?.pincode || assetSummary.asset?.customerPostalCode || 'N/A'}</span>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Location</span>
                                            <span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.location || 'N/A'}</span>
                                        </div>
                                        <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Indicator Field</span>
                                            <span className="text-slate-900 text-sm font-bold">{assetSummary.asset?.indicatorField || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {(assetSummary.asset?.mgr1 || assetSummary.asset?.mgr2 || assetSummary.asset?.mgr3 || assetSummary.asset?.mgr4 || assetSummary.asset?.mgr5) && (
                                        <div className="pt-3 border-t border-slate-100">
                                            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Product Managers / Classifications</span>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                                                {['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'].map((mgrKey, i) => (
                                                    assetSummary.asset[mgrKey] ? (
                                                        <div key={mgrKey} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                            <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400">Mgr {i + 1}</span>
                                                            <span className="font-semibold text-slate-800 text-xs">{formatMgrVal(assetSummary.asset[mgrKey])}</span>
                                                        </div>
                                                    ) : null
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sales Return Form Section */}
                                {assetSummary.asset?.status !== 'RETURN' && assetSummary.asset?.status !== 'RETURNED' ? (
                                    <div className="glass shadow-premium rounded-[2rem] p-6 md:p-8 bg-gradient-to-br from-amber-50/90 to-amber-100/50 border border-amber-200 space-y-4">
                                        <div className="flex items-center justify-between border-b border-amber-200/70 pb-3">
                                            <span className="text-sm font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                                <MdUndo size={22} className="text-amber-600" />
                                                Process Sales Return
                                            </span>
                                            <span className="text-xs font-bold text-amber-800 bg-amber-200/60 px-3 py-1 rounded-full uppercase">Action</span>
                                        </div>
                                        <div className="space-y-4 pt-1">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-widest text-amber-900 mb-2">
                                                    Return Reason *
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    required
                                                    placeholder="Enter reason for sales return (e.g. Defective unit, customer order cancelled)..."
                                                    value={returnReason}
                                                    onChange={(e) => setReturnReason(e.target.value)}
                                                    className="w-full p-4 bg-white border border-amber-300 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none text-xs font-semibold text-slate-900 placeholder:text-slate-400 shadow-sm"
                                                />
                                            </div>
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    disabled={returnSaving || !returnReason.trim()}
                                                    onClick={async () => {
                                                        if (!returnReason.trim()) return toast.error('Please enter return reason');
                                                        setReturnSaving(true);
                                                        try {
                                                            await csmService.returnAsset(assetSummary.asset._id, returnReason);
                                                            toast.success(`Sales return recorded for Serial: ${assetSummary.asset.serialNumber}`);
                                                            setReturnReason('');
                                                            const res = await csmService.getAssetSummary({ serialNumber: assetSummary.asset.serialNumber });
                                                            setAssetSummary(res.data);
                                                            fetchData();
                                                            if (activeTab === 'returns') fetchReturnHistory();
                                                        } catch (err) {
                                                            console.error('Sales return error:', err);
                                                            toast.error(err.response?.data?.message || 'Failed to process sales return');
                                                        } finally {
                                                            setReturnSaving(false);
                                                        }
                                                    }}
                                                    className="px-8 py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-amber-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                                                >
                                                    <MdUndo size={18} />
                                                    <span>{returnSaving ? 'Processing Sales Return...' : 'Confirm & Process Sales Return'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 font-bold text-xs">
                                        <MdUndo size={22} className="text-amber-600 shrink-0" />
                                        <span>This asset has already been processed as a Sales Return.</span>
                                    </div>
                                )}
                            </div>

                            {/* Right Column - Lifecycle History Log */}
                            <div className="space-y-6">
                                <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 space-y-4">
                                    <span className="block text-sm font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">📜 Lifecycle History Log</span>
                                    {assetSummary.history && assetSummary.history.length > 0 ? (
                                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                            {assetSummary.history.map((h, index) => (
                                                <div key={h._id || index} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2 text-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase border ${h.transactionType === 'RETURN' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>{h.transactionType || h.status}</span>
                                                        <span className="text-[10px] font-semibold text-slate-400">{new Date(h.createdAt).toLocaleDateString('en-IN')}</span>
                                                    </div>
                                                    <p className="font-bold text-slate-800">{h.customerName || 'Customer'} | Invoice: {h.invoiceNumber || 'N/A'}</p>
                                                    {h.returnReason && <p className="text-amber-700 italic bg-amber-50 p-2 rounded-xl border border-amber-200/60 mt-1">Reason: {h.returnReason}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 font-medium py-4 text-center">No previous history records available.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="glass shadow-premium rounded-[2rem] p-12 text-center text-slate-400 text-sm bg-white border border-slate-100">
                            Failed to load detailed asset information.
                        </div>
                    )}
                </div>
            )}

            {pageView === 'list' && (
                <>
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
                        onClick={() => setPageView('single')}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-black transition-all uppercase text-[10px] tracking-widest active:scale-95 shadow-md shadow-emerald-600/10 cursor-pointer"
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
                            <SearchableSelect
                                options={productFilterOptions}
                                value={selectedProduct}
                                onChange={(val) => setSelectedProduct(val || 'ALL')}
                                placeholder="All Products"
                                noResultsText="No matching product"
                                inputClass="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold text-slate-700 flex items-center justify-between gap-2 cursor-pointer min-w-[180px]"
                                menuClass="max-h-60"
                            />
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
                                                            <div>
                                                                <span>{custDisplay}</span>
                                                                {(asset.customerId?.externalCode || asset.customerCode) && (
                                                                    <span className="block text-[10px] text-primary-600 font-mono font-bold">Code: {asset.customerId?.externalCode || asset.customerCode}</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 font-normal italic">Stock (Unsold)</span>
                                                        )}
                                                        {(asset.customerId?.billingAddress?.pincode || asset.customerId?.pincode || asset.customerPostalCode) && (
                                                            <span className="block text-[10px] text-slate-400 font-bold">Pin: {asset.customerId?.billingAddress?.pincode || asset.customerId?.pincode || asset.customerPostalCode}</span>
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
                                                    {/* Actions Column: View Info (i) button contains Sales Return & details, Delete Entry */}
                                                    <td className="p-4 text-right">
                                                        <div className="flex justify-end items-center gap-1.5">
                                                            <button
                                                                onClick={() => handleViewDetail(asset.serialNumber)}
                                                                className="p-2 text-primary-600 hover:bg-primary-100 bg-primary-50/80 rounded-xl transition-all flex items-center gap-1 text-xs font-bold"
                                                                title="View Details & Actions"
                                                            >
                                                                <MdInfoOutline size={18} />
                                                            </button>
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteEntry(asset)}
                                                                    className="p-2 text-rose-600 hover:bg-rose-100 bg-rose-50/60 rounded-xl transition-all"
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
            </>
            )}



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
