import React, { useState, useEffect, useRef } from 'react';
import { MdAdd, MdDelete, MdSave, MdArrowBack, MdPrint, MdEdit } from 'react-icons/md';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { voucherService, vendorService, productService, customerService } from '../services/api';
import { PDFDownloadLink } from '@react-pdf/renderer';
import VoucherPDF from '../components/VoucherPDF';
import PortalDropdown from '../components/PortalDropdown';
import Modal from '../components/Modal';

const CreateVoucher = ({ mode = 'grn', isViewOnly = false }) => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { pathname } = useLocation();
    const isViewOnlyMode = isViewOnly || pathname.includes('/view/');
    const isEditMode = Boolean(id);
    const isInvoiceMode = mode === 'invoice';
    const basePath = isInvoiceMode ? '/invoices' : '/grn';
    
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [savedVoucherId, setSavedVoucherId] = useState(null);
    const [companySettings, setCompanySettings] = useState(null);
    
    // Dropdown states
    const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
    const [activeProductDropdown, setActiveProductDropdown] = useState(null);
    const [vendorAnchorRef, setVendorAnchorRef] = useState({ current: null });
    const [productAnchorRef, setProductAnchorRef] = useState({ current: null });

    // Master data
    const [vendors, setVendors] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [grnOptions, setGrnOptions] = useState([]);

    // Form state
    const [voucherData, setVoucherData] = useState({
        voucherType: isInvoiceMode ? 'Invoice' : 'Invoice Voucher',
        voucherNumber: `${isInvoiceMode ? 'INV' : 'GRN'}-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        vendorId: '',
        vendorName: '',
        customerId: '',
        customerName: '',
        contactNumber: '',
        referenceVoucherId: '',
        items: [
            { id: Date.now(), srNumber: 1, productId: '', productName: '', qty: 0, uom: 'Pcs', price: 0, amount: 0, taxPercentage: 5, taxAmount: 0 }
        ]
    });

    useEffect(() => {
        fetchMasterData();
        if (isEditMode) {
            fetchVoucherDetails(id);
        }
    }, [id, isEditMode]);

    const fetchMasterData = async () => {
        try {
            const { companySettingsService } = await import('../services/api');
            const [vendorsRes, customersRes, productsRes, settingsRes, grnRes] = await Promise.all([
                vendorService.getAll(true),
                customerService.getAll({ limit: 100000 }),
                productService.getAll(),
                companySettingsService.get(),
                voucherService.getAll({ type: 'Purchase' })
            ]);
            setVendors(vendorsRes.data);
            setCustomers(customersRes.data?.data || customersRes.data || []);
            setProducts(productsRes.data);
            setGrnOptions(grnRes.data || []);
            if (settingsRes.data) setCompanySettings(settingsRes.data);
        } catch (error) {
            console.error("Error fetching master data:", error);
            toast.error("Failed to load master data");
        }
    };

    const handleCustomerChange = (value) => {
        const selectedCustomer = customers.find(c => c._id === value);
        if (selectedCustomer) {
            setVoucherData(prev => ({
                ...prev,
                customerId: selectedCustomer._id,
                customerName: selectedCustomer.companyName || selectedCustomer.customerName || selectedCustomer.name || '',
                contactNumber: selectedCustomer.phone || selectedCustomer.mobile || selectedCustomer.contactNumber || ''
            }));
        } else {
            setVoucherData(prev => ({ ...prev, customerId: '', customerName: value }));
        }
    };

    const fetchVoucherDetails = async (voucherId) => {
        try {
            const res = await voucherService.getById(voucherId);
            const vData = res.data;
            if (vData.date) {
                // Ensure date is yyyy-MM-dd formatted for input field
                vData.date = new Date(vData.date).toISOString().split('T')[0];
            }
            if (vData.items) {
                vData.items = vData.items.map(item => ({ ...item, id: item._id || Date.now() + Math.random() }));
            }
            setVoucherData(vData);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch voucher for editing");
        }
    };

    const handleVendorChange = (e) => {
        const val = e.target.value;
        if (!val) {
            setVoucherData(prev => ({ ...prev, vendorId: '', vendorName: '', contactNumber: '' }));
            return;
        }

        const selectedVendor = vendors.find(v => v._id === val);
        if (selectedVendor) {
            setVoucherData(prev => ({
                ...prev,
                vendorId: selectedVendor._id,
                vendorName: selectedVendor.name,
                contactNumber: selectedVendor.phone || ''
            }));
        } else {
            setVoucherData(prev => ({ ...prev, vendorId: '', vendorName: val }));
        }
    };

    const handleItemChange = (id, field, value) => {
        setVoucherData(prev => {
            const updatedItems = prev.items.map(item => {
                if (item.id === id) {
                    const updatedItem = { ...item, [field]: value };
                    
                    if (field === 'productId') {
                        const prod = products.find(p => p._id === value);
                        if (prod) {
                            updatedItem.productName = prod.productName;
                            updatedItem.uom = prod.uom || 'Nos';
                            updatedItem.price = prod.basePrice || 0;
                            updatedItem.taxPercentage = prod.gstPercentage || 5;
                        }
                    }

                    // Auto calculations
                    const qty = Number(updatedItem.qty) || 0;
                    const price = Number(updatedItem.price) || 0;
                    const taxPercent = Number(updatedItem.taxPercentage) || 0;

                    updatedItem.amount = qty * price;
                    updatedItem.taxAmount = (updatedItem.amount * taxPercent) / 100;

                    return updatedItem;
                }
                return item;
            });

            return { ...prev, items: updatedItems };
        });
    };

    const addRow = () => {
        setVoucherData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    id: Date.now(),
                    srNumber: prev.items.length + 1,
                    productId: '',
                    productName: '',
                    qty: 0,
                    uom: 'Pcs',
                    price: 0,
                    amount: 0,
                    taxPercentage: 5,
                    taxAmount: 0
                }
            ]
        }));
    };

    const removeRow = (id) => {
        setVoucherData(prev => {
            const newItems = prev.items.filter(item => item.id !== id).map((item, index) => ({
                ...item,
                srNumber: index + 1
            }));
            return { ...prev, items: newItems };
        });
    };

    // Derived totals
    const totalQty = voucherData.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const totalAmount = voucherData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalTax = voucherData.items.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0);
    const grandTotal = totalAmount + totalTax;

    const handleSubmit = async () => {
        if (loading) return;
        if (!voucherData.date) return toast.error("Date is required");
        const isCustomerParty = ['Invoice', 'Sale Return'].includes(voucherData.voucherType);
        if (isCustomerParty && !voucherData.customerName?.trim()) return toast.error("Customer Name is required");
        if (!isCustomerParty && !voucherData.vendorName?.trim()) return toast.error("Vendor Name is required");
        if (voucherData.items.length === 0) return toast.error("Add at least one product");

        const isValidItems = voucherData.items.every(item => item.productName && item.qty > 0 && item.price >= 0);
        if (!isValidItems) return toast.error("All products must have a name, qty > 0 and valid price");

        try {
            setLoading(true);
            const payload = {
                ...voucherData,
                voucherType: isInvoiceMode ? 'Invoice' : voucherData.voucherType,
                totalQty,
                totalAmount,
                totalTax,
                grandTotal
            };
            
            let savedId;
            if (isEditMode) {
                const res = await voucherService.update(id, payload);
                    savedId = res.data?.voucher?._id;
                toast.success("Voucher Updated");
            } else {
                const res = await voucherService.create(payload);
                    savedId = res.data?.voucher?._id;
                toast.success("Voucher Created");
            }
            
            setSavedVoucherId(savedId || 'new');
            setShowSuccessModal(true);
        } catch (error) {
            console.error("Save error: ", error);
            toast.error(error.response?.data?.message || "Error saving voucher");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(basePath)}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-primary-600 hover:bg-primary-50 transition-all active:scale-95 shadow-sm"
                    >
                        <MdArrowBack size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                            {isViewOnlyMode ? (isInvoiceMode ? 'View Invoice' : 'View GRN') : isEditMode ? (isInvoiceMode ? 'Edit Invoice' : 'Edit GRN') : (isInvoiceMode ? 'Create Invoice' : 'GRN Entry')}
                        </h1>
                        <p className="text-slate-500 font-medium tracking-tight">
                            {isViewOnlyMode ? (isInvoiceMode ? 'Invoice details and stock transaction details' : 'GRN details and purchase breakdown') : isInvoiceMode ? 'Sales outward, GST billing and stock deduction' : 'Purchase inward and sale return processing'}
                        </p>
                    </div>
                </div>
                {!isViewOnlyMode ? (
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition-all shadow-xl disabled:opacity-50"
                    >
                        <MdSave size={20} />
                        <span>{loading ? 'Saving...' : (isEditMode ? (isInvoiceMode ? 'Update Invoice' : 'Update GRN') : 'Save & Update Stock')}</span>
                    </button>
                ) : (
                    companySettings && (
                        <PDFDownloadLink
                            document={<VoucherPDF voucher={voucherData} companySettings={companySettings} />}
                            fileName={`Voucher-${voucherData.voucherNumber?.replace(/\//g, '-')}.pdf`}
                        >
                            {({ loading: pdfLoading }) => (
                                <button
                                    disabled={pdfLoading}
                                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-xl disabled:opacity-50 active:scale-95"
                                >
                                    <MdPrint size={20} />
                                    <span>{pdfLoading ? 'Preparing PDF...' : 'Print Voucher'}</span>
                                </button>
                            )}
                        </PDFDownloadLink>
                    )
                )}
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-8">
                {/* Header Row similar to screenshot colors basically */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <label className="text-xs font-black uppercase text-blue-600 tracking-widest block mb-2">Date</label>
                        <input
                            type="date"
                            className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 font-bold transition-all"
                            value={voucherData.date}
                            onChange={(e) => setVoucherData({ ...voucherData, date: e.target.value })}
                            disabled={isViewOnlyMode}
                        />
                    </div>
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                        <label className="text-xs font-black uppercase text-amber-600 tracking-widest block mb-2">{isInvoiceMode ? 'Invoice Number' : 'GRN Number'}</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-lg focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none text-slate-900 font-bold transition-all"
                            value={voucherData.voucherNumber}
                            onChange={(e) => setVoucherData({ ...voucherData, voucherNumber: e.target.value })}
                            disabled={isViewOnlyMode}
                        />
                    </div>
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                        <label className="text-xs font-black uppercase text-emerald-600 tracking-widest block mb-2">Transaction Type</label>
                        <select
                            className="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-lg focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-slate-900 font-bold transition-all"
                            value={voucherData.voucherType}
                            onChange={(e) => {
                                const newType = e.target.value;
                                setVoucherData(prev => ({
                                    ...prev,
                                    voucherType: newType,
                                    vendorId: '',
                                    vendorName: '',
                                    customerId: '',
                                    customerName: '',
                                    contactNumber: '',
                                    referenceVoucherId: ''
                                }));
                            }}
                            disabled={isInvoiceMode || isViewOnlyMode}
                        >
                            {isInvoiceMode ? (
                                <option value="Invoice">Invoice</option>
                            ) : (
                                <>
                                    <option value="Purchase">Purchase</option>
                                    <option value="Sale Return">Sale Return</option>
                                </>
                            )}
                        </select>
                    </div>
                </div>

                {/* Party Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    {['Invoice', 'Sale Return'].includes(voucherData.voucherType) ? (
                    <div>
                        <label className="text-xs font-black uppercase text-slate-400 tracking-widest block mb-2">Customer Name</label>
                        <select
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-slate-900 font-bold transition-all"
                            value={voucherData.customerId || ''}
                            onChange={(e) => handleCustomerChange(e.target.value)}
                            disabled={isViewOnlyMode}
                        >
                            <option value="">Select Customer</option>
                            {customers.map(c => (
                                <option key={c._id} value={c._id}>{c.companyName || c.customerName || c.name}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Or type customer name"
                            className="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-slate-900 font-bold transition-all"
                            value={voucherData.customerName || ''}
                            onChange={(e) => setVoucherData({ ...voucherData, customerId: '', customerName: e.target.value })}
                            disabled={isViewOnlyMode}
                        />
                    </div>
                    ) : (
                    <div className="relative">
                        <label className="text-xs font-black uppercase text-slate-400 tracking-widest block mb-2">Vendor Name</label>
                        <input
                            type="text"
                            placeholder="Select or Type Vendor"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-slate-900 font-bold transition-all"
                            value={voucherData.vendorName || ''}
                            onFocus={(e) => {
                                if (isViewOnlyMode) return;
                                setVendorAnchorRef({ current: e.target });
                                setVendorDropdownOpen(true);
                            }}
                            onBlur={() => setVendorDropdownOpen(false)}
                            onChange={(e) => {
                                if (isViewOnlyMode) return;
                                const val = e.target.value;
                                setVoucherData({ ...voucherData, vendorId: '', vendorName: val });
                                setVendorAnchorRef({ current: e.target });
                                setVendorDropdownOpen(true);
                            }}
                            disabled={isViewOnlyMode}
                        />
                        <PortalDropdown isOpen={vendorDropdownOpen && vendors.length > 0} anchorRef={vendorAnchorRef}>
                            <ul className="w-full bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-50 overflow-hidden">
                                {vendors.filter(v => typeof voucherData.vendorName === 'string' ? v.name.toLowerCase().includes(voucherData.vendorName.toLowerCase()) : true).map(v => (
                                    <li
                                        key={v._id}
                                        onMouseDown={() => {
                                            setVoucherData({ ...voucherData, vendorId: v._id, vendorName: v.name, contactNumber: v.phone || '' });
                                            setVendorDropdownOpen(false);
                                        }}
                                        className="px-5 py-3.5 hover:bg-primary-50 hover:text-primary-700 cursor-pointer text-sm font-bold text-slate-700 transition-colors"
                                    >
                                        {v.name}
                                    </li>
                                ))}
                            </ul>
                        </PortalDropdown>
                    </div>
                    )}
                    <div>
                        <label className="text-xs font-black uppercase text-slate-400 tracking-widest block mb-2">Contact Number</label>
                        <input
                            type="text"
                            placeholder="1234567890"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-slate-900 font-bold transition-all"
                            value={voucherData.contactNumber}
                            onChange={(e) => setVoucherData({ ...voucherData, contactNumber: e.target.value })}
                            disabled={isViewOnlyMode}
                        />
                    </div>
                    {!isInvoiceMode && voucherData.voucherType === 'Sale Return' && (
                        <div className="md:col-span-2">
                            <label className="text-xs font-black uppercase text-slate-400 tracking-widest block mb-2">Link Existing GRN</label>
                            <select
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-slate-900 font-bold transition-all"
                                value={voucherData.referenceVoucherId || ''}
                                onChange={(e) => setVoucherData({ ...voucherData, referenceVoucherId: e.target.value })}
                                disabled={isViewOnlyMode}
                            >
                                <option value="">Select GRN</option>
                                {grnOptions.map(grn => (
                                    <option key={grn._id} value={grn._id}>{grn.voucherNumber} - {grn.vendorName}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Product Grid */}
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-4 text-center">Sr.</th>
                                <th className="px-4 py-4 w-1/4">Product Name</th>
                                <th className="px-4 py-4 text-center">Qty</th>
                                <th className="px-4 py-4 text-center">UOM</th>
                                <th className="px-4 py-4 text-right">Price</th>
                                <th className="px-4 py-4 text-right">Amount</th>
                                <th className="px-4 py-4 text-center">Tax %</th>
                                {!isViewOnlyMode && <th className="px-4 py-4 text-center">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {voucherData.items.map((item, index) => (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 text-center font-bold text-slate-400">{item.srNumber}</td>
                                    <td className="px-4 py-3 relative">
                                        <input
                                            type="text"
                                            placeholder="Type or Select Product"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm font-bold text-slate-900"
                                            value={item.productName || ''}
                                            onFocus={(e) => {
                                                if (isViewOnlyMode) return;
                                                setProductAnchorRef({ current: e.target });
                                                setActiveProductDropdown(item.id);
                                            }}
                                            onBlur={() => setActiveProductDropdown(null)}
                                            onChange={(e) => {
                                                if (isViewOnlyMode) return;
                                                setProductAnchorRef({ current: e.target });
                                                handleItemChange(item.id, 'productName', e.target.value);
                                            }}
                                            disabled={isViewOnlyMode}
                                        />
                                        <PortalDropdown isOpen={activeProductDropdown === item.id && products.length > 0} anchorRef={productAnchorRef}>
                                            <ul className="w-full bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-50 overflow-hidden">
                                                {products.filter(p => !item.productName || p.productName.toLowerCase().includes(item.productName.toLowerCase())).map(p => (
                                                    <li
                                                        key={p._id}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            handleItemChange(item.id, 'productId', p._id);
                                                            setActiveProductDropdown(null);
                                                        }}
                                                        className="px-4 py-3 hover:bg-primary-50 hover:text-primary-700 cursor-pointer text-xs font-bold text-slate-700 transition-colors"
                                                    >
                                                        {p.productName}
                                                        <span className="block text-[9px] text-slate-400 uppercase mt-0.5">Rate: {p.basePrice} | Tax: {p.gstPercentage}%</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </PortalDropdown>
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full px-3 py-2 text-center bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm font-bold text-slate-900"
                                            value={item.qty || ''}
                                            onChange={(e) => handleItemChange(item.id, 'qty', e.target.value)}
                                            disabled={isViewOnlyMode}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <select
                                            className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-xs font-bold text-slate-900"
                                            value={item.uom}
                                            onChange={(e) => handleItemChange(item.id, 'uom', e.target.value)}
                                            disabled={isViewOnlyMode}
                                        >
                                            <option value="Pcs">Pcs</option>
                                            <option value="Nos">Nos</option>
                                            <option value="Set">Set</option>
                                            <option value="Ltr">Ltr</option>
                                            <option value="Pack">Pack</option>
                                            <option value="Doz">Doz</option>
                                            <option value="Box">Box</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full px-3 py-2 text-right bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm font-bold text-slate-900"
                                            value={item.price || ''}
                                            onChange={(e) => handleItemChange(item.id, 'price', e.target.value)}
                                            disabled={isViewOnlyMode}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-slate-900">
                                        {Number(item.amount).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-16 px-2 py-2 text-center bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm font-bold text-slate-900"
                                                value={item.taxPercentage || ''}
                                                onChange={(e) => handleItemChange(item.id, 'taxPercentage', e.target.value)}
                                                disabled={isViewOnlyMode}
                                            />
                                        </div>
                                    </td>
                                    {!isViewOnlyMode && (
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => removeRow(item.id)}
                                                className="p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all"
                                                disabled={voucherData.items.length === 1}
                                            >
                                                <MdDelete size={20} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!isViewOnlyMode && (
                        <div className="p-4 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={addRow}
                                className="flex items-center gap-2 text-primary-600 font-bold hover:text-primary-700 transition-colors text-sm"
                            >
                                <MdAdd size={20} /> Add New Row
                            </button>
                        </div>
                    )}
                </div>

                {/* Totals Section */}
                <div className="flex justify-end pt-6 border-t border-slate-200">
                    <div className="w-full md:w-80 bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Total Qty</span>
                            <span className="font-black text-slate-900">{totalQty}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Total Amount</span>
                            <span className="font-black text-slate-900">₹{totalAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Total Tax</span>
                            <span className="font-black text-slate-900">₹{totalTax.toLocaleString()}</span>
                        </div>
                        <div className="pt-4 border-t-2 border-slate-200 flex justify-between items-center">
                            <span className="font-black text-slate-900 uppercase tracking-widest text-xs">Grand Total</span>
                            <span className="text-2xl font-black text-primary-600">₹{grandTotal.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Actions Modal */}
            <Modal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                hideHeader={true}
                maxWidth="max-w-sm"
            >
                <div className="text-center space-y-6 py-2">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                        <MdSave size={40} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Voucher Saved!</h3>
                        <p className="text-slate-500 font-medium mt-2 leading-relaxed">Your voucher has been successfully recorded and inventory is updated.</p>
                    </div>
                    
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                        <PDFDownloadLink document={<VoucherPDF voucher={voucherData} companySettings={companySettings} />} fileName={`Voucher-${voucherData.voucherNumber.replace(/\//g, '-')}.pdf`}>
                            {({ loading: pdfLoading }) => (
                                <button
                                    disabled={pdfLoading}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                >
                                    <MdPrint size={20} className="text-slate-500" /> {pdfLoading ? 'Preparing PDF...' : 'Print Voucher'}
                                </button>
                            )}
                        </PDFDownloadLink>
                        
                        {!isEditMode && savedVoucherId && savedVoucherId !== 'new' && (
                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    navigate(`${basePath}/${savedVoucherId}`);
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95"
                            >
                                <MdEdit size={20} className="text-amber-500" /> Edit Current Voucher
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setVoucherData({
                                    voucherType: isInvoiceMode ? 'Invoice' : 'Purchase',
                                    voucherNumber: `${isInvoiceMode ? 'INV' : 'GRN'}-${Date.now()}`,
                                    date: new Date().toISOString().split('T')[0],
                                    vendorId: '',
                                    vendorName: '',
                                    customerId: '',
                                    customerName: '',
                                    contactNumber: '',
                                    referenceVoucherId: '',
                                    items: [
                                        { id: Date.now(), srNumber: 1, productId: '', productName: '', qty: 0, uom: 'Pcs', price: 0, amount: 0, taxPercentage: 5, taxAmount: 0 }
                                    ]
                                });
                                setShowSuccessModal(false);
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-95"
                        >
                            <MdAdd size={20} /> Create New
                        </button>
                        <button
                            onClick={() => {
                                setShowSuccessModal(false);
                                navigate(basePath);
                            }}
                            className="w-full flex items-center justify-center gap-2 pt-2 text-slate-400 hover:text-slate-900 font-bold transition-colors"
                        >
                            Go to {isInvoiceMode ? 'Invoices' : 'GRN'} List
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CreateVoucher;
