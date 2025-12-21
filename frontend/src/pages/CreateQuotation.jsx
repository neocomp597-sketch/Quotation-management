import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdArrowBack, MdAdd, MdDelete, MdSave, MdCheckCircle, MdPerson, MdInventory2, MdGavel, MdSearch, MdClose, MdPayments, MdEventAvailable, MdBadge, MdTrendingDown, MdEmail, MdPhone, MdLocationOn } from 'react-icons/md';
import { customerService, productService, quotationService, termsService, salespersonService, siteService } from '../services/api';
import { calculateLineItem, formatCurrency, resolveImageUrl } from '../utils/helpers';
import Modal from '../components/Modal';

const CreateQuotation = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    // Master Data
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [termsTemplates, setTermsTemplates] = useState([]);
    const [salespersons, setSalespersons] = useState([]);
    const [sites, setSites] = useState([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isSalespersonModalOpen, setIsSalespersonModalOpen] = useState(false);
    const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const addressInputRef = React.useRef(null);
    const autocompleteRef = React.useRef(null);

    // Form State
    const [header, setHeader] = useState({
        quotationNo: 'AUTO-GEN',
        quotationDate: new Date().toISOString().split('T')[0],
        validTill: '',
        customerId: '',
        salespersonName: '',
        siteId: '',
        paymentTerms: '15 Days Credit'
    });

    const [newSite, setNewSite] = useState({
        siteName: '',
        location: '',
        address: '',
        contactPerson: '',
        mobile: ''
    });

    const [items, setItems] = useState([]);
    const [termsContent, setTermsContent] = useState('');
    const [selectedTermsTemplateId, setSelectedTermsTemplateId] = useState('');
    const [overallDiscount, setOverallDiscount] = useState(0);

    const [newSalesperson, setNewSalesperson] = useState({
        name: '',
        email: '',
        mobile: ''
    });

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [custRes, prodRes, termsRes, salesRes] = await Promise.all([
                    customerService.getAll(),
                    productService.getAll(),
                    termsService.getAll(),
                    salespersonService.getAll()
                ]);
                setCustomers(custRes.data);
                setProducts(prodRes.data);
                setTermsTemplates(termsRes.data);
                setSalespersons(salesRes.data);

                // If NOT edit mode, set default terms
                if (!id) {
                    const defaultTerms = termsRes.data.find(t => t.isDefault);
                    if (defaultTerms) {
                        setSelectedTermsTemplateId(defaultTerms._id);
                        setTermsContent(defaultTerms.content);
                    }
                }
            } catch (err) {
                console.error("Error fetching data:", err);
            }
        };
        fetchData();

        if (!id) {
            const dt = new Date();
            dt.setDate(dt.getDate() + 7);
            setHeader(prev => ({ ...prev, validTill: dt.toISOString().split('T')[0] }));
        }
    }, [id]);

    // Fetch quotation details if in edit mode
    useEffect(() => {
        if (id) {
            const fetchQuotation = async () => {
                setLoading(true);
                try {
                    const res = await quotationService.getById(id);
                    const q = res.data;

                    setHeader({
                        quotationNo: q.quotationNo,
                        quotationDate: new Date(q.quotationDate).toISOString().split('T')[0],
                        validTill: new Date(q.validTill).toISOString().split('T')[0],
                        customerId: q.customerId._id || q.customerId, // Handle populated or raw ID
                        salespersonName: q.salespersonName || '',
                        siteId: q.siteId?._id || q.siteId || '',
                        paymentTerms: q.paymentTerms || '15 Days Credit'
                    });

                    setItems(q.items.map(item => ({
                        productId: item.productId._id || item.productId,
                        productName: item.productSnapshot?.productName || '',
                        productCode: item.productSnapshot?.productCode || '',
                        productImageUrl: item.productSnapshot?.productImageUrl || '',
                        hsnCode: item.productSnapshot?.hsnCode || '',
                        uom: item.productSnapshot?.uom || '',
                        gstPercentage: item.productSnapshot?.gstPercentage || 18,
                        quantity: item.quantity,
                        rate: item.rate,
                        discountPercent: item.discountPercent,
                        siteId: item.siteId?._id || item.siteId || '',
                        // Recalculate derived fields to be safe
                        ...calculateLineItem(item.quantity, item.rate, item.discountPercent, item.productSnapshot?.gstPercentage || 18)
                    })));

                    setSelectedTermsTemplateId(q.termsTemplateId || '');
                    setTermsContent(q.customTerms || '');
                    setOverallDiscount(q.totalDiscount - (q.items.reduce((sum, i) => sum + i.discountAmount, 0)) || 0); // Approximation if needed, or better logic if backend stores strictly. Ideally stores "additionalDiscount" distinct from line discounts. Check backend logic? Backend stores totalDiscount which is sum of all. So we might need to reverse engineer or just set it to 0 if simple. 
                    // Actually, the frontend calculates `totalDiscount` as `itemDiscount + overallDiscount`.
                    // So `overallDiscount = totalDiscount - itemDiscount`.
                    const totalItemDiscount = q.items.reduce((sum, i) => sum + (i.discountAmount || 0), 0);
                    setOverallDiscount(Math.max(0, (q.totalDiscount || 0) - totalItemDiscount));

                } catch (err) {
                    console.error("Error fetching quotation:", err);
                    alert("Failed to load quotation for editing");
                    navigate('/quotations');
                } finally {
                    setLoading(false);
                }
            };
            fetchQuotation();
        }
    }, [id, navigate]);

    // Fetch sites when customer changes
    useEffect(() => {
        if (header.customerId) {
            const fetchSites = async () => {
                try {
                    const res = await siteService.getAll(header.customerId);
                    setSites(res.data);
                } catch (err) {
                    console.error("Error fetching sites:", err);
                }
            };
            fetchSites();
        } else {
            setSites([]);
        }
    }, [header.customerId]);

    // Google Maps Autocomplete Setup
    useEffect(() => {
        let timer;
        if (isSiteModalOpen && addressInputRef.current) {
            // Small timeout to ensure the modal DOM is fully ready
            timer = setTimeout(() => {
                if (window.google && window.google.maps && window.google.maps.places) {
                    autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
                        types: ['geocode', 'establishment'],
                        componentRestrictions: { country: 'IN' }
                    });

                    autocompleteRef.current.addListener('place_changed', () => {
                        const place = autocompleteRef.current.getPlace();
                        if (place.geometry) {
                            setNewSite(prev => ({
                                ...prev,
                                address: place.formatted_address || '',
                                location: place.name || ''
                            }));
                        }
                    });

                    // Prevent Enter key from closing modal when selecting a location
                    const handleKeyDown = (e) => {
                        if (e.key === 'Enter') {
                            const pacContainer = document.querySelector('.pac-container');
                            if (pacContainer && pacContainer.offsetParent !== null) {
                                e.preventDefault();
                            }
                        }
                    };
                    const input = addressInputRef.current;
                    if (input) {
                        input.addEventListener('keydown', handleKeyDown);
                        return () => input.removeEventListener('keydown', handleKeyDown);
                    }
                }
            }, 500);
        }
        return () => clearTimeout(timer);
    }, [isSiteModalOpen]);

    // Derived Data
    const selectedCustomer = useMemo(() =>
        customers.find(c => c._id === header.customerId),
        [header.customerId, customers]);

    const filteredProducts = useMemo(() =>
        products.filter(p =>
            p.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.productCode.toLowerCase().includes(productSearch.toLowerCase())
        ),
        [productSearch, products]);

    const totals = useMemo(() => {
        const res = items.reduce((acc, item) => {
            acc.subtotal += (item.quantity * item.rate);
            acc.itemDiscount += item.discountAmount;
            acc.taxable += item.taxableAmount;
            acc.gst += item.gstAmount;
            return acc;
        }, { subtotal: 0, itemDiscount: 0, taxable: 0, gst: 0 });

        const subtotalAfterItemDisc = res.taxable;
        const finalTaxable = subtotalAfterItemDisc - (overallDiscount || 0);

        const grandTotalRaw = res.taxable + res.gst - (overallDiscount || 0);
        const grandTotal = Math.round(grandTotalRaw);
        const roundOff = (grandTotal - grandTotalRaw).toFixed(2);

        return { ...res, finalTaxable, grandTotal, roundOff };
    }, [items, overallDiscount]);

    // Handlers
    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        setHeader(prev => ({ ...prev, [name]: value }));
    };

    const addProductToQuotation = (product) => {
        const existing = items.find(i => i.productId === product._id);
        if (existing) {
            alert("Product already in list. Adjust quantity there.");
            return;
        }

        const calcs = calculateLineItem(1, product.basePrice, 0, product.gstPercentage);
        const newItem = {
            productId: product._id,
            productName: product.productName,
            productCode: product.productCode,
            productImageUrl: product.productImageUrl,
            hsnCode: product.hsnCode,
            uom: product.uom,
            gstPercentage: product.gstPercentage,
            quantity: 1,
            rate: product.basePrice,
            discountPercent: 0,
            siteId: header.siteId || '',
            ...calcs
        };

        setItems([...items, newItem]);
        setIsProductModalOpen(false);
    };

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        const calcs = calculateLineItem(
            Number(item.quantity),
            Number(item.rate),
            Number(item.discountPercent),
            Number(item.gstPercentage)
        );

        newItems[index] = { ...item, ...calcs };
        setItems(newItems);
    };

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleTermsTemplateChange = (e) => {
        const id = e.target.value;
        const template = termsTemplates.find(t => t._id === id);
        setSelectedTermsTemplateId(id);
        setTermsContent(template?.content || '');
    };

    const handleAddSalesperson = async (e) => {
        e.preventDefault();
        try {
            const res = await salespersonService.create(newSalesperson);
            setSalespersons(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
            setHeader(prev => ({ ...prev, salespersonName: res.data.name }));
            setIsSalespersonModalOpen(false);
            setNewSalesperson({ name: '', email: '', mobile: '' });
        } catch (err) {
            console.error("Error creating salesperson:", err);
            alert("Failed to create salesperson");
        }
    };

    const handleAddSite = async (e) => {
        e.preventDefault();
        if (!header.customerId) return alert("Select a customer first");
        try {
            const res = await siteService.create({ ...newSite, customerId: header.customerId });
            setSites(prev => [...prev, res.data].sort((a, b) => a.siteName.localeCompare(b.siteName)));
            setHeader(prev => ({ ...prev, siteId: res.data._id }));
            setIsSiteModalOpen(false);
            setNewSite({ siteName: '', location: '', address: '', contactPerson: '', mobile: '' });
        } catch (err) {
            console.error("Error creating site:", err);
            alert("Failed to create site");
        }
    };

    const handleSubmit = async (status) => {
        if (!header.customerId) return alert("Select a Customer");
        if (items.length === 0) return alert("Add at least one product");

        setLoading(true);
        try {
            const quotationData = {
                ...header,
                items: items.map(item => ({
                    productId: item.productId,
                    productSnapshot: {
                        productName: item.productName,
                        productCode: item.productCode,
                        hsnCode: item.hsnCode,
                        gstPercentage: item.gstPercentage,
                        uom: item.uom,
                        productImageUrl: item.productImageUrl
                    },
                    siteId: item.siteId || header.siteId || undefined,
                    quantity: item.quantity,
                    rate: item.rate,
                    discountPercent: item.discountPercent,
                    discountAmount: item.discountAmount,
                    taxableAmount: item.taxableAmount,
                    gstAmount: item.gstAmount,
                    lineTotal: item.lineTotal
                })),
                termsTemplateId: selectedTermsTemplateId,
                customTerms: termsContent,
                totalDiscount: totals.itemDiscount + Number(overallDiscount),
                status
            };

            if (isEditMode) {
                await quotationService.update(id, quotationData);
                alert(`Quotation updated successfully!`);
            } else {
                await quotationService.create(quotationData);
                alert(`Quotation created successfully!`);
            }
            navigate('/quotations');
        } catch (err) {
            console.error(err);
            alert("Error saving quotation");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 pb-24">
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-3 bg-white hover:bg-slate-50 rounded-2xl shadow-sm border border-slate-100 transition-all text-slate-400 hover:text-primary-600">
                        <MdArrowBack size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{isEditMode ? 'Edit Quotation' : 'Create Quotation'}</h1>
                        <p className="text-slate-500 font-medium">{isEditMode ? 'Editing Reference:' : 'Drafting Reference:'} <span className="text-primary-600 font-bold">{header.quotationNo}</span></p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleSubmit('draft')}
                        className="px-6 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                    >
                        Save Draft
                    </button>
                    <button
                        onClick={() => handleSubmit('final')}
                        className="px-8 py-3.5 bg-primary-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-600/20 active:scale-95 flex items-center gap-2"
                    >
                        <MdCheckCircle size={18} />
                        Finalize & Issue
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left Side: Form Content (8 cols) */}
                <div className="xl:col-span-8 space-y-8">

                    {/* 1. Quotation Header Section */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                                <MdBadge size={20} />
                            </div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">General Information</h2>
                        </div>
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Selection</label>
                                <div className="relative">
                                    <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <select
                                        name="customerId"
                                        value={header.customerId}
                                        onChange={handleHeaderChange}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                    >
                                        <option value="">Search Company Name...</option>
                                        {customers.map(c => (
                                            <option key={c._id} value={c._id}>{c.companyName} ({c.gstin})</option>
                                        ))}
                                    </select>
                                </div>
                                {selectedCustomer && (
                                    <div className="mt-4 p-4 rounded-2xl bg-primary-50/50 border border-primary-100/50">
                                        <p className="text-xs text-primary-800 font-bold mb-1">{selectedCustomer.customerName}</p>
                                        <p className="text-[10px] text-primary-600/80 leading-relaxed uppercase font-black tracking-tighter">
                                            {selectedCustomer.billingAddress.line1}, {selectedCustomer.billingAddress.city}, {selectedCustomer.billingAddress.state}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quotation Date</label>
                                        <input type="date" value={header.quotationDate} disabled className="w-full px-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-400 cursor-not-allowed" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valid Until</label>
                                        <div className="relative">
                                            <MdEventAvailable className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                            <input
                                                type="date"
                                                name="validTill"
                                                value={header.validTill}
                                                onChange={handleHeaderChange}
                                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-xs font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sales Representative</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <select
                                                    name="salespersonName"
                                                    value={header.salespersonName}
                                                    onChange={handleHeaderChange}
                                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold appearance-none bg-white"
                                                >
                                                    <option value="">Select Salesperson</option>
                                                    {salespersons.map(s => (
                                                        <option key={s._id} value={s.name}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsSalespersonModalOpen(true)}
                                                className="p-3.5 bg-primary-50 text-primary-600 rounded-2xl border border-primary-100 hover:bg-primary-100 transition-all"
                                            >
                                                <MdAdd size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Terms</label>
                                        <select
                                            name="paymentTerms"
                                            value={header.paymentTerms}
                                            onChange={handleHeaderChange}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold appearance-none bg-white font-mono"
                                        >
                                            <option value="Advanced">100% Advanced</option>
                                            <option value="15 Days Credit">15 Days Credit</option>
                                            <option value="30 Days Credit">30 Days Credit</option>
                                            <option value="Against Delivery">Against Delivery</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Site/Project Selection</label>
                                        <div className="flex gap-2">
                                            <select
                                                name="siteId"
                                                value={header.siteId}
                                                onChange={handleHeaderChange}
                                                className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold appearance-none bg-white"
                                            >
                                                <option value="">Select Site (Optional)</option>
                                                {sites.map(s => (
                                                    <option key={s._id} value={s._id}>{s.siteName}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setIsSiteModalOpen(true)}
                                                className="p-3.5 bg-primary-50 text-primary-600 rounded-2xl border border-primary-100 hover:bg-primary-100 transition-all"
                                            >
                                                <MdAdd size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Product Line Items */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                                    <MdInventory2 size={20} />
                                </div>
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Inventory Assignment</h2>
                            </div>
                            <button
                                onClick={() => setIsProductModalOpen(true)}
                                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-primary-600/20 active:scale-95"
                            >
                                <MdAdd size={18} /> Add Product
                            </button>
                        </div>

                        <div className="p-0 overflow-x-auto">
                            <table className="w-full table-fixed min-w-[800px]">
                                <thead className="bg-slate-50/50 text-slate-400 text-[9px] uppercase font-black tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="w-12 px-6 py-4">#</th>
                                        <th className="w-20 px-4 py-4">Image</th>
                                        <th className="px-4 py-4">Description</th>
                                        <th className="w-40 px-4 py-4">Site/Group</th>
                                        <th className="w-24 px-4 py-4 text-center">Qty</th>
                                        <th className="w-32 px-4 py-4 text-right">Base Rate</th>
                                        <th className="w-24 px-4 py-4 text-center">Disc%</th>
                                        <th className="w-32 px-6 py-4 text-right">Line Total</th>
                                        <th className="w-16 px-4 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="py-20 text-center">
                                                <div className="flex flex-col items-center opacity-20">
                                                    <MdInventory2 size={48} />
                                                    <p className="mt-4 font-black uppercase text-xs tracking-[0.2em]">Zero Product Lines</p>
                                                    <p className="text-[10px] font-bold">Add products from your master catalog to begin</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item, index) => (
                                            <tr key={index} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 text-[10px] font-black text-slate-300">{index + 1}</td>
                                                <td className="px-4 py-4">
                                                    <div className="h-10 w-10 rounded-lg bg-white border border-slate-100 p-1 flex-shrink-0">
                                                        {item.productImageUrl ? (
                                                            <img src={resolveImageUrl(item.productImageUrl)} alt="" className="h-full w-full object-contain" />
                                                        ) : (
                                                            <div className="h-full w-full flex items-center justify-center text-slate-200"><MdInventory2 size={16} /></div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="font-bold text-slate-900 text-sm truncate">{item.productName}</div>
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Code: {item.productCode} | HSN: {item.hsnCode}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <select
                                                        value={item.siteId}
                                                        onChange={(e) => updateItem(index, 'siteId', e.target.value)}
                                                        className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-primary-500/10"
                                                    >
                                                        <option value="">No Site</option>
                                                        {sites.map(s => (
                                                            <option key={s._id} value={s._id}>{s.siteName}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                        className="w-full text-center py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        value={item.rate}
                                                        onChange={(e) => updateItem(index, 'rate', e.target.value)}
                                                        className="w-full text-right px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        value={item.discountPercent}
                                                        onChange={(e) => updateItem(index, 'discountPercent', e.target.value)}
                                                        className="w-full text-center py-2 bg-primary-50 border border-primary-100 rounded-lg text-sm font-black text-primary-700 outline-none focus:ring-2 focus:ring-primary-500/10"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="font-black text-slate-900 text-sm">₹{item.lineTotal.toLocaleString()}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 italic">Incl {item.gstPercentage}% Tax</div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <button
                                                        onClick={() => removeItem(index)}
                                                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    >
                                                        <MdDelete size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. T&C Engine */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                                <MdGavel size={20} />
                            </div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Policy Framework (T&C)</h2>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="w-full md:w-1/2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Template</label>
                                <select
                                    value={selectedTermsTemplateId}
                                    onChange={handleTermsTemplateChange}
                                    className="w-full mt-2 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                >
                                    <option value="">Blank / Manual Entry</option>
                                    {termsTemplates.map(t => (
                                        <option key={t._id} value={t._id}>{t.templateName}</option>
                                    ))}
                                </select>
                            </div>
                            <textarea
                                value={termsContent}
                                onChange={(e) => setTermsContent(e.target.value)}
                                placeholder="Final terms that will appear on the PDF..."
                                className="w-full min-h-[200px] p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-sm text-slate-600 font-medium focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Side: Calculation & Meta (4 cols) */}
                <div className="xl:col-span-4 h-fit sticky top-24 space-y-6">
                    <div className="bg-slate-900 text-white rounded-[2.5rem] shadow-2xl p-8 border border-slate-800">
                        <h3 className="text-lg font-black tracking-tight mb-8 flex items-center justify-between border-b border-white/10 pb-4">
                            Financial Audit
                            <span className="text-[10px] font-black uppercase text-slate-500 bg-white/5 px-3 py-1 rounded-full">Pro-forma</span>
                        </h3>

                        <div className="space-y-5">
                            <div className="flex justify-between items-center group">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest group-hover:text-primary-400 transition-colors">Subtotal (Excl. Tax)</span>
                                <span className="font-mono text-sm">₹{totals.subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest group-hover:text-rose-400 transition-colors">Total Item Discounts</span>
                                <span className="font-mono text-sm text-rose-400">-₹{totals.itemDiscount.toLocaleString()}</span>
                            </div>

                            <div className="pt-5 border-t border-white/5 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Additional Quotation Discount</label>
                                    <div className="relative">
                                        <MdTrendingDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                                        <input
                                            type="number"
                                            value={overallDiscount}
                                            onChange={(e) => setOverallDiscount(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-sm font-bold text-primary-400"
                                            placeholder="Fixed Amount"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-5 border-t border-white/5 space-y-4">
                                <div className="flex justify-between items-center group">
                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-widest group-hover:text-primary-400 transition-colors">Total GST Liability</span>
                                    <span className="font-mono text-sm text-primary-400">₹{totals.gst.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center italic">
                                    <span className="text-[10px] text-slate-500 font-black uppercase">Auto Round Off</span>
                                    <span className="text-[10px] text-slate-500">{totals.roundOff}</span>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-white/10 flex flex-col items-end gap-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Net Payable Amount</span>
                                <div className="text-5xl font-black text-white tracking-tighter flex items-start">
                                    <span className="text-xl text-primary-500 mt-2 mr-1">₹</span>
                                    {totals.grandTotal.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 p-5 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-400">
                                    <MdPayments size={18} />
                                </div>
                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tax Logic</div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-300">CGST (9%) + SGST (9%)</span>
                                <span className="text-[10px] font-black text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded uppercase">Statewide</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product Selector Modal */}
            <Modal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                title="Inventory Lookup"
                maxWidth="max-w-2xl"
            >
                <div className="space-y-6">
                    <div className="relative">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                        <input
                            type="text"
                            autoFocus
                            placeholder="Enter Code or Name..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-base font-bold transition-all shadow-inner"
                        />
                    </div>

                    <div className="max-h-[450px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {filteredProducts.map(p => (
                            <div
                                key={p._id}
                                onClick={() => addProductToQuotation(p)}
                                className="flex items-center gap-4 p-4 rounded-[1.5rem] border border-slate-100 hover:border-primary-200 hover:bg-primary-50/30 cursor-pointer transition-all active:scale-[0.98] group"
                            >
                                <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 p-1 flex-shrink-0">
                                    {p.productImageUrl ? (
                                        <img src={resolveImageUrl(p.productImageUrl)} alt="" className="h-full w-full object-contain" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-slate-200"><MdInventory2 size={24} /></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-900 group-hover:text-primary-700 transition-colors truncate">{p.productName}</h4>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.productCode}</span>
                                        <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                                        <span className="text-[10px] font-black text-primary-600 bg-primary-50 px-2 py-0.5 rounded uppercase">INR {p.basePrice.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-slate-50 text-slate-300 group-hover:bg-primary-600 group-hover:text-white flex items-center justify-center transition-all">
                                    <MdAdd size={24} />
                                </div>
                            </div>
                        ))}
                        {filteredProducts.length === 0 && (
                            <div className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No matching products found</div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Salesperson Modal */}
            <Modal
                isOpen={isSalespersonModalOpen}
                onClose={() => setIsSalespersonModalOpen(false)}
                title="Register New Salesperson"
                maxWidth="max-w-md"
            >
                <form onSubmit={handleAddSalesperson} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                        <div className="relative">
                            <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                required
                                value={newSalesperson.name}
                                onChange={(e) => setNewSalesperson({ ...newSalesperson, name: e.target.value })}
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                placeholder="Enter representative name"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email ID</label>
                        <div className="relative">
                            <MdEmail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="email"
                                value={newSalesperson.email}
                                onChange={(e) => setNewSalesperson({ ...newSalesperson, email: e.target.value })}
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                placeholder="name@company.com"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                        <div className="relative">
                            <MdPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                value={newSalesperson.mobile}
                                onChange={(e) => setNewSalesperson({ ...newSalesperson, mobile: e.target.value })}
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                placeholder="+91"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-primary-600/20 active:scale-95"
                    >
                        Enroll Salesperson
                    </button>
                </form>
            </Modal>

            {/* Site Modal */}
            <Modal
                isOpen={isSiteModalOpen}
                onClose={() => setIsSiteModalOpen(false)}
                title="Register New Deployment Site"
                maxWidth="max-w-md"
            >
                <form onSubmit={handleAddSite} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Site / Project Name</label>
                        <div className="relative">
                            <MdLocationOn className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                required
                                value={newSite.siteName}
                                onChange={(e) => setNewSite({ ...newSite, siteName: e.target.value })}
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                placeholder="e.g. BAPKEDA LAB BUILDING"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address (Google Maps Autocomplete)</label>
                        <div className="relative">
                            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                ref={addressInputRef}
                                type="text"
                                value={newSite.address}
                                onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                placeholder="Search site address..."
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Person</label>
                            <input
                                type="text"
                                value={newSite.contactPerson}
                                onChange={(e) => setNewSite({ ...newSite, contactPerson: e.target.value })}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile</label>
                            <input
                                type="text"
                                value={newSite.mobile}
                                onChange={(e) => setNewSite({ ...newSite, mobile: e.target.value })}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-primary-600/20 active:scale-95"
                    >
                        Save Site Details
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default CreateQuotation;
