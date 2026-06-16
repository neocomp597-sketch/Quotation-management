import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { MdArrowBack, MdAdd, MdDelete, MdSave, MdCheckCircle, MdPerson, MdInventory2, MdGavel, MdSearch, MdClose, MdPayments, MdEventAvailable, MdBadge, MdTrendingDown, MdEmail, MdPhone, MdLocationOn, MdExpandMore, MdCloudDone, MdCloudOff, MdWifiOff, MdWarning } from 'react-icons/md';
import { toast } from 'react-toastify';
import { customerService, productService, quotationService, termsService, salespersonService, siteService } from '../services/api';
import { calculateLineItem, resolveImageUrl, getPlaceholderImage } from '../utils/helpers';
import Modal from '../components/Modal';
import { clearQuotationDraft, setAutosaveStatus, setQuotationDraft } from '../store/quotationDraftSlice';

// Skeleton loader for product rows
const SkeletonRow = () => (
    <tr className="animate-pulse">
        <td className="px-6 py-4"><div className="h-3 w-6 bg-slate-200 rounded" /></td>
        <td className="px-4 py-4"><div className="h-10 w-10 bg-slate-200 rounded-lg" /></td>
        <td className="px-4 py-4"><div className="space-y-2"><div className="h-3 w-32 bg-slate-200 rounded" /><div className="h-2 w-24 bg-slate-100 rounded" /></div></td>
        <td className="px-4 py-4"><div className="h-6 w-full bg-slate-200 rounded" /></td>
        <td className="px-4 py-4"><div className="h-6 w-full bg-slate-200 rounded" /></td>
        <td className="px-4 py-4"><div className="h-6 w-12 bg-slate-200 rounded mx-auto" /></td>
        <td className="px-4 py-4"><div className="h-6 w-16 bg-slate-200 rounded ml-auto" /></td>
        <td className="px-4 py-4"><div className="h-6 w-10 bg-slate-200 rounded mx-auto" /></td>
        <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-200 rounded ml-auto" /></td>
        <td className="px-4 py-4"><div className="h-6 w-6 bg-slate-200 rounded mx-auto" /></td>
    </tr>
);

// Offline save queue utility
const OFFLINE_QUEUE_KEY = 'quotation-offline-queue';
const getOfflineQueue = () => {
    try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); } catch { return []; }
};
const addToOfflineQueue = (payload) => {
    const queue = getOfflineQueue();
    queue.push({ ...payload, queuedAt: new Date().toISOString() });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};
const clearOfflineQueue = () => localStorage.removeItem(OFFLINE_QUEUE_KEY);

const createClientRequestId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};


// Searchable Customer Dropdown Component
const LIST_PAGE_SIZE = 20;

const unwrapList = (payload) => Array.isArray(payload) ? payload : payload?.data || [];

