import React, { useEffect, useMemo, useState } from 'react';
import { csmService, customerService, productService, importService, voucherService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdSecurity, MdAssignmentTurnedIn, MdCheckCircle, 
    MdAdd, MdSearch, MdInfoOutline, MdWarning,
    MdPublish, MdFileDownload
} from 'react-icons/md';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';

const WarrantyAMC = () => {
    const [activeSection, setActiveSection] = useState('warranties');
    const [loading, setLoading] = useState(false);
    const [warranties, setWarranties] = useState([]);
    const [amcs, setAmcs] = useState([]);
    
    // Entitlements Verification Checker state
    const [verifyCust, setVerifyCust] = useState('');
    const [verifyInvoice, setVerifyInvoice] = useState('');
    const [verifyProd, setVerifyProd] = useState('');
    const [entitlementRes, setEntitlementRes] = useState(null);
    const [coverageDetails, setCoverageDetails] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [customerInvoices, setCustomerInvoices] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [scheduledVisits, setScheduledVisits] = useState([]);

    // Import Summary Modal states
    const [importResult, setImportResult] = useState(null);
    const [showImportResultModal, setShowImportResultModal] = useState(false);

    // List dependencies for forms
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        customerId: '',
        productId: '',
        purchaseDate: '',
        expiryDate: '',
        serialNumber: '',
        contractNo: '',
        startDate: '',
        endDate: '',
        visitsAllowed: 4,
        amount: ''
    });

    const fetchLists = async () => {
        setLoading(true);
        try {
            if (activeSection === 'warranties') {
                const res = await csmService.getWarranties();
                setWarranties(res.data || []);
            } else {
                const res = await csmService.getAmcs();
                setAmcs(res.data || []);
            }
        } catch (error) {
            toast.error('Failed to load listings');
        } finally {
            setLoading(false);
        }
    };

    const loadFormDependencies = async () => {
        try {
            const [custRes, prodRes] = await Promise.all([
                customerService.getAll({ limit: 500 }),
                productService.getAll({ limit: 500 })
            ]);
            setCustomers(custRes.data?.data || custRes.data || []);
            setProducts(prodRes.data?.data || prodRes.data || []);
        } catch (error) {
            console.error('Error preloading entities:', error);
        }
    };

    useEffect(() => {
        fetchLists();
    }, [activeSection]);

    useEffect(() => {
        loadFormDependencies();
    }, []);

    useEffect(() => {
        const loadCustomerInvoiceFlow = async () => {
            setVerifyInvoice('');
            setVerifyProd('');
            setEntitlementRes(null);
            setCoverageDetails(null);
            setCustomerInvoices([]);
            setScheduledVisits([]);

            if (!verifyCust) return;

            setLoadingInvoices(true);
            try {
                const [invoiceRes, visitRes] = await Promise.all([
                    voucherService.getAll({ scope: 'invoice', customerId: verifyCust }),
                    csmService.getVisits({ status: 'Scheduled' }).catch(() => ({ data: [] }))
                ]);

                setCustomerInvoices(invoiceRes.data || []);

                const visitsForCustomer = (visitRes.data || []).filter((visit) => {
                    const customer = visit.ticketId?.customerId;
                    const customerId = typeof customer === 'string' ? customer : customer?._id;
                    return customerId === verifyCust;
                });
                setScheduledVisits(visitsForCustomer);
            } catch (error) {
                console.error('Error loading customer invoices:', error);
                toast.error('Failed to load invoices for selected customer');
            } finally {
                setLoadingInvoices(false);
            }
        };

        loadCustomerInvoiceFlow();
    }, [verifyCust]);

    useEffect(() => {
        setVerifyProd('');
        setEntitlementRes(null);
        setCoverageDetails(null);
    }, [verifyInvoice]);

    const selectedInvoice = useMemo(() => (
        customerInvoices.find(invoice => invoice._id === verifyInvoice)
    ), [customerInvoices, verifyInvoice]);

    const customerOptions = useMemo(() => (
        customers.map(customer => {
            const companyName = customer.companyName || '';
            const customerName = customer.customerName || '';
            return {
                value: customer._id,
                label: companyName && customerName ? `${companyName} (${customerName})` : companyName || customerName || 'Unnamed Customer'
            };
        })
    ), [customers]);

    const invoiceOptions = useMemo(() => (
        customerInvoices.map(invoice => ({
            value: invoice._id,
            label: `${invoice.voucherNumber || 'Invoice'} - ${invoice.date ? new Date(invoice.date).toLocaleDateString() : 'No date'} - Rs ${Number(invoice.grandTotal || 0).toLocaleString('en-IN')}`
        }))
    ), [customerInvoices]);

    const invoiceProductOptions = useMemo(() => {
        const seenProducts = new Set();
        return (selectedInvoice?.items || [])
            .filter(item => item.productId)
            .filter(item => {
                const id = String(item.productId);
                if (seenProducts.has(id)) return false;
                seenProducts.add(id);
                return true;
            })
            .map(item => ({
                value: String(item.productId),
                label: `${item.productName || 'Product'}${item.qty ? ` - Qty ${item.qty}` : ''}`
            }));
    }, [selectedInvoice]);

    const selectedInvoiceItem = useMemo(() => (
        (selectedInvoice?.items || []).find(item => String(item.productId) === verifyProd)
    ), [selectedInvoice, verifyProd]);

    const handleVerify = async (e) => {
        e.preventDefault();
        if (!verifyCust || !verifyInvoice || !verifyProd) {
            toast.info('Select customer, invoice, and product first');
            return;
        }
        setVerifying(true);
        try {
            const [res, warrantiesRes, amcsRes] = await Promise.all([
                csmService.verifyEntitlements({
                    customerId: verifyCust,
                    productId: verifyProd
                }),
                csmService.getWarranties().catch(() => ({ data: [] })),
                csmService.getAmcs().catch(() => ({ data: [] }))
            ]);

            const matchingWarranty = (warrantiesRes.data || []).find((warranty) => {
                const customerId = warranty.customerId?._id || warranty.customerId;
                const productId = warranty.productId?._id || warranty.productId;
                return customerId === verifyCust && productId === verifyProd;
            });

            const matchingAmc = (amcsRes.data || []).find((amc) => {
                const customerId = amc.customerId?._id || amc.customerId;
                return customerId === verifyCust;
            });

            setEntitlementRes(res.data);
            setCoverageDetails({
                warranty: matchingWarranty || null,
                amc: matchingAmc || null
            });
        } catch (error) {
            toast.error('Entitlements validation failed');
        } finally {
            setVerifying(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            if (activeSection === 'warranties') {
                await csmService.createWarranty({
                    customerId: formData.customerId,
                    productId: formData.productId,
                    purchaseDate: formData.purchaseDate,
                    expiryDate: formData.expiryDate,
                    serialNumber: formData.serialNumber
                });
                toast.success('Warranty registered successfully');
            } else {
                await csmService.createAmc({
                    customerId: formData.customerId,
                    contractNo: formData.contractNo,
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    visitsAllowed: formData.visitsAllowed,
                    amount: formData.amount
                });
                toast.success('AMC contract registered successfully');
            }
            setShowModal(false);
            fetchLists();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Registration failed');
        }
    };

    const handleDownloadTemplate = async (type) => {
        try {
            let blobRes;
            if (type === 'warranty') {
                blobRes = await importService.getWarrantyTemplate();
            } else {
                blobRes = await importService.getAmcTemplate();
            }
            const url = window.URL.createObjectURL(new Blob([blobRes.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}_import_template.xlsx`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`${type === 'warranty' ? 'Warranty' : 'AMC'} template downloaded successfully!`);
        } catch (error) {
            console.error('Error downloading template:', error);
            toast.error('Failed to download Excel template.');
        }
    };

    const handleImportFile = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        try {
            let res;
            if (type === 'warranty') {
                res = await importService.importWarranties(file);
            } else {
                res = await importService.importAmcs(file);
            }

            setImportResult({
                type,
                imported: res.data.imported || 0,
                updated: res.data.updated || 0,
                skipped: res.data.skipped || 0,
                failed: res.data.failed || 0,
                errors: res.data.errors || []
            });
            setShowImportResultModal(true);

            // Reload tables
            fetchLists();

            if (res.data.success) {
                toast.success('Import completed successfully!');
            } else {
                toast.warning('Import completed with some errors. Please check the summary report.');
            }
        } catch (error) {
            console.error('Import error:', error);
            toast.error(error.response?.data?.message || 'Error occurred during import');
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset file input
        }
    };

    const downloadErrorReport = () => {
        if (!importResult || !importResult.errors || importResult.errors.length === 0) return;
        const blobContent = `Import Error Report for ${importResult.type === 'warranty' ? 'Warranties' : 'AMCs'}\nGenerated on: ${new Date().toLocaleString()}\n\nFailed rows details:\n` + importResult.errors.join('\n');
        const url = window.URL.createObjectURL(new Blob([blobContent], { type: 'text/plain' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${importResult.type}_import_errors.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        Entitlements & Contracts
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Manage customer warranties, product serial numbers, and annual maintenance contracts.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Add Buttons */}
                    <button
                        onClick={() => {
                            setFormData({
                                customerId: '',
                                productId: '',
                                purchaseDate: '',
                                expiryDate: '',
                                serialNumber: '',
                                contractNo: '',
                                startDate: '',
                                endDate: '',
                                visitsAllowed: 4,
                                amount: ''
                            });
                            setActiveSection('warranties');
                            setShowModal(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                    >
                        <MdAdd size={16} />
                        Add Warranty
                    </button>
                    <button
                        onClick={() => {
                            setFormData({
                                customerId: '',
                                productId: '',
                                purchaseDate: '',
                                expiryDate: '',
                                serialNumber: '',
                                contractNo: '',
                                startDate: '',
                                endDate: '',
                                visitsAllowed: 4,
                                amount: ''
                            });
                            setActiveSection('amc');
                            setShowModal(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                    >
                        <MdAdd size={16} />
                        Add AMC
                    </button>

                    {/* Import Buttons */}
                    <label className="flex items-center gap-1.5 px-4 py-3 bg-slate-800 hover:bg-slate-950 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md cursor-pointer active:scale-95">
                        <MdPublish size={16} />
                        Import Warranty
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={(e) => handleImportFile(e, 'warranty')}
                            className="hidden"
                        />
                    </label>
                    <label className="flex items-center gap-1.5 px-4 py-3 bg-slate-800 hover:bg-slate-950 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md cursor-pointer active:scale-95">
                        <MdPublish size={16} />
                        Import AMC
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={(e) => handleImportFile(e, 'amc')}
                            className="hidden"
                        />
                    </label>

                    {/* Download Template Buttons */}
                    <button
                        onClick={() => handleDownloadTemplate('warranty')}
                        className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all border border-slate-200"
                    >
                        <MdFileDownload size={16} />
                        Warranty Template
                    </button>
                    <button
                        onClick={() => handleDownloadTemplate('amc')}
                        className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all border border-slate-200"
                    >
                        <MdFileDownload size={16} />
                        AMC Template
                    </button>
                </div>
            </div>

            {/* Verification Tool */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                <div className="lg:col-span-2 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-teal-600">Entitlements Sandbox</span>
                    <h3 className="text-lg font-black text-slate-900 font-outfit uppercase -mt-1">Verify Service Eligibility</h3>
                    <form onSubmit={handleVerify} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</label>
                            <SearchableSelect
                                value={verifyCust}
                                onChange={setVerifyCust}
                                options={customerOptions}
                                placeholder="Select Customer"
                                noResultsText="No customers found"
                                inputClass="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-left"
                                menuClass="max-h-56"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Invoice</label>
                            <SearchableSelect
                                value={verifyInvoice}
                                onChange={setVerifyInvoice}
                                options={invoiceOptions}
                                placeholder={loadingInvoices ? 'Loading invoices...' : 'Select Invoice'}
                                noResultsText={verifyCust ? 'No invoices found' : 'Select customer first'}
                                inputClass={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-left ${!verifyCust ? 'opacity-60 pointer-events-none' : ''}`}
                                menuClass="max-h-56"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Product</label>
                            <SearchableSelect
                                value={verifyProd}
                                onChange={setVerifyProd}
                                options={invoiceProductOptions}
                                placeholder="Select Product"
                                noResultsText={verifyInvoice ? 'No products found on invoice' : 'Select invoice first'}
                                inputClass={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-left ${!verifyInvoice ? 'opacity-60 pointer-events-none' : ''}`}
                                menuClass="max-h-56"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={verifying || !verifyCust || !verifyInvoice || !verifyProd}
                            className="py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
                        >
                            {verifying ? 'Checking...' : 'Check Coverage'}
                        </button>
                    </form>
                </div>
                <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
                    {entitlementRes ? (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs font-bold">
                            <div className="flex items-center gap-1.5">
                                {entitlementRes.recommendedBillingType === 'Paid' ? (
                                    <MdWarning className="text-red-500" size={18} />
                                ) : (
                                    <MdCheckCircle className="text-teal-600" size={18} />
                                )}
                                <span className="text-slate-900">Billing recommendation: </span>
                            </div>
                            <div className="px-3 py-1.5 text-center text-white bg-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                {entitlementRes.recommendedBillingType}
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                <div className="p-3 rounded-xl bg-white border border-slate-100">
                                    <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Invoice & Product</p>
                                    <p className="text-[10px] text-slate-700">Invoice: {selectedInvoice?.voucherNumber || '-'}</p>
                                    <p className="text-[10px] text-slate-700">Product: {selectedInvoiceItem?.productName || 'Selected product'}</p>
                                    {selectedInvoiceItem?.qty && (
                                        <p className="text-[10px] text-slate-500">Invoice Qty: {selectedInvoiceItem.qty}</p>
                                    )}
                                </div>

                                <div className="p-3 rounded-xl bg-white border border-slate-100">
                                    <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Warranty</p>
                                    {coverageDetails?.warranty ? (
                                        <>
                                            <p className={`text-[10px] ${entitlementRes.warranty.isActive ? 'text-teal-600' : 'text-rose-500'}`}>
                                                {entitlementRes.warranty.isActive ? 'Active' : coverageDetails.warranty.status || 'Not Active'}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                                Expiry: {coverageDetails.warranty.expiryDate ? new Date(coverageDetails.warranty.expiryDate).toLocaleDateString() : '-'}
                                            </p>
                                            <p className="text-[10px] text-slate-500">Serial: {coverageDetails.warranty.serialNumber || '-'}</p>
                                        </>
                                    ) : (
                                        <p className="text-[10px] text-slate-500">No warranty registered for this invoice product.</p>
                                    )}
                                </div>

                                <div className="p-3 rounded-xl bg-white border border-slate-100">
                                    <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">AMC / Maintenance Contract</p>
                                    {coverageDetails?.amc ? (
                                        <>
                                            <p className={`text-[10px] ${entitlementRes.amc.isActive ? 'text-primary-600' : 'text-rose-500'}`}>
                                                {entitlementRes.amc.isActive ? `Active - ${entitlementRes.amc.remainingVisits} visits remaining` : coverageDetails.amc.status || 'Not Active'}
                                            </p>
                                            <p className="text-[10px] text-slate-500">Contract: {coverageDetails.amc.contractNo || '-'}</p>
                                            <p className="text-[10px] text-slate-500">
                                                Validity: {coverageDetails.amc.startDate ? new Date(coverageDetails.amc.startDate).toLocaleDateString() : '-'} to {coverageDetails.amc.endDate ? new Date(coverageDetails.amc.endDate).toLocaleDateString() : '-'}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-[10px] text-slate-500">No AMC contract found for this customer.</p>
                                    )}
                                </div>

                                <div className="p-3 rounded-xl bg-white border border-slate-100">
                                    <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Scheduled Maintenance</p>
                                    {scheduledVisits.length > 0 ? (
                                        <div className="space-y-1">
                                            {scheduledVisits.slice(0, 3).map((visit) => (
                                                <p key={visit._id} className="text-[10px] text-primary-600">
                                                    {visit.visitNo} - {visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleDateString() : 'Date pending'}
                                                    {visit.engineerId?.name ? ` - ${visit.engineerId.name}` : ''}
                                                </p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-slate-500">No scheduled maintenance visits for this customer.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-slate-400 text-xs font-semibold flex flex-col items-center justify-center">
                            <MdInfoOutline size={24} className="mb-1 text-slate-300" />
                            Select a customer, invoice, and invoice product to review coverage.
                            {scheduledVisits.length > 0 && (
                                <div className="mt-3 w-full p-3 rounded-xl bg-primary-50 border border-primary-100 text-left">
                                    <p className="text-[10px] text-primary-700 font-black uppercase tracking-widest mb-1">Scheduled maintenance</p>
                                    {scheduledVisits.slice(0, 3).map((visit) => (
                                        <p key={visit._id} className="text-[10px] text-primary-600 font-bold">
                                            {visit.visitNo} - {visit.scheduledDate ? new Date(visit.scheduledDate).toLocaleDateString() : 'Date pending'}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Toggle Sections */}
            <div className="flex border-b border-slate-200 gap-2">
                <button
                    onClick={() => setActiveSection('warranties')}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all ${
                        activeSection === 'warranties'
                            ? 'border-primary-600 text-primary-600 font-black'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <MdSecurity size={18} />
                    Product Warranties
                </button>
                <button
                    onClick={() => setActiveSection('amc')}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all ${
                        activeSection === 'amc'
                            ? 'border-primary-600 text-primary-600 font-black'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <MdAssignmentTurnedIn size={18} />
                    AMC Contracts
                </button>
            </div>

            {/* Table Listings */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Records...</p>
                    </div>
                ) : activeSection === 'warranties' ? (
                    warranties.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <p className="font-bold">No product warranties registered.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4">Serial Number</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Product</th>
                                        <th className="px-6 py-4">Purchase Date</th>
                                        <th className="px-6 py-4">Expiry Date</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                                    {warranties.map((w) => (
                                        <tr key={w._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-900">{w.serialNumber || 'N/A'}</td>
                                            <td className="px-6 py-4 text-slate-900">{w.customerId?.companyName || w.customerId?.customerName}</td>
                                            <td className="px-6 py-4 text-slate-500">{w.productId?.productName}</td>
                                            <td className="px-6 py-4 text-slate-400">{new Date(w.purchaseDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-slate-400">{new Date(w.expiryDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${w.status === 'Active' ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>
                                                    {w.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    amcs.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <p className="font-bold">No AMC contracts registered.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4">Contract No</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Duration</th>
                                        <th className="px-6 py-4">Visits (Allowed / Used)</th>
                                        <th className="px-6 py-4">Price</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                                    {amcs.map((a) => (
                                        <tr key={a._id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-900">{a.contractNo}</td>
                                            <td className="px-6 py-4 text-slate-900">{a.customerId?.companyName || a.customerId?.customerName}</td>
                                            <td className="px-6 py-4 text-slate-400">{new Date(a.startDate).toLocaleDateString()} - {new Date(a.endDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-slate-500">{a.visitsAllowed} Allowed / {a.visitsUsed} Used</td>
                                            <td className="px-6 py-4 font-black text-teal-600">₹{a.amount || 0}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${a.status === 'Active' ? 'bg-teal-50 text-teal-600 border-teal-200' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>
                                                    {a.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* Modal Add */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={activeSection === 'warranties' ? 'Register Product Warranty' : 'Create AMC Contract'}
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="flex-1 w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="warranty-amc-form"
                            className="flex-1 w-full py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                        >
                            Register
                        </button>
                    </>
                }
            >
                <form id="warranty-amc-form" onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer *</label>
                        <select
                            required
                            value={formData.customerId}
                            onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            <option value="">Select Customer</option>
                            {customers.map(c => <option key={c._id} value={c._id}>{c.companyName || c.customerName}</option>)}
                        </select>
                    </div>

                    {activeSection === 'warranties' ? (
                        <>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Product *</label>
                                <select
                                    required
                                    value={formData.productId}
                                    onChange={e => setFormData({ ...formData, productId: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                >
                                    <option value="">Select Product</option>
                                    {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Serial Number *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.serialNumber}
                                    onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Purchase Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.purchaseDate}
                                        onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expiry Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.expiryDate}
                                        onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contract Number *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.contractNo}
                                    onChange={e => setFormData({ ...formData, contractNo: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Start Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">End Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.endDate}
                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Allowed Visits *</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={formData.visitsAllowed}
                                        onChange={e => setFormData({ ...formData, visitsAllowed: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contract Price *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </form>
            </Modal>

            {/* Import Summary Modal */}
            {showImportResultModal && importResult && (
                <Modal
                    isOpen={showImportResultModal}
                    onClose={() => setShowImportResultModal(false)}
                    title="📊 Upload Summary"
                    maxWidth="max-w-md"
                    footer={
                        <button
                            onClick={() => setShowImportResultModal(false)}
                            className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                        >
                            Close Summary
                        </button>
                    }
                >
                    <div className="space-y-6">
                        <p className="text-sm font-semibold text-slate-600">
                            Import results for <span className="text-slate-900 font-bold uppercase">{importResult.type === 'warranty' ? 'Warranties' : 'AMCs'}</span>:
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
                                <span className="block text-[10px] font-black uppercase text-emerald-500 tracking-wider">Imported</span>
                                <span className="text-2xl font-black text-emerald-600">{importResult.imported}</span>
                            </div>
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-center">
                                <span className="block text-[10px] font-black uppercase text-blue-500 tracking-wider">Updated</span>
                                <span className="text-2xl font-black text-blue-600">{importResult.updated}</span>
                            </div>
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Skipped</span>
                                <span className="text-2xl font-black text-slate-500">{importResult.skipped}</span>
                            </div>
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-center">
                                <span className="block text-[10px] font-black uppercase text-rose-500 tracking-wider">Failed</span>
                                <span className="text-2xl font-black text-rose-600">{importResult.failed}</span>
                            </div>
                        </div>

                        {importResult.failed > 0 && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-3">
                                <p className="text-xs font-bold text-rose-700">
                                    ⚠️ The import encountered {importResult.failed} errors. You can download the error log report to debug rows.
                                </p>
                                <button
                                    onClick={downloadErrorReport}
                                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-1.5"
                                >
                                    <MdFileDownload size={16} />
                                    Download Error Report
                                </button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default WarrantyAMC;