const CustomerSearchDropdown = ({ customers, selectedCustomerId, onSelect, onSearch, isLoading }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [logoErrors, setLogoErrors] = useState({});
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    const selectedCustomer = customers.find(c => c._id === selectedCustomerId);

    useEffect(() => {
        if (!onSearch || !isOpen) return undefined;

        const timer = setTimeout(() => {
            onSearch(searchTerm.trim());
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm, isOpen, onSearch]);

    const filteredCustomers = customers;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (customer) => {
        onSelect(customer._id);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onSelect('');
        setSearchTerm('');
    };

    return (
        <div ref={dropdownRef} className="relative">
            {/* Selected Value Display / Trigger */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full pl-14 pr-10 py-3.5 bg-slate-50 border rounded-2xl cursor-pointer transition-all flex items-center relative ${isOpen ? 'border-primary-500 ring-4 ring-primary-500/10' : 'border-slate-200 hover:border-slate-300'
                    }`}
            >
                {selectedCustomer ? (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-white border border-slate-100 p-0.5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {selectedCustomer.logoUrl && !logoErrors[selectedCustomer._id] ? (
                            <img 
                                src={resolveImageUrl(selectedCustomer.logoUrl)} 
                                alt="" 
                                className="h-full w-full object-contain" 
                                onError={() => setLogoErrors(prev => ({ ...prev, [selectedCustomer._id]: true }))}
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-primary-600 font-bold text-xs bg-primary-50 rounded-lg uppercase">
                                {selectedCustomer.companyName?.substring(0, 1)}
                            </div>
                        )}
                    </div>
                ) : (
                    <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                )}
                <span className={`text-sm font-bold truncate flex-1 ${selectedCustomer ? 'text-slate-900' : 'text-slate-400'}`}>
                    {selectedCustomer ? `${selectedCustomer.companyName} (${selectedCustomer.gstin})` : 'Search & Select Customer...'}
                </span>
                {selectedCustomer ? (
                    <button
                        onClick={handleClear}
                        className="absolute right-10 text-slate-400 hover:text-rose-500 transition-colors p-1"
                    >
                        <MdClose size={16} />
                    </button>
                ) : null}
                <MdExpandMore className={`absolute right-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={20} />
            </div>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Search Input */}
                    <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Type to search by name, GSTIN, mobile..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="max-h-64 overflow-y-auto relative">
                        {isLoading && (
                            <div className="absolute top-0 left-0 w-full h-1 bg-primary-100 overflow-hidden z-20">
                                <div 
                                    className="h-full bg-primary-500 rounded animate-pulse" 
                                    style={{
                                        width: '50%',
                                        animation: 'pulse 1.5s infinite ease-in-out'
                                    }} 
                                />
                            </div>
                        )}

                        {filteredCustomers.length > 0 ? (
                            filteredCustomers.map(customer => (
                                <div
                                    key={customer._id}
                                    onClick={() => handleSelect(customer)}
                                    className={`px-4 py-3 cursor-pointer transition-all hover:bg-primary-50 border-b border-slate-50 last:border-b-0 flex items-center gap-3 ${selectedCustomerId === customer._id ? 'bg-primary-50' : ''
                                        }`}
                                >
                                    <div className="h-10 w-10 rounded-lg bg-white border border-slate-100 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                        {customer.logoUrl && !logoErrors[customer._id] ? (
                                            <img 
                                                src={resolveImageUrl(customer.logoUrl)} 
                                                alt="" 
                                                className="h-full w-full object-contain" 
                                                onError={() => setLogoErrors(prev => ({ ...prev, [customer._id]: true }))}
                                            />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-primary-600 font-bold text-sm bg-primary-50 rounded-lg uppercase">
                                                {customer.companyName?.substring(0, 1)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 text-sm truncate">{customer.companyName}</div>
                                        <div className="text-[10px] text-slate-500 font-medium truncate">
                                            {customer.customerName} • {customer.gstin}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : isLoading ? (
                            <div className="p-6 text-center text-slate-400 text-xs font-black uppercase tracking-widest animate-pulse">
                                Searching customers...
                            </div>
                        ) : (
                            <div className="p-6 text-center text-slate-400 text-sm font-medium">
                                No customers found matching "{searchTerm}"
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const sortVendors = (vendors = []) => {
    return [...vendors].sort((a, b) => {
        const aStock = Number(a.stock || 0);
        const bStock = Number(b.stock || 0);

        if (aStock > 0 && bStock === 0) return -1;
        if (aStock === 0 && bStock > 0) return 1;
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return Number(a.price || 0) - Number(b.price || 0);
    });
};

const getBestVendor = (vendors = []) => {
    const activeVendors = (vendors || []).filter(v => v.vendorId?.isActive !== false);
    if (!activeVendors.length) return null;

    const primary = activeVendors.find(v => v.isPrimary && Number(v.stock) > 0);
    if (primary) return primary;

    const inStock = activeVendors
        .filter(v => Number(v.stock) > 0)
        .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (inStock.length) return inStock[0];

    return sortVendors(activeVendors)[0] || null;
};

const CreateQuotation = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;
    const dispatch = useDispatch();
    const autosaveStatus = useSelector((state) => state.quotationDraft.autosaveStatus);
    const lastSavedAt = useSelector((state) => state.quotationDraft.lastSavedAt);
    const draftKey = isEditMode ? `edit-${id}` : 'new';
    const localDraftKey = `quotation-draft:${draftKey}`;
    const submitLockRef = useRef(false);
    const clientRequestIdRef = useRef(createClientRequestId());

    // Master Data
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [isCustomerSearchLoading, setIsCustomerSearchLoading] = useState(false);
    const [termsTemplates, setTermsTemplates] = useState([]);
    const [salespersons, setSalespersons] = useState([]);
    const [sites, setSites] = useState([]);

    // UI State
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [, setLoading] = useState(false);
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
        paymentTerms: '15 Days Credit',
        irnNo: '',
        ackNo: '',
        ackDate: ''
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
    const [draftRestored, setDraftRestored] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState(null);

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
                    customerService.getAll({ page: 1, limit: LIST_PAGE_SIZE }),
                    productService.getAll({ page: 1, limit: LIST_PAGE_SIZE }),
                    termsService.getAll(),
                    salespersonService.getAll()
                ]);
                setCustomers(unwrapList(custRes.data));
                setProducts(unwrapList(prodRes.data));
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

    const searchCustomers = async (query = '') => {
        setIsCustomerSearchLoading(true);
        try {
            const res = await customerService.getAll({
                page: 1,
                limit: LIST_PAGE_SIZE,
                search: query || undefined
            });
            setCustomers(unwrapList(res.data));
        } catch (err) {
            console.error('Error searching customers:', err);
        } finally {
            setIsCustomerSearchLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                const res = await productService.getAll({
                    page: 1,
                    limit: LIST_PAGE_SIZE,
                    search: productSearch.trim() || undefined
                });
                setProducts(unwrapList(res.data));
            } catch (err) {
                console.error('Error searching products:', err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [productSearch]);

    // Fetch quotation details if in edit mode
    useEffect(() => {
        if (id) {
            const fetchQuotation = async () => {
                setLoading(true);
                try {
                    const res = await quotationService.getById(id);
                    const q = res.data;
                    if (q.customerId && typeof q.customerId === 'object') {
                        setCustomers(prev => (
                            prev.some(c => c._id === q.customerId._id)
                                ? prev
                                : [q.customerId, ...prev]
                        ));
                    }

                    setHeader({
                        quotationNo: q.quotationNo,
                        quotationDate: new Date(q.quotationDate).toISOString().split('T')[0],
                        validTill: new Date(q.validTill).toISOString().split('T')[0],
                        customerId: q.customerId._id || q.customerId, // Handle populated or raw ID
                        salespersonName: q.salespersonName || '',
                        siteId: q.siteId?._id || q.siteId || '',
                        paymentTerms: q.paymentTerms || '15 Days Credit',
                        irnNo: q.irnNo || '',
                        ackNo: q.ackNo || '',
                        ackDate: q.ackDate ? new Date(q.ackDate).toISOString().split('T')[0] : ''
                    });

                    const mappedItems = q.items.map(item => ({
                        productId: item.productId._id || item.productId,
                        productName: item.productSnapshot?.productName || '',
                        productCode: item.productSnapshot?.productCode || '',
                        productImageUrl: item.productSnapshot?.productImageUrl || '',
                        hsnCode: item.productSnapshot?.hsnCode || '',
                        uom: item.productSnapshot?.uom || '',
                        gstPercentage: item.productSnapshot?.gstPercentage || 18,
                        quantity: item.quantity,
                        rate: item.unitPrice || item.rate,
                        unitPrice: item.unitPrice || item.rate,
                        discountPercent: item.discountPercent,
                        siteId: item.siteId?._id || item.siteId || '',
                        vendorId: item.vendorId?._id || item.vendorId || '',
                        vendorName: item.vendorName || item.vendorId?.name || '',
                        vendorPrice: item.vendorPrice || item.unitPrice || item.rate,
                        vendorStockAtSelection: item.vendorStockAtSelection ?? 0,
                        isVendorAutoSelected: item.isVendorAutoSelected !== false,
                        vendorOptions: [],
                        ...calculateLineItem(item.quantity, item.unitPrice || item.rate, item.discountPercent, item.productSnapshot?.gstPercentage || 18)
                    }));

                    const enrichedItems = await Promise.all(mappedItems.map(async (item) => {
                        try {
                            const productRes = await productService.getById(item.productId);
                            const productWithVendors = productRes.data;
                            const sortedVendorOptions = sortVendors(productWithVendors.vendors || []);

                            let selectedVendor = sortedVendorOptions.find(v => String(v.vendorId?._id || v.vendorId) === String(item.vendorId));
                            if (!selectedVendor) selectedVendor = getBestVendor(sortedVendorOptions);

                            return {
                                ...item,
                                vendorOptions: sortedVendorOptions,
                                vendorId: selectedVendor ? (selectedVendor.vendorId?._id || selectedVendor.vendorId) : item.vendorId,
                                vendorName: selectedVendor?.vendorId?.name || item.vendorName,
                                vendorStockAtSelection: item.vendorStockAtSelection ?? selectedVendor?.stock ?? 0
                            };
                        } catch {
                            return item;
                        }
                    }));

                    setItems(enrichedItems);

                    setSelectedTermsTemplateId(q.termsTemplateId?._id || q.termsTemplateId || '');
                    setTermsContent(q.customTerms || '');
                    const totalItemDiscount = q.items.reduce((sum, i) => sum + (i.discountAmount || 0), 0);
                    setOverallDiscount(Math.max(0, (q.totalDiscount || 0) - totalItemDiscount));

                } catch (err) {
                    console.error("Error fetching quotation:", err);
                    toast.error('Failed to load quotation for editing');
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

    // Check for duplicate customer
    useEffect(() => {
        if (selectedCustomer) {
            const checkDuplicate = async () => {
                try {
                    const res = await customerService.checkDuplicate({
                        gstin: selectedCustomer.gstin,
                        mobile: selectedCustomer.mobile,
                        email: selectedCustomer.email,
                        excludeId: selectedCustomer._id
                    });
                    if (res.data?.isDuplicate) {
                        setDuplicateWarning(res.data.duplicate);
                    } else {
                        setDuplicateWarning(null);
                    }
                } catch (err) {
                    console.error("Duplicate check failed:", err);
                    setDuplicateWarning(null);
                }
            };
            checkDuplicate();
        } else {
            setDuplicateWarning(null);
        }
    }, [selectedCustomer]);

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

    const draftPayload = useMemo(() => ({
        header,
        items,
        termsContent,
        selectedTermsTemplateId,
        overallDiscount,
        savedAt: new Date().toISOString()
    }), [header, items, termsContent, selectedTermsTemplateId, overallDiscount]);

    const hasMeaningfulDraft = useMemo(() => (
        header.customerId ||
        header.salespersonName ||
        header.siteId ||
        items.length > 0 ||
        termsContent?.trim() ||
        Number(overallDiscount || 0) > 0
    ), [header, items, termsContent, overallDiscount]);

    useEffect(() => {
        if (draftRestored || isEditMode) return;

        const restoreDraft = async () => {
            try {
                const rawLocalDraft = localStorage.getItem(localDraftKey);
                let draft = rawLocalDraft ? JSON.parse(rawLocalDraft) : null;

                if (!draft) {
                    const res = await quotationService.getDraft(draftKey);
                    draft = res.data?.payload || null;
                }

                if (draft?.header) {
                    setHeader(prev => ({ ...prev, ...draft.header, quotationNo: 'AUTO-GEN' }));
                    setItems(Array.isArray(draft.items) ? draft.items : []);
                    setTermsContent(draft.termsContent || '');
                    setSelectedTermsTemplateId(draft.selectedTermsTemplateId || '');
                    setOverallDiscount(draft.overallDiscount || 0);
                    dispatch(setQuotationDraft(draft));
                    toast.info('Restored your unfinished quotation draft');
                    console.info(`[Observability] Draft restored from ${rawLocalDraft ? 'local' : 'backend'} storage`);
                }
            } catch (error) {
                console.error('Draft restore failed:', error);
            } finally {
                setDraftRestored(true);
            }
        };

        restoreDraft();
    }, [dispatch, draftKey, draftRestored, isEditMode, localDraftKey]);

    useEffect(() => {
        if (!draftRestored || isEditMode || !hasMeaningfulDraft) return;

        dispatch(setAutosaveStatus('saving'));
        const timer = setTimeout(() => {
            localStorage.setItem(localDraftKey, JSON.stringify(draftPayload));
            dispatch(setQuotationDraft(draftPayload));
            dispatch(setAutosaveStatus('saved'));
        }, 1000);

        return () => clearTimeout(timer);
    }, [dispatch, draftPayload, draftRestored, hasMeaningfulDraft, isEditMode, localDraftKey]);

    useEffect(() => {
        if (!draftRestored || isEditMode || !hasMeaningfulDraft) return;

        const timer = setTimeout(async () => {
            try {
                dispatch(setAutosaveStatus('saving'));
                await quotationService.autosaveDraft(draftKey, draftPayload);
                dispatch(setAutosaveStatus('saved'));
            } catch (error) {
                console.error('Backend draft autosave failed:', error);
                dispatch(setAutosaveStatus('error'));
            }
        }, 15000);

        return () => clearTimeout(timer);
    }, [dispatch, draftKey, draftPayload, draftRestored, hasMeaningfulDraft, isEditMode]);

    // Handlers
    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        setHeader(prev => ({ ...prev, [name]: value }));
    };

    const addProductToQuotation = async (product) => {
        const existing = items.find(i => i.productId === product._id);
        if (existing) {
            toast.warning('Product already in list. Adjust quantity there.');
            return;
        }

        let productWithVendors = product;
        try {
            const productRes = await productService.getById(product._id);
            productWithVendors = productRes.data;
        } catch {
            // Fallback to list item data if detail fetch fails
        }

        const vendorOptions = sortVendors(productWithVendors.vendors || []);
        const bestVendor = getBestVendor(vendorOptions);
        const selectedPrice = Number(bestVendor?.price ?? productWithVendors.basePrice ?? product.basePrice ?? 0);

        if (!(selectedPrice > 0)) {
            toast.error('No valid price available for selected product');
            return;
        }

        if (!bestVendor && vendorOptions.length) {
            toast.warning('All active vendors are unavailable for this product');
        }

        const calcs = calculateLineItem(1, selectedPrice, 0, productWithVendors.gstPercentage || product.gstPercentage);
        const newItem = {
            productId: productWithVendors._id || product._id,
            productName: productWithVendors.productName || product.productName,
            productCode: productWithVendors.productCode || product.productCode,
            productImageUrl: productWithVendors.productImageUrl || product.productImageUrl,
            hsnCode: productWithVendors.hsnCode || product.hsnCode,
            uom: productWithVendors.uom || product.uom,
            gstPercentage: productWithVendors.gstPercentage || product.gstPercentage,
            quantity: 1,
            unitPrice: selectedPrice,
            rate: selectedPrice,
            discountPercent: 0,
            siteId: header.siteId || '',
            vendorId: bestVendor ? (bestVendor.vendorId?._id || bestVendor.vendorId) : '',
            vendorName: bestVendor?.vendorId?.name || '',
            vendorPrice: selectedPrice,
            vendorStockAtSelection: Number(bestVendor?.stock || 0),
            isVendorAutoSelected: true,
            vendorOptions,
            ...calcs
        };

        setItems([...items, newItem]);
        setIsProductModalOpen(false);
    };

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };
        if (field === 'rate') {
            item.unitPrice = Number(value);
        }

        const calcs = calculateLineItem(
            Number(item.quantity),
            Number(item.rate),
            Number(item.discountPercent),
            Number(item.gstPercentage)
        );

        newItems[index] = { ...item, ...calcs };
        setItems(newItems);
    };

    const handleVendorChange = (index, vendorId) => {
        const nextItems = [...items];
        const item = { ...nextItems[index] };
        const options = item.vendorOptions || [];
        const selectedVendor = options.find(v => String(v.vendorId?._id || v.vendorId) === String(vendorId));

        if (!selectedVendor) {
            item.vendorId = '';
            item.vendorName = '';
            item.vendorPrice = item.rate;
            item.vendorStockAtSelection = 0;
            item.isVendorAutoSelected = false;
            nextItems[index] = item;
            setItems(nextItems);
            return;
        }

        const nextRate = Number(selectedVendor.price || 0);
        const calcs = calculateLineItem(
            Number(item.quantity),
            nextRate,
            Number(item.discountPercent),
            Number(item.gstPercentage)
        );

        nextItems[index] = {
            ...item,
            vendorId: selectedVendor.vendorId?._id || selectedVendor.vendorId,
            vendorName: selectedVendor.vendorId?.name || item.vendorName,
            vendorPrice: nextRate,
            vendorStockAtSelection: Number(selectedVendor.stock || 0),
            isVendorAutoSelected: false,
            unitPrice: nextRate,
            rate: nextRate,
            ...calcs
        };
        setItems(nextItems);
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

        if (!newSalesperson.name?.trim()) {
            toast.error('Salesperson name is required');
            return;
        }

        try {
            const res = await salespersonService.create(newSalesperson);
            setSalespersons(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
            setHeader(prev => ({ ...prev, salespersonName: res.data.name }));
            setIsSalespersonModalOpen(false);
            setNewSalesperson({ name: '', email: '', mobile: '' });
            toast.success('Salesperson added successfully!');
        } catch (err) {
            console.error("Error creating salesperson:", err);
            toast.error('Failed to create salesperson');
        }
    };

    const handleAddSite = async (e) => {
        e.preventDefault();
        if (!header.customerId) {
            toast.error('Select a customer first');
            return;
        }
        if (!newSite.siteName?.trim()) {
            toast.error('Site name is required');
            return;
        }
        try {
            const res = await siteService.create({ ...newSite, customerId: header.customerId });
            setSites(prev => [...prev, res.data].sort((a, b) => a.siteName.localeCompare(b.siteName)));
            setHeader(prev => ({ ...prev, siteId: res.data._id }));
            setIsSiteModalOpen(false);
            setNewSite({ siteName: '', location: '', address: '', contactPerson: '', mobile: '' });
            toast.success('Site added successfully!');
        } catch (err) {
            console.error("Error creating site:", err);
            toast.error('Failed to create site');
        }
    };

    // Build minimal save payload — strips vendorOptions to reduce size
    const buildSavePayload = useCallback((status) => {
        const payload = {
            ...header,
            items: items.map(item => {
                const bestVendor = !item.vendorId ? getBestVendor(item.vendorOptions || []) : null;
                const selectedVendorId = item.vendorId || (bestVendor ? (bestVendor.vendorId?._id || bestVendor.vendorId) : undefined);
                const selectedVendorName = item.vendorName || bestVendor?.vendorId?.name || '';
                const selectedVendorPrice = item.vendorPrice || bestVendor?.price || item.rate;
                const selectedVendorStock = item.vendorStockAtSelection ?? bestVendor?.stock ?? 0;

                return {
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
                    unitPrice: item.unitPrice || item.rate,
                    rate: item.rate,
                    discountPercent: item.discountPercent,
                    discountAmount: item.discountAmount,
                    taxableAmount: item.taxableAmount,
                    gstAmount: item.gstAmount,
                    lineTotal: item.lineTotal,
                    vendorId: selectedVendorId,
                    vendorName: selectedVendorName,
                    vendorPrice: selectedVendorPrice,
                    vendorStockAtSelection: selectedVendorStock,
                    isVendorAutoSelected: item.vendorId ? item.isVendorAutoSelected !== false : true
                    // NOTE: vendorOptions intentionally excluded to reduce payload
                };
            }),
            termsTemplateId: selectedTermsTemplateId,
            customTerms: termsContent,
            totalDiscount: totals.itemDiscount + Number(overallDiscount),
            status
        };

        if (!isEditMode) {
            payload.clientRequestId = clientRequestIdRef.current;
        }

        return payload;
    }, [header, items, selectedTermsTemplateId, termsContent, totals, overallDiscount, isEditMode]);

    const handleSubmit = async (status) => {
        if (submitLockRef.current) return;

        if (!header.customerId) {
            toast.error('Please select a Customer');
            return;
        }
        if (items.length === 0) {
            toast.error('Please add at least one product');
            return;
        }

        submitLockRef.current = true;
        setIsSaving(true);
        setSaveSuccess(false);

        const quotationData = buildSavePayload(status);
        const startTime = performance.now();

        try {
            if (isEditMode) {
                await quotationService.update(id, quotationData);
                setSaveSuccess(true);
                toast.success('Quotation updated successfully!');
            } else {
                await quotationService.create(quotationData);
                // Clean up drafts on success
                localStorage.removeItem(localDraftKey);
                dispatch(clearQuotationDraft());
                await quotationService.deleteDraft(draftKey).catch(() => {});
                clearOfflineQueue();
                setSaveSuccess(true);
                toast.success('Quotation created successfully!');
            }
            const duration = performance.now() - startTime;
            console.info(`[Observability] Quotation save completed in ${duration.toFixed(2)}ms`);

            // Small delay for success animation, then navigate
            setTimeout(() => navigate('/quotations'), 300);
        } catch (err) {
            const duration = performance.now() - startTime;
            console.error(`[Observability] Quotation save failed after ${duration.toFixed(2)}ms`, err);
            console.error(err);

            // Offline / network error detection
            const isNetworkError = !err.response && (err.code === 'ERR_NETWORK' || err.message?.includes('Network'));
            if (isNetworkError && !isEditMode) {
                addToOfflineQueue(quotationData);
                toast.warning(
                    'Network unavailable. Quotation saved locally and will sync when online.',
                    { autoClose: 5000 }
                );
            } else {
                toast.error(err.response?.data?.message || 'Error saving quotation');
            }
        } finally {
            submitLockRef.current = false;
            setIsSaving(false);
        }
    };

    // Retry offline queue when back online
    useEffect(() => {
        const handleOnline = async () => {
            const queue = getOfflineQueue();
            if (queue.length === 0) return;

            for (const payload of queue) {
                try {
                    await quotationService.create(payload);
                    toast.success('Offline quotation synced successfully!');
                } catch (err) {
                    console.error('Failed to sync offline quotation:', err);
                    toast.error('Failed to sync offline quotation. Will retry.');
                    return; // Stop processing — keep remaining in queue
                }
            }
            clearOfflineQueue();
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

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
                        <p className="text-slate-500 font-medium">
                            {isEditMode ? 'Editing Reference:' : 'Drafting Reference:'} <span className="text-primary-600 font-bold">{header.quotationNo}</span>
                            {!isEditMode && hasMeaningfulDraft && (
                                <span className="ml-3 text-[10px] uppercase tracking-widest text-slate-400">
                                    {autosaveStatus === 'saving' ? 'Saving draft...' : lastSavedAt ? 'Draft saved' : ''}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleSubmit('draft')}
                        disabled={isSaving}
                        className="px-6 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? (
                            <div className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        ) : saveSuccess ? (
                            <MdCloudDone size={16} className="text-emerald-500" />
                        ) : null}
                        Save Draft
                    </button>
                    <button
                        onClick={() => handleSubmit('final')}
                        disabled={isSaving}
                        className="px-8 py-3.5 bg-primary-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-600/20 active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : saveSuccess ? (
                            <MdCloudDone size={18} />
                        ) : (
                            <MdCheckCircle size={18} />
                        )}
                        {isSaving ? 'Saving...' : 'Finalize & Issue'}
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
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Selection <span className="text-rose-500">*</span></label>
                                <CustomerSearchDropdown
                                    customers={customers}
                                    selectedCustomerId={header.customerId}
                                    onSelect={(customerId) => setHeader(prev => ({ ...prev, customerId }))}
                                    onSearch={searchCustomers}
                                    isLoading={isCustomerSearchLoading}
                                />
                                {duplicateWarning && (
                                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                                        <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg shrink-0">
                                            <MdWarning size={16} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-amber-900 mb-0.5">Warning: Duplicate Customer Detected</p>
                                            <p className="text-[10px] font-medium text-amber-700 leading-snug">
                                                Another record shares the same GSTIN/Phone/Email ({duplicateWarning.companyName}). Please verify.
                                            </p>
                                        </div>
                                    </div>
                                )}
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

                                {/* Invoice Details */}
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-2">Tax Invoice Details (Optional)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">IRN Number</label>
                                            <input
                                                type="text"
                                                name="irnNo"
                                                value={header.irnNo}
                                                onChange={handleHeaderChange}
                                                placeholder="e.g. 1234567890ABC..."
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Ack Number</label>
                                            <input
                                                type="text"
                                                name="ackNo"
                                                value={header.ackNo}
                                                onChange={handleHeaderChange}
                                                placeholder="e.g. 9876543210"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Ack Date</label>
                                            <input
                                                type="date"
                                                name="ackDate"
                                                value={header.ackDate}
                                                onChange={handleHeaderChange}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                                            />
                                        </div>
                                    </div>
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

                                {/* Invoice Details */}
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-2">Tax Invoice Details (Optional)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">IRN Number</label>
                                            <input
                                                type="text"
                                                name="irnNo"
                                                value={header.irnNo}
                                                onChange={handleHeaderChange}
                                                placeholder="e.g. 1234567890ABC..."
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Ack Number</label>
                                            <input
                                                type="text"
                                                name="ackNo"
                                                value={header.ackNo}
                                                onChange={handleHeaderChange}
                                                placeholder="e.g. 9876543210"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Ack Date</label>
                                            <input
                                                type="date"
                                                name="ackDate"
                                                value={header.ackDate}
                                                onChange={handleHeaderChange}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Product Line Items */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 md:p-6 border-b border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 shrink-0 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                                    <MdInventory2 size={20} />
                                </div>
                                <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-widest leading-tight">Inventory Assignment</h2>
                            </div>
                            <button
                                onClick={() => setIsProductModalOpen(true)}
                                className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-primary-600/20 active:scale-95"
                            >
                                <MdAdd size={18} /> Add Product
                            </button>
                        </div>

                        <div className="p-0 overflow-x-auto">
                            <table className="w-full table-fixed min-w-[1050px]">
                                <thead className="bg-slate-50/50 text-slate-400 text-[9px] uppercase font-black tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="w-12 px-6 py-4">#</th>
                                        <th className="w-20 px-4 py-4">Image</th>
                                        <th className="px-4 py-4">Description</th>
                                        <th className="w-56 px-4 py-4">Vendor</th>
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
                                            <td colSpan="10" className="py-20 text-center">
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
                                                    {item.vendorOptions?.length ? (
                                                        <div className="space-y-1">
                                                            <select
                                                                value={item.vendorId || ''}
                                                                onChange={(e) => handleVendorChange(index, e.target.value)}
                                                                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-primary-500/10"
                                                            >
                                                                <option value="">Auto Select</option>
                                                                {item.vendorOptions
                                                                    .filter(v => v.vendorId?.isActive !== false)
                                                                    .map(v => (
                                                                        <option key={String(v.vendorId?._id || v.vendorId)} value={String(v.vendorId?._id || v.vendorId)}>
                                                                            {v.vendorId?.name} | ₹{Number(v.price || 0).toLocaleString()} | Stk {Number(v.stock || 0)}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] font-bold text-slate-500">
                                                                    {item.vendorName || 'Auto vendor'}
                                                                </span>
                                                                <span className={`text-[9px] font-black uppercase ${Number(item.vendorStockAtSelection || 0) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                                    {Number(item.vendorStockAtSelection || 0) > 0 ? `In Stock (${item.vendorStockAtSelection})` : 'Out of Stock'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-400">No vendor mapping</span>
                                                    )}
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
                                                        inputMode="decimal"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                        className="w-full text-center py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        value={item.rate}
                                                        onChange={(e) => updateItem(index, 'rate', e.target.value)}
                                                        className="w-full text-right px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/10"
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
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
                    <div className="bg-slate-900 text-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl p-6 md:p-8 border border-slate-800 mx-4 md:mx-0">
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
                                            inputMode="decimal"
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
                        {filteredProducts.map(p => {
                            const vendorList = sortVendors(p.vendors || []);
                            const bestVendor = p.bestVendor || getBestVendor(vendorList);
                            const hasStock = vendorList.some(v => Number(v.stock || 0) > 0 && v.vendorId?.isActive !== false);

                            return (
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
                                            <span className="text-[10px] font-black text-primary-600 bg-primary-50 px-2 py-0.5 rounded uppercase">
                                                INR {Number(bestVendor?.price ?? p.basePrice ?? 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] text-slate-500 font-bold">
                                                {bestVendor?.vendorId?.name ? `Best: ${bestVendor.vendorId.name}` : 'No vendor mapped'}
                                            </span>
                                            <span className={`text-[9px] font-black uppercase ${hasStock ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                {hasStock ? 'In Stock' : 'Out of Stock'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 text-slate-300 group-hover:bg-primary-600 group-hover:text-white flex items-center justify-center transition-all">
                                        <MdAdd size={24} />
                                    </div>
                                </div>
                            );
                        })}
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

            {/* Mobile Sticky Totals Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 xl:hidden bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 safe-area-pb">
                <div className="flex items-center justify-between gap-3 max-w-screen-xl mx-auto">
                    <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Grand Total</div>
                        <div className="text-xl font-black text-white tracking-tight flex items-center gap-0.5">
                            <span className="text-xs text-primary-400">₹</span>
                            {totals.grandTotal.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold">
                            {items.length} item{items.length !== 1 ? 's' : ''} • Tax: ₹{totals.gst.toLocaleString()}
                        </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={() => handleSubmit('draft')}
                            disabled={isSaving}
                            className="px-4 py-3 bg-white/10 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-white/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {isSaving ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <MdSave size={14} />}
                            Draft
                        </button>
                        <button
                            onClick={() => handleSubmit('final')}
                            disabled={isSaving}
                            className="px-5 py-3 bg-primary-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/30 disabled:opacity-70 flex items-center gap-1.5"
                        >
                            {isSaving ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <MdCheckCircle size={14} />}
                            Finalize
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default CreateQuotation;
