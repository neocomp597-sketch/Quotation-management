import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdArrowBack, MdAdd, MdDelete, MdCheckCircle, MdPerson, MdSearch, MdBadge, MdExpandMore, MdOutlineDriveFileRenameOutline, MdNumbers, MdClose } from 'react-icons/md';
import { toast } from 'react-toastify';
import { customerService, enquiryService, salespersonService, productService, userService, payrollService } from '../services/api';
import Modal from '../components/Modal';
import PortalDropdown from '../components/PortalDropdown';
import { isValidMobile, isValidGSTIN } from '../utils/validation';
import { buildSalesExecutiveList } from '../utils/helpers';

// Reuse CustomerSearchDropdown with Teal accents
const CustomerSearchDropdown = ({ customers, selectedCustomerId, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    const selectedCustomer = customers.find(c => c._id === selectedCustomerId);

    const filteredCustomers = useMemo(() => {
        if (!searchTerm) return customers;
        const query = searchTerm.toLowerCase();
        return customers.filter(c =>
            c.companyName?.toLowerCase().includes(query) ||
            c.customerName?.toLowerCase().includes(query) ||
            c.gstin?.toLowerCase().includes(query) ||
            c.mobile?.includes(query)
        );
    }, [customers, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus({ preventScroll: true });
        }
    }, [isOpen]);

    const handleSelect = (customer) => {
        onSelect(customer._id);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div ref={dropdownRef} className="relative w-full">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full pl-12 pr-10 py-3.5 bg-slate-50 border rounded-2xl cursor-pointer transition-all flex items-center ${isOpen ? 'border-teal-500 ring-4 ring-teal-500/10' : 'border-slate-200 hover:border-slate-300'}`}
            >
                <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <span className={`text-sm font-bold truncate flex-1 ${selectedCustomer ? 'text-slate-900' : 'text-slate-400'}`}>
                    {selectedCustomer ? `${selectedCustomer.companyName} (${selectedCustomer.gstin || 'No GSTIN'})` : 'Search & Select Customer...'}
                </span>
                <MdExpandMore className={`absolute right-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={20} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Type to search..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none"
                            />
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {filteredCustomers.map(customer => (
                            <div key={customer._id} onClick={() => handleSelect(customer)} className="px-4 py-3 cursor-pointer hover:bg-teal-50 border-b border-slate-50 last:border-b-0">
                                <div className="font-bold text-slate-900 text-sm">{customer.companyName}</div>
                                <div className="text-[10px] text-slate-500">{customer.customerName} • {customer.gstin || 'No GSTIN'}</div>
                            </div>
                        ))}
                        {filteredCustomers.length === 0 && (
                            <div className="px-4 py-3 text-sm text-slate-400 text-center font-medium">No customers found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Product dropdown searching by productCode or productName with Teal accents
const ProductCodeSearchAutocomplete = ({ value, selectedLabel, onChange, products, onSelectProduct, onSelectManualProduct }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const anchorRef = useRef(null);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    const selectedProduct = products.find(product => product.productCode === value || product._id === value);
    const displayValue = selectedLabel || selectedProduct?.productCode || value;

    const filteredProducts = useMemo(() => {
        const query = searchTerm.toLowerCase();
        if (!query) return products;
        return products.filter(p =>
            p.productName?.toLowerCase().includes(query) ||
            p.productCode?.toLowerCase().includes(query)
        );
    }, [products, searchTerm, value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                anchorRef.current && !anchorRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus({ preventScroll: true });
        }
    }, [isOpen]);

    const handleSelect = (product) => {
        onChange(product.productCode || '');
        onSelectProduct(product);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div ref={anchorRef} className="relative w-full">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full min-h-[40px] pl-3 pr-9 py-2 bg-slate-50 border rounded-xl cursor-pointer transition-all flex items-center ${isOpen ? 'border-teal-500 bg-white ring-2 ring-teal-500/10' : 'border-transparent hover:border-slate-200'}`}
            >
                <span className={`text-xs font-bold truncate flex-1 ${value ? 'text-slate-900' : 'text-slate-400'}`}>
                    {displayValue || 'Search Product...'}
                </span>
                <MdExpandMore className={`absolute right-2.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={18} />
            </div>

            <PortalDropdown isOpen={isOpen} anchorRef={anchorRef}>
                <div ref={dropdownRef} className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[320px] w-96">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                        <div className="relative flex-1">
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search code or name..."
                                className="w-full pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                    <MdClose size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                    {onSelectManualProduct && (
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setIsOpen(false);
                                setSearchTerm('');
                                onSelectManualProduct();
                            }}
                            className="w-full px-4 py-2.5 bg-amber-50/80 hover:bg-amber-100 text-amber-900 border-b border-amber-200/80 transition-colors text-left flex items-center gap-2 font-bold text-xs"
                        >
                            <MdAdd size={16} className="text-amber-600" />
                            <span>Enter Details Manually</span>
                        </button>
                    )}
                    <div className="overflow-y-auto max-h-60 divide-y divide-slate-50">
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map(product => (
                                <button
                                    type="button"
                                    key={product._id || product.productCode}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelect(product);
                                    }}
                                    className="w-full px-4 py-2.5 cursor-pointer hover:bg-teal-50 transition-colors text-left"
                                >
                                    <div className="font-bold text-slate-900 text-xs">
                                        {product.productCode}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-semibold truncate">
                                        {product.productName}
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="p-6 text-center text-slate-400 text-xs font-semibold">
                                No products found.
                            </div>
                        )}
                    </div>
                </div>
            </PortalDropdown>
        </div>
    );
};


const createItemRow = (overrides = {}) => {
    const isManualBool = overrides.isManual !== undefined 
        ? Boolean(overrides.isManual) 
        : (overrides.itemCategory ? overrides.itemCategory === 'Manual' : false);
    return {
        productId: '',
        productCode: '',
        productName: '',
        quantity: 1,
        price: 0,
        discountPercent: 0,
        value: 0,
        uom: 'Pcs',
        isManual: isManualBool,
        itemCategory: isManualBool ? 'Manual' : 'Added',
        actionStatus: 'VISIT CUSTOMER',
        salespersonName: '',
        agentName: '',
        vendors: [],
        vendorQuotes: [],
        finalVendor: '',
        ...overrides,
        rowId: overrides.rowId || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`
    };
};

const isBlankRow = (item) => {
    return (!item.productName || item.productName.trim() === '') && (!item.productCode || item.productCode.trim() === '');
};

const generateNextEnquiryNumber = (existingEnquiries = []) => {
    const currentYear = new Date().getFullYear();
    const prefix = `${currentYear}-`;
    
    let maxSeq = 0;
    existingEnquiries.forEach(e => {
        const str = String(e.enquiryNo || '').trim();
        if (str.startsWith(prefix)) {
            const parts = str.split('-');
            if (parts.length >= 2) {
                const seq = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(seq) && seq > maxSeq) {
                    maxSeq = seq;
                }
            }
        }
    });

    const nextSeq = maxSeq + 1;
    const seqStr = String(nextSeq).padStart(2, '0');
    return `${prefix}${seqStr}`;
};

const CreateEnquiry = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [customers, setCustomers] = useState([]);
    const [allVendors, setAllVendors] = useState([]);
    const [products, setProducts] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    // New Customer inline registration state
    const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
    const [isInlineCustomerFormOpen, setIsInlineCustomerFormOpen] = useState(false);
    const [newCustomerForm, setNewCustomerForm] = useState({
        companyName: '',
        customerName: '',
        email: '',
        mobile: '',
        gstin: ''
    });

    const [header, setHeader] = useState({
        enquiryNo: '',
        enquiryDate: new Date().toISOString().split('T')[0],
        customerId: '',
        companyName: '',
        contactPerson: '',
        refReceivedFrom: '',
        followUpDate: '',
        contactDesignation: '',
        contactMobile: '',
        contactEmail: '',
        partners: [],
        siteAddress: '',
        projectName: '',
        requiredDeliveryDate: '',
        priority: 'Medium',
        assignedTo: '',
        budget: '',
        technicalSpecifications: '',
        attachmentName: '',
        status: 'Open',
        probability: 0,
        remarks: '',
        closureReason: '',
        subtotal: 0,
        discount: 0,
        freight: 0,
        otherCharges: 0,
        grandTotal: 0
    });
    
    const [followUpLog, setFollowUpLog] = useState([]);
    const [newFollowUpNote, setNewFollowUpNote] = useState('');
    const [newFollowUpAction, setNewFollowUpAction] = useState('Call');

    const [items, setItems] = useState([createItemRow()]);

    const [vendorModal, setVendorModal] = useState({ isOpen: false, itemIndex: null });

    // Fetch master data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [custRes, prodRes, salesRes, userRes, empRes] = await Promise.allSettled([
                    customerService.getAll(),
                    productService.getAll(),
                    salespersonService.getAll(),
                    userService.getAll({ limit: 1000 }),
                    payrollService.getEmployees({ limit: 1000 })
                ]);
                const valueOf = (r) => r.status === 'fulfilled' ? r.value : null;
                const custData = valueOf(custRes)?.data || [];
                const prodData = valueOf(prodRes)?.data;
                const salesData = valueOf(salesRes)?.data;
                const userData = valueOf(userRes)?.data;
                const empData = valueOf(empRes)?.data;

                const fetchedProducts = Array.isArray(prodData) ? prodData : prodData?.data || [];
                const fetchedSalespersons = Array.isArray(salesData) ? salesData : salesData?.data || [];
                const fetchedUsers = Array.isArray(userData) ? userData : userData?.data || [];
                const fetchedEmployees = Array.isArray(empData) ? empData : empData?.data || [];

                const salesExecutives = buildSalesExecutiveList({ fetchedSalespersons, fetchedUsers, fetchedEmployees });

                setCustomers(custData);
                setProducts(fetchedProducts);
                setUsers(salesExecutives);

                if (id) {
                    setLoading(true);
                    try {
                        const res = await enquiryService.getById(id);
                        const e = res.data;
                        setHeader({
                            enquiryNo: e.enquiryNo,
                            enquiryDate: new Date(e.enquiryDate).toISOString().split('T')[0],
                            customerId: e.customerId?._id || e.customerId,
                            companyName: e.companyName || e.customerId?.companyName || '',
                            contactPerson: e.contactPerson || e.customerId?.customerName || '',
                            refReceivedFrom: e.refReceivedFrom || '',
                            followUpDate: e.followUpDate ? new Date(e.followUpDate).toISOString().split('T')[0] : '',
                            contactDesignation: e.contactDesignation || '',
                            contactMobile: e.contactMobile || e.customerId?.mobile || '',
                            contactEmail: e.contactEmail || e.customerId?.email || '',
                            partners: Array.isArray(e.partners) ? e.partners : [],
                            siteAddress: e.siteAddress || '',
                            projectName: e.projectName || '',
                            requiredDeliveryDate: e.requiredDeliveryDate ? new Date(e.requiredDeliveryDate).toISOString().split('T')[0] : '',
                            priority: e.priority || 'Medium',
                            assignedTo: e.assignedTo?._id || e.assignedTo || '',
                            budget: e.budget || '',
                            technicalSpecifications: e.technicalSpecifications || '',
                            attachmentName: e.attachmentName || '',
                            status: e.status || 'Open',
                            probability: e.probability || 0,
                            remarks: e.remarks || '',
                            closureReason: e.closureReason || '',
                            subtotal: e.subtotal || 0,
                            discount: e.discount || 0,
                            freight: e.freight || 0,
                            otherCharges: e.otherCharges || 0,
                            grandTotal: e.grandTotal || 0
                        });
                        setFollowUpLog(e.followUpHistory || []);
                        
                        const mappedItems = e.items.map(item => {
                            const pId = item.productId?._id || item.productId || '';
                            const matchedProduct = fetchedProducts.find(p => p._id === pId);
                            return createItemRow({
                                ...item,
                                productId: pId,
                                isManual: !pId || Boolean(item.isManual),
                                productCode: item.productCode || item.productId?.productCode || matchedProduct?.productCode || '',
                                productName: item.productName || item.productId?.productName || matchedProduct?.productName || '',
                                quantity: item.quantity || 1,
                                price: item.price || item.rate || matchedProduct?.basePrice || 0,
                                discountPercent: item.discountPercent || 0,
                                value: item.value || 0,
                                uom: item.uom || matchedProduct?.uom || 'Pcs',
                                vendors: item.vendors.map(v => (v && typeof v === 'object') ? v._id : v).filter(Boolean),
                                vendorQuotes: item.vendorQuotes.map(vq => ({
                                    ...vq,
                                    vendorId: (vq.vendorId && typeof vq.vendorId === 'object') ? vq.vendorId._id : vq.vendorId
                                })).filter(vq => vq.vendorId),
                                finalVendor: (item.finalVendor && typeof item.finalVendor === 'object') ? item.finalVendor._id : item.finalVendor || ''
                            });
                        });
                        setItems(mappedItems);
                    } catch (err) {
                        toast.error('Failed to load enquiry');
                        navigate('/enquiries');
                    } finally {
                        setLoading(false);
                    }
                } else {
                    try {
                        const enqRes = await enquiryService.getAll();
                        const nextEnqNo = generateNextEnquiryNumber(enqRes.data || []);
                        setHeader(prev => ({ ...prev, enquiryNo: nextEnqNo }));
                    } catch (enqErr) {
                        console.error("Error generating next enquiry number:", enqErr);
                    }
                }
            } catch (err) {
                console.error("Error fetching data:", err);
            }
        };
        fetchData();
    }, [id, navigate]);

    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        let val = value;
        if (name === 'contactMobile') {
            val = value.replace(/[^\d]/g, '').slice(0, 10);
        } else if (name === 'contactEmail') {
            val = value.toLowerCase().trim();
        }
        setHeader(prev => ({ ...prev, [name]: val }));
    };

    const formatCustomerAddress = (customer) => {
        const address = customer?.billingAddress;
        if (!address) return '';
        return [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ');
    };

    const selectCustomerObject = (customer) => {
        if (!customer) return;
        setHeader(prev => ({
            ...prev,
            customerId: customer._id,
            companyName: customer.companyName || prev.companyName,
            contactPerson: customer.customerName || prev.contactPerson,
            contactMobile: customer.mobile || prev.contactMobile,
            contactEmail: customer.email ? customer.email.toLowerCase().trim() : prev.contactEmail,
            siteAddress: formatCustomerAddress(customer) || prev.siteAddress
        }));
    };

    const handleCustomerSelect = (customerId) => {
        const customer = customers.find(c => c._id === customerId);
        if (customer) {
            selectCustomerObject(customer);
        } else {
            setHeader(prev => ({ ...prev, customerId }));
        }
    };

    const handleCreateCustomer = async (e) => {
        if (e) e.preventDefault();
        const cleanEmail = (newCustomerForm.email || '').toLowerCase().trim();
        const cleanMobile = (newCustomerForm.mobile || '').replace(/[^\d]/g, '').slice(0, 10);
        const cleanGSTIN = (newCustomerForm.gstin || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);

        if (!newCustomerForm.companyName?.trim()) {
            toast.error('Company Name is required');
            return;
        }
        if (!newCustomerForm.customerName?.trim()) {
            toast.error('Contact Name is required');
            return;
        }
        if (cleanMobile && cleanMobile.length !== 10) {
            toast.error('Mobile number must be exactly 10 numeric digits');
            return;
        }
        if (cleanGSTIN && !isValidGSTIN(cleanGSTIN)) {
            toast.error('Invalid GSTIN format (15 characters: 2-digit state code 01-37 + 5 letters + 4 digits + 1 letter + 1 char + Z + 1 check digit, e.g. 27AAAAA0000A1Z5 or 09AAAAA0000A1Z5)');
            return;
        }

        try {
            const payload = {
                ...newCustomerForm,
                email: cleanEmail,
                mobile: cleanMobile,
                gstin: cleanGSTIN
            };
            const res = await customerService.create(payload);
            const newCust = res.data?.data || res.data;
            if (newCust && newCust._id) {
                setCustomers(prev => [...prev, newCust]);
                selectCustomerObject(newCust);
                toast.success('Customer created & details auto-filled!');
                setIsNewCustomerModalOpen(false);
                setIsInlineCustomerFormOpen(false);
                setNewCustomerForm({
                    companyName: '',
                    customerName: '',
                    email: '',
                    mobile: '',
                    gstin: ''
                });
            } else {
                toast.error('Failed to parse created customer');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Error creating customer');
        }
    };

    const updateItem = (rowId, field, value) => {
        setItems(prevItems => {
            const newItems = prevItems.map(item => {
                if (item.rowId !== rowId) return item;
                const updated = { ...item, [field]: value };
                if (field === 'itemCategory') {
                    updated.isManual = (value === 'Manual');
                } else if (field === 'isManual') {
                    updated.itemCategory = value ? 'Manual' : 'Added';
                }
                return updated;
            });
            const targetIndex = newItems.findIndex(item => item.rowId === rowId);
            if (targetIndex !== -1 && (field === 'quantity' || field === 'price' || field === 'discountPercent')) {
                const qty = Number(newItems[targetIndex].quantity) || 0;
                const price = Number(newItems[targetIndex].price) || 0;
                const disc = Number(newItems[targetIndex].discountPercent) || 0;
                newItems[targetIndex].value = Number((qty * price * (1 - disc / 100)).toFixed(2));
            }
            return newItems;
        });
    };

    const handleProductSelect = (rowId, product) => {
        setItems(prevItems => {
            const newItems = prevItems.map(item => ({ ...item }));
            let targetIndex = newItems.findIndex(item => item.rowId === rowId);
            if (targetIndex === -1 && newItems.length === 1) {
                targetIndex = 0;
            }
            if (targetIndex === -1) return prevItems;

            newItems[targetIndex].productId = product._id;
            newItems[targetIndex].productCode = product.productCode;
            newItems[targetIndex].productName = product.productName;
            newItems[targetIndex].price = product.basePrice || 0;
            newItems[targetIndex].discountPercent = 0;
            newItems[targetIndex].value = Number(((newItems[targetIndex].quantity || 1) * (product.basePrice || 0)).toFixed(2));
            newItems[targetIndex].isManual = false;
            newItems[targetIndex].itemCategory = 'Added';

            const validUoms = ['Pcs', 'Nos', 'Kg', 'Meter', 'Mtr', 'Set', 'Ltr', 'Pack', 'Doz'];
            const productUom = product.uom || 'Pcs';
            const matchedUom = validUoms.find(u => u.toLowerCase() === productUom.toLowerCase());
            newItems[targetIndex].uom = matchedUom || 'Pcs';

            if (product.vendors && Array.isArray(product.vendors) && product.vendors.length > 0) {
                const mappedVendorIds = product.vendors.map(v => (v.vendorId && typeof v.vendorId === 'object') ? v.vendorId._id : v.vendorId).filter(Boolean);
                newItems[targetIndex].vendors = mappedVendorIds;
                newItems[targetIndex].vendorQuotes = product.vendors.map(v => {
                    const vendorId = (v.vendorId && typeof v.vendorId === 'object') ? v.vendorId._id : v.vendorId;
                    if (!vendorId) return null;
                    return {
                        vendorId,
                        price: v.price || '',
                        deliveryTime: '',
                        availability: Number(v.stock || 0) > 0 ? 'In Stock' : 'Out of Stock',
                        remarks: '',
                        probability: 0
                    };
                }).filter(Boolean);
            }
            return newItems;
        });
    };

    const addItem = (overrides = {}) => {
        setItems([...items, createItemRow(overrides)]);
    };

    const handleSelectManualProduct = (rowId) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.rowId === rowId) {
                return {
                    ...item,
                    productId: '',
                    isManual: true,
                    itemCategory: 'Manual',
                    productCode: item.productCode || '',
                    productName: item.productName || ''
                };
            }
            return item;
        }));
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const addPartner = () => {
        setHeader(prev => ({
            ...prev,
            partners: [
                ...(prev.partners || []),
                { name: '', contactPerson: '', mobile: '', email: '', notes: '' }
            ]
        }));
    };

    const updatePartner = (index, field, value) => {
        setHeader(prev => ({
            ...prev,
            partners: (prev.partners || []).map((partner, i) => (
                i === index ? { ...partner, [field]: value } : partner
            ))
        }));
    };

    const removePartner = (index) => {
        setHeader(prev => ({
            ...prev,
            partners: (prev.partners || []).filter((_, i) => i !== index)
        }));
    };

    const handleVendorSelection = (itemIndex, vendorIds) => {
        const newItems = [...items];
        newItems[itemIndex].vendors = vendorIds;
        
        newItems[itemIndex].vendorQuotes = newItems[itemIndex].vendorQuotes.filter(vq => 
            vendorIds.includes(vq.vendorId)
        );
        
        vendorIds.forEach(vid => {
            if (!newItems[itemIndex].vendorQuotes.find(vq => vq.vendorId === vid)) {
                newItems[itemIndex].vendorQuotes.push({
                    vendorId: vid,
                    price: '',
                    deliveryTime: '',
                    availability: '',
                    remarks: '',
                    probability: 0
                });
            }
        });
        
        if (!vendorIds.includes(newItems[itemIndex].finalVendor)) {
            newItems[itemIndex].finalVendor = '';
        }

        setItems(newItems);
    };

    const updateVendorQuote = (itemIndex, quoteIndex, field, value) => {
        const newItems = [...items];
        newItems[itemIndex].vendorQuotes[quoteIndex][field] = value;
        setItems(newItems);
    };

    // Calculate real-time totals via useMemo
    const calculatedTotals = useMemo(() => {
        const itemSubtotal = items.reduce((sum, item) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            const disc = Number(item.discountPercent) || 0;
            return sum + (qty * price * (1 - disc / 100));
        }, 0);

        const discount = Number(header.discount) || 0;
        const freight = Number(header.freight) || 0;
        const otherCharges = Number(header.otherCharges) || 0;
        const grandTotal = Math.max(0, itemSubtotal - discount + freight + otherCharges);

        return {
            subtotal: itemSubtotal,
            grandTotal: grandTotal
        };
    }, [items, header.discount, header.freight, header.otherCharges]);

    const handleSubmit = async () => {
        if (!header.customerId) {
            toast.error('Customer is required');
            return;
        }

        if (header.contactMobile && !isValidMobile(header.contactMobile)) {
            toast.error('Invalid Contact Mobile Number (must be 10 digits)');
            return;
        }

        const filledItems = items.filter(item => !isBlankRow(item));

        if (filledItems.length === 0) {
            toast.error('At least one product item is required');
            return;
        }

        const emptyProductIndex = items.findIndex(item => {
            if (isBlankRow(item)) return false;
            return !item.productName || item.productName.trim() === '';
        });
        if (emptyProductIndex !== -1) {
            toast.error(`Product Name is required for all items. Check Item ${emptyProductIndex + 1}`);
            return;
        }

        const finalStages = ['Finalized', 'PO Received', 'Won'];
        if (finalStages.includes(header.status)) {
            const missingVendorIndexInFilled = filledItems.findIndex(i => !i.finalVendor);
            if (missingVendorIndexInFilled !== -1) {
                const origIndex = items.findIndex(origItem => origItem.rowId === filledItems[missingVendorIndexInFilled].rowId);
                toast.error(`Final Vendor selection is required for all items before saving as ${header.status}. Check Item ${origIndex + 1}`);
                return;
            }
        }

        const payloadHistory = [...followUpLog];
        if (newFollowUpNote.trim() !== '') {
            payloadHistory.push({
                note: newFollowUpNote,
                actionType: newFollowUpAction,
                date: new Date()
            });
        }

        const cleanedItems = filledItems.map(item => {
            const cleaned = { ...item };
            delete cleaned.rowId;
            cleaned.rate = Number(cleaned.price) || 0;
            cleaned.price = Number(cleaned.price) || 0;
            cleaned.quantity = Number(cleaned.quantity) || 1;
            cleaned.discountPercent = Number(cleaned.discountPercent) || 0;
            cleaned.value = Number((cleaned.quantity * cleaned.price * (1 - cleaned.discountPercent / 100)).toFixed(2));
            if (!cleaned.productId || cleaned.productId === '') {
                delete cleaned.productId;
            } else if (cleaned.productId && typeof cleaned.productId === 'object') {
                cleaned.productId = cleaned.productId._id;
            }
            if (!cleaned.finalVendor || cleaned.finalVendor === '') {
                delete cleaned.finalVendor;
            } else if (cleaned.finalVendor && typeof cleaned.finalVendor === 'object') {
                cleaned.finalVendor = cleaned.finalVendor._id;
            }
            return cleaned;
        });

        const cleanedHeader = { ...header };
        if (cleanedHeader.assignedTo && typeof cleanedHeader.assignedTo === 'object') {
            cleanedHeader.assignedTo = cleanedHeader.assignedTo._id;
        }
        if (!cleanedHeader.assignedTo || cleanedHeader.assignedTo === '') {
            delete cleanedHeader.assignedTo;
        }
        if (cleanedHeader.followUpDate === '') {
            delete cleanedHeader.followUpDate;
        }
        if (cleanedHeader.requiredDeliveryDate === '') {
            delete cleanedHeader.requiredDeliveryDate;
        }
        cleanedHeader.partners = (cleanedHeader.partners || []).filter(partner =>
            Object.values(partner).some(value => String(value || '').trim() !== '')
        );

        const subtotal = cleanedItems.reduce((sum, item) => sum + (item.quantity * item.price * (1 - item.discountPercent / 100)), 0);
        const discount = Number(header.discount) || 0;
        const freight = Number(header.freight) || 0;
        const otherCharges = Number(header.otherCharges) || 0;
        const grandTotal = Math.max(0, subtotal - discount + freight + otherCharges);
        
        setLoading(true);
        try {
            const payload = { 
                ...cleanedHeader, 
                items: cleanedItems, 
                followUpHistory: payloadHistory,
                subtotal: subtotal,
                discount: discount,
                freight: freight,
                otherCharges: otherCharges,
                grandTotal: grandTotal
            };
            if (isEditMode) {
                await enquiryService.update(id, payload);
                toast.success('Enquiry updated successfully');
            } else {
                await enquiryService.create(payload);
                toast.success('Enquiry created successfully');
            }
            navigate('/enquiries');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving enquiry');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAndNew = async () => {
        if (isEditMode) {
            await handleSubmit();
            return;
        }

        if (!header.customerId) {
            toast.error('Customer is required');
            return;
        }

        if (header.contactMobile && !isValidMobile(header.contactMobile)) {
            toast.error('Invalid Contact Mobile Number (must be 10 digits)');
            return;
        }

        const filledItems = items.filter(item => !isBlankRow(item));

        if (filledItems.length === 0) {
            toast.error('At least one product item is required');
            return;
        }

        const emptyProductIndex = items.findIndex(item => {
            if (isBlankRow(item)) return false;
            return !item.productName || item.productName.trim() === '';
        });
        if (emptyProductIndex !== -1) {
            toast.error(`Product Name is required for all items. Check Item ${emptyProductIndex + 1}`);
            return;
        }

        const finalStages = ['Finalized', 'PO Received', 'Won'];
        if (finalStages.includes(header.status)) {
            const missingVendorIndexInFilled = filledItems.findIndex(i => !i.finalVendor);
            if (missingVendorIndexInFilled !== -1) {
                const origIndex = items.findIndex(origItem => origItem.rowId === filledItems[missingVendorIndexInFilled].rowId);
                toast.error(`Final Vendor selection is required for all items before saving as ${header.status}. Check Item ${origIndex + 1}`);
                return;
            }
        }

        const payloadHistory = [...followUpLog];
        if (newFollowUpNote.trim() !== '') {
            payloadHistory.push({
                note: newFollowUpNote,
                actionType: newFollowUpAction,
                date: new Date()
            });
        }

        const cleanedItems = filledItems.map(item => {
            const cleaned = { ...item };
            delete cleaned.rowId;
            cleaned.rate = Number(cleaned.price) || 0;
            cleaned.price = Number(cleaned.price) || 0;
            cleaned.quantity = Number(cleaned.quantity) || 1;
            cleaned.discountPercent = Number(cleaned.discountPercent) || 0;
            cleaned.value = Number((cleaned.quantity * cleaned.price * (1 - cleaned.discountPercent / 100)).toFixed(2));
            if (cleaned.finalVendor === '') {
                delete cleaned.finalVendor;
            }
            return cleaned;
        });

        const cleanedHeader = { ...header };
        if (cleanedHeader.assignedTo === '') {
            delete cleanedHeader.assignedTo;
        }
        if (cleanedHeader.followUpDate === '') {
            delete cleanedHeader.followUpDate;
        }
        if (cleanedHeader.requiredDeliveryDate === '') {
            delete cleanedHeader.requiredDeliveryDate;
        }
        cleanedHeader.partners = (cleanedHeader.partners || []).filter(partner =>
            Object.values(partner).some(value => String(value || '').trim() !== '')
        );

        const subtotal = cleanedItems.reduce((sum, item) => sum + (item.quantity * item.price * (1 - item.discountPercent / 100)), 0);
        const discount = Number(header.discount) || 0;
        const freight = Number(header.freight) || 0;
        const otherCharges = Number(header.otherCharges) || 0;
        const grandTotal = Math.max(0, subtotal - discount + freight + otherCharges);

        setLoading(true);
        try {
            const payload = { 
                ...cleanedHeader, 
                items: cleanedItems, 
                followUpHistory: payloadHistory,
                subtotal: subtotal,
                discount: discount,
                freight: freight,
                otherCharges: otherCharges,
                grandTotal: grandTotal
            };
            await enquiryService.create(payload);
            toast.success('Enquiry created successfully');

            let nextEnqNo = '5001';
            try {
                const enqRes = await enquiryService.getAll();
                nextEnqNo = generateNextEnquiryNumber(enqRes.data || []);
            } catch (enqErr) {
                console.error("Failed to pre-fetch next number on save & new:", enqErr);
            }

            setHeader({
                enquiryNo: nextEnqNo,
                enquiryDate: new Date().toISOString().split('T')[0],
                customerId: '',
                companyName: '',
                contactPerson: '',
                refReceivedFrom: '',
                followUpDate: '',
                contactDesignation: '',
                contactMobile: '',
                contactEmail: '',
                partners: [],
                siteAddress: '',
                projectName: '',
                requiredDeliveryDate: '',
                priority: 'Medium',
                budget: '',
                technicalSpecifications: '',
                attachmentName: '',
                status: 'Open',
                probability: 0,
                remarks: '',
                closureReason: '',
                subtotal: 0,
                discount: 0,
                freight: 0,
                otherCharges: 0,
                grandTotal: 0
            });
            setFollowUpLog([]);
            setNewFollowUpNote('');
            setNewFollowUpAction('Call');
            setItems([createItemRow()]);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving enquiry');
        } finally {
            setLoading(false);
        }
    };

    const selectedCustomer = customers.find(c => c._id === header.customerId);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
            {/* Top Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-3 bg-white hover:bg-slate-50 rounded-2xl shadow-sm border border-slate-100 transition-all text-slate-400 hover:text-teal-600">
                        <MdArrowBack size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{isEditMode ? 'Edit Enquiry' : 'Create Enquiry'}</h1>
                        <p className="text-slate-500 font-medium">Tracking Leads & Progress</p>
                    </div>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-8 py-3.5 bg-teal-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-teal-700 transition-all shadow-xl shadow-teal-600/20 active:scale-95 flex items-center gap-2"
                >
                    <MdCheckCircle size={18} />
                    {isEditMode ? 'Update Enquiry' : 'Save Enquiry'}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* 1. Enquiry Details Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                            <MdBadge size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest text-teal-600">Enquiry Reference Details</h2>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">Define reference code, priority status, dates, and specifications</p>
                        </div>
                    </div>
                    <div className="p-5 md:p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enquiry No.</label>
                                <div className="relative">
                                    <MdNumbers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="text"
                                        name="enquiryNo"
                                        value={header.enquiryNo}
                                        onChange={handleHeaderChange}
                                        disabled={true}
                                        readOnly={true}
                                        placeholder="Auto-generated"
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl outline-none text-sm font-bold text-slate-500 opacity-70 cursor-not-allowed select-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enquiry Date</label>
                                <input
                                    type="date"
                                    name="enquiryDate"
                                    value={header.enquiryDate}
                                    onChange={handleHeaderChange}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Req. Delivery Date</label>
                                <input
                                    type="date"
                                    name="requiredDeliveryDate"
                                    value={header.requiredDeliveryDate}
                                    onChange={handleHeaderChange}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                                <select
                                    name="priority"
                                    value={header.priority}
                                    onChange={handleHeaderChange}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold text-slate-700 focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all"
                                >
                                    {['Low', 'Medium', 'High', 'Urgent'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {header.status === 'Lost' && (
                            <div className="space-y-2 animate-in fade-in duration-300">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Loss</label>
                                <textarea
                                    name="closureReason"
                                    value={header.closureReason}
                                    onChange={handleHeaderChange}
                                    placeholder="Provide details on why this enquiry was lost..."
                                    rows="2"
                                    className="w-full px-4 py-3 bg-slate-50 border border-rose-200 rounded-2xl outline-none text-sm font-bold resize-none focus:bg-white focus:border-rose-500 transition-all text-slate-800"
                                ></textarea>
                            </div>
                        )}

                    </div>
                </div>

                {/* 2. Customer Details Card (Matching user layout image) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest text-teal-600">Customer Details</h3>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                        {/* Customer Dropdown search */}
                        <div className="lg:col-span-4 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer <span className="text-rose-500">*</span></label>
                            <CustomerSearchDropdown
                                customers={customers}
                                selectedCustomerId={header.customerId}
                                onSelect={handleCustomerSelect}
                            />
                        </div>
                        {/* Inline blue + New Customer button */}
                        <div className="lg:col-span-2">
                            <button
                                type="button"
                                onClick={() => setIsInlineCustomerFormOpen(!isInlineCustomerFormOpen)}
                                className="w-full py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center whitespace-nowrap gap-1 shadow-md active:scale-95 shrink-0"
                            >
                                {isInlineCustomerFormOpen ? '✕ Close Form' : '+ New Customer'}
                            </button>
                        </div>
                        {/* Contact Person */}
                        <div className="lg:col-span-3 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Person</label>
                            <input
                                type="text"
                                name="contactPerson"
                                value={header.contactPerson}
                                onChange={handleHeaderChange}
                                placeholder="Contact person"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800"
                            />
                        </div>
                        {/* Email */}
                        <div className="lg:col-span-3 space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                            <input
                                type="email"
                                name="contactEmail"
                                value={header.contactEmail}
                                onChange={handleHeaderChange}
                                placeholder="Email address"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800 lowercase"
                            />
                        </div>
                    </div>

                    {/* Inline Customer Registration Section */}
                    {isInlineCustomerFormOpen && (
                        <div className="bg-slate-50/80 border border-teal-200 p-5 rounded-2xl space-y-4 my-3 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                                <h4 className="text-xs font-black uppercase text-teal-700 tracking-wider">Quick Create Customer</h4>
                                <button type="button" onClick={() => setIsInlineCustomerFormOpen(false)} className="text-xs font-bold text-slate-400 hover:text-rose-500">✕ Close</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Company Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={newCustomerForm.companyName}
                                        onChange={(e) => setNewCustomerForm(prev => ({ ...prev, companyName: e.target.value }))}
                                        placeholder="e.g. ACME Corp"
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-teal-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Contact Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={newCustomerForm.customerName}
                                        onChange={(e) => setNewCustomerForm(prev => ({ ...prev, customerName: e.target.value }))}
                                        placeholder="e.g. John Doe"
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-teal-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Email (Lowercase)</label>
                                    <input
                                        type="email"
                                        value={newCustomerForm.email}
                                        onChange={(e) => setNewCustomerForm(prev => ({ ...prev, email: e.target.value.toLowerCase().trim() }))}
                                        placeholder="e.g. john@acme.com"
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-teal-500 outline-none lowercase"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Mobile No. (10 digits)</label>
                                    <input
                                        type="tel"
                                        maxLength={10}
                                        value={newCustomerForm.mobile}
                                        onChange={(e) => setNewCustomerForm(prev => ({ ...prev, mobile: e.target.value.replace(/[^\d]/g, '').slice(0, 10) }))}
                                        placeholder="e.g. 9876543210"
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-teal-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">GSTIN (15 chars)</label>
                                    <input
                                        type="text"
                                        maxLength={15}
                                        value={newCustomerForm.gstin}
                                        onChange={(e) => setNewCustomerForm(prev => ({ ...prev, gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) }))}
                                        placeholder="e.g. 27AABCU9603R1ZM"
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-teal-500 outline-none uppercase font-mono"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setIsInlineCustomerFormOpen(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl font-bold text-xs uppercase"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateCustomer}
                                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all"
                                >
                                    Save & Auto-Fill Customer
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile No.</label>
                            <input
                                type="tel"
                                name="contactMobile"
                                maxLength={10}
                                value={header.contactMobile}
                                onChange={handleHeaderChange}
                                placeholder="10-digit mobile number"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designation</label>
                            <input
                                type="text"
                                name="contactDesignation"
                                value={header.contactDesignation}
                                onChange={handleHeaderChange}
                                placeholder="e.g. Procurement Manager"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Name</label>
                            <input
                                type="text"
                                name="projectName"
                                value={header.projectName}
                                onChange={handleHeaderChange}
                                placeholder="Project Name"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery / Site Address</label>
                        <textarea
                            name="siteAddress"
                            value={header.siteAddress}
                            onChange={handleHeaderChange}
                            placeholder="Complete delivery / site address details"
                            rows="2"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold resize-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800"
                        ></textarea>
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest text-teal-600">Partner Details</h3>
                            <button
                                type="button"
                                onClick={addPartner}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-md"
                            >
                                <MdAdd size={16} /> Add Partner
                            </button>
                        </div>
                        {(header.partners || []).length === 0 ? (
                            <p className="text-xs font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4 text-center">No partners added.</p>
                        ) : (
                            <div className="space-y-3">
                                {(header.partners || []).map((partner, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                        <input
                                            type="text"
                                            value={partner.name || ''}
                                            onChange={(e) => updatePartner(index, 'name', e.target.value)}
                                            placeholder="Partner company"
                                            className="md:col-span-3 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold focus:border-teal-500 text-slate-800"
                                        />
                                        <input
                                            type="text"
                                            value={partner.contactPerson || ''}
                                            onChange={(e) => updatePartner(index, 'contactPerson', e.target.value)}
                                            placeholder="Contact person"
                                            className="md:col-span-2 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold focus:border-teal-500 text-slate-800"
                                        />
                                        <input
                                            type="tel"
                                            value={partner.mobile || ''}
                                            onChange={(e) => updatePartner(index, 'mobile', e.target.value)}
                                            placeholder="Mobile"
                                            className="md:col-span-2 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold focus:border-teal-500 text-slate-800"
                                        />
                                        <input
                                            type="email"
                                            value={partner.email || ''}
                                            onChange={(e) => updatePartner(index, 'email', e.target.value)}
                                            placeholder="Email"
                                            className="md:col-span-2 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold focus:border-teal-500 text-slate-800"
                                        />
                                        <input
                                            type="text"
                                            value={partner.notes || ''}
                                            onChange={(e) => updatePartner(index, 'notes', e.target.value)}
                                            placeholder="Notes"
                                            className="md:col-span-2 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold focus:border-teal-500 text-slate-800"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removePartner(index)}
                                            className="md:col-span-1 h-11 px-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center"
                                            title="Remove Partner"
                                        >
                                            <MdDelete size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Product Details Card (Matching user table style) */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                                <MdOutlineDriveFileRenameOutline size={20} />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest text-teal-600">Product Details</h2>
                                <p className="text-xs font-semibold text-slate-500 mt-0.5">Specify products, codes, quantities, price rates, and item discounts</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => addItem({ itemCategory: 'Added', isManual: false })}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-md"
                            >
                                <MdAdd size={16} /> Add Product (Added)
                            </button>
                            <button
                                type="button"
                                onClick={() => addItem({ itemCategory: 'Manual', isManual: true })}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-md"
                            >
                                <MdAdd size={16} /> Add Product (Manual)
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">#</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[130px]">Category</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Item Code</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[280px]">Description</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">Unit</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28 text-right">Qty</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32 text-right">Price (₹)</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-right">Disc %</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40 text-right">Value (₹)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={item.rowId || index} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                        <td className="px-6 py-4 text-xs font-bold text-slate-400 text-center align-middle">{index + 1}</td>
                                        <td className="px-3 py-3 align-middle">
                                            <select
                                                value={item.itemCategory || (item.isManual ? 'Manual' : 'Added')}
                                                onChange={(e) => {
                                                    updateItem(item.rowId, 'itemCategory', e.target.value);
                                                }}
                                                className={`w-full px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider outline-none border transition-all cursor-pointer ${
                                                    (item.itemCategory === 'Manual' || item.isManual)
                                                        ? 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-2 focus:ring-amber-400'
                                                        : 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-2 focus:ring-emerald-400'
                                                }`}
                                            >
                                                <option value="Added">Added</option>
                                                <option value="Manual">Manual</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            {item.isManual ? (
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="text"
                                                        value={item.productCode || ''}
                                                        onChange={(e) => updateItem(item.rowId, 'productCode', e.target.value)}
                                                        placeholder="Custom Code"
                                                        className="w-full px-3 py-2 bg-amber-50/60 border border-amber-300 rounded-xl focus:border-teal-500 focus:bg-white outline-none text-xs font-bold text-slate-800"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => updateItem(item.rowId, 'isManual', false)}
                                                        className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap"
                                                        title="Switch to Master Search"
                                                    >
                                                        Search
                                                    </button>
                                                </div>
                                            ) : (
                                                <ProductCodeSearchAutocomplete
                                                    value={item.productId || item.productCode}
                                                    selectedLabel={item.productCode}
                                                    onChange={(val) => updateItem(item.rowId, 'productCode', val)}
                                                    products={products}
                                                    onSelectProduct={(product) => handleProductSelect(item.rowId, product)}
                                                    onSelectManualProduct={() => handleSelectManualProduct(item.rowId)}
                                                />
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <input
                                                type="text"
                                                value={item.productName}
                                                onChange={(e) => updateItem(item.rowId, 'productName', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:border-teal-500 focus:bg-white outline-none text-xs font-bold transition-all text-slate-800"
                                                placeholder="Description..."
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <select
                                                value={item.uom}
                                                onChange={(e) => updateItem(item.rowId, 'uom', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:border-teal-500 focus:bg-white outline-none text-xs font-bold transition-all appearance-none text-slate-800"
                                            >
                                                {['Pcs', 'Nos', 'Kg', 'Meter', 'Mtr', 'Set', 'Ltr', 'Pack', 'Doz'].map(u => (
                                                    <option key={u} value={u}>{u}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                min="1"
                                                onChange={(e) => updateItem(item.rowId, 'quantity', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:border-teal-500 focus:bg-white outline-none text-xs font-bold transition-all text-right font-mono text-slate-800"
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <input
                                                type="number"
                                                value={item.price}
                                                min="0"
                                                onChange={(e) => updateItem(item.rowId, 'price', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:border-teal-500 focus:bg-white outline-none text-xs font-bold transition-all text-right font-mono text-slate-800"
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <input
                                                type="number"
                                                value={item.discountPercent}
                                                min="0"
                                                max="100"
                                                onChange={(e) => updateItem(item.rowId, 'discountPercent', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:border-teal-500 focus:bg-white outline-none text-xs font-bold transition-all text-right font-mono text-slate-800"
                                            />
                                        </td>
                                        <td className="px-6 py-3 align-middle font-mono text-xs font-bold text-slate-800 text-right">
                                            ₹{(item.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-3 text-center align-middle">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setVendorModal({ isOpen: true, itemIndex: index })}
                                                    className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                                                    title="Compare Vendor Quotes"
                                                >
                                                    <MdSearch size={18} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Delete Row"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Bottom Calculations & Remarks (Matching layout structure) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Left side: Freight, Discount, Other Charges + Remarks */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Freight (₹)</label>
                                <input
                                    type="number"
                                    name="freight"
                                    value={header.freight}
                                    onChange={handleHeaderChange}
                                    placeholder="0"
                                    min="0"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all font-mono text-slate-800"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Discount (₹)</label>
                                <input
                                    type="number"
                                    name="discount"
                                    value={header.discount}
                                    onChange={handleHeaderChange}
                                    placeholder="0"
                                    min="0"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all font-mono text-slate-800"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Other Charges (₹)</label>
                                <input
                                    type="number"
                                    name="otherCharges"
                                    value={header.otherCharges}
                                    onChange={handleHeaderChange}
                                    placeholder="0"
                                    min="0"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all font-mono text-slate-800"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remarks</label>
                            <textarea
                                name="remarks"
                                value={header.remarks}
                                onChange={handleHeaderChange}
                                placeholder="Write remarks here..."
                                rows="3"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold resize-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-slate-800"
                            ></textarea>
                        </div>
                    </div>

                    {/* Right side: Summary Calculations (Teal theme matching styling) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-3 text-teal-600">Enquiry Value Summary</h3>
                        
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                                <span>SUB TOTAL</span>
                                <span className="font-mono text-slate-800">₹{calculatedTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            
                            {header.discount > 0 && (
                                <div className="flex justify-between items-center text-xs font-bold text-rose-500">
                                    <span>OVERALL DISCOUNT (-)</span>
                                    <span className="font-mono">₹{Number(header.discount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            {header.freight > 0 && (
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                    <span>FREIGHT (+)</span>
                                    <span className="font-mono text-slate-800 font-bold">₹{Number(header.freight).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            {header.otherCharges > 0 && (
                                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                                    <span>OTHER CHARGES (+)</span>
                                    <span className="font-mono text-slate-800 font-bold">₹{Number(header.otherCharges).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            <div className="border-t border-slate-200 my-4 pt-4 flex justify-between items-center">
                                <span className="text-sm font-black text-slate-950">GRAND TOTAL</span>
                                <span className="text-xl font-black text-teal-600 font-mono">
                                    ₹{calculatedTotals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save/Cancel Action panel */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-teal-700 transition-all shadow-xl shadow-teal-600/20 disabled:opacity-60 active:scale-95"
                    >
                        <MdCheckCircle size={18} />
                        {isEditMode ? 'Update Enquiry' : 'Save Enquiry'}
                    </button>
                    {!isEditMode && (
                        <button
                            type="button"
                            onClick={handleSaveAndNew}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all disabled:opacity-60 active:scale-95"
                        >
                            <MdAdd size={18} />
                            Save & New
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => navigate('/enquiries')}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all disabled:opacity-60 active:scale-95"
                    >
                        <MdClose size={18} />
                        Cancel
                    </button>
                </div>
            </div>

            {/* Vendor Management Modal */}
            <Modal
                isOpen={vendorModal.isOpen}
                onClose={() => setVendorModal({ isOpen: false, itemIndex: null })}
                title="Vendor Comparison & Quotes"
                size="4xl"
            >
                {vendorModal.itemIndex !== null && (
                    <div className="space-y-6">
                        <div className="p-4 bg-teal-50 text-teal-800 rounded-2xl border border-teal-100">
                            <h3 className="font-black text-sm uppercase tracking-wide">
                                Product: {items[vendorModal.itemIndex].productName || 'Unnamed Product'}
                            </h3>
                            <p className="text-xs font-medium text-teal-600/80 mt-1">Select vendors and compare their quotations.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Vendors</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-40 overflow-y-auto p-1">
                                {allVendors.map(vendor => {
                                    const isSelected = items[vendorModal.itemIndex].vendors.includes(vendor._id);
                                    return (
                                        <div 
                                            key={vendor._id} 
                                            onClick={() => {
                                                const currentVendors = items[vendorModal.itemIndex].vendors;
                                                const newVendors = isSelected 
                                                    ? currentVendors.filter(id => id !== vendor._id)
                                                    : [...currentVendors, vendor._id];
                                                handleVendorSelection(vendorModal.itemIndex, newVendors);
                                            }}
                                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between
                                                ${isSelected ? 'bg-teal-50 border-teal-300 shadow-sm ring-1 ring-teal-500/50' : 'bg-white border-slate-200 hover:border-teal-200'}
                                            `}
                                        >
                                            <span className={`text-xs font-bold ${isSelected ? 'text-teal-800' : 'text-slate-600'} truncate mr-2`}>{vendor.name}</span>
                                            <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border ${isSelected ? 'bg-teal-600 border-teal-600' : 'border-slate-300'}`}>
                                                {isSelected && <MdCheckCircle size={10} className="text-white" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {items[vendorModal.itemIndex].vendors.length > 0 && (
                            <div className="space-y-4 mt-8 pt-6 border-t border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    Vendor Quotations
                                    <span className="text-[9px] font-bold lowercase text-teal-500 bg-teal-50 px-2 py-0.5 rounded-full normal-case">(Lowest price highlighted)</span>
                                </h4>
                                <div className="space-y-4">
                                    {(() => {
                                        // Calculate best vendor (cheapest)
                                        const quotes = items[vendorModal.itemIndex].vendorQuotes;
                                        const minPrice = Math.min(...quotes.filter(q => q.price).map(q => Number(q.price)));
                                        
                                        return quotes.map((quote, qIndex) => {
                                            const vendor = allVendors.find(v => v._id === quote.vendorId);
                                            if (!vendor) return null;
                                            
                                            const isCheapest = quote.price && Number(quote.price) === minPrice;
                                            
                                            return (
                                                <div key={quote.vendorId} className={`border rounded-2xl p-5 ${isCheapest ? 'bg-emerald-50/30 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                                    <h5 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200/60 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${isCheapest ? 'bg-emerald-500' : 'bg-teal-500'}`}></span>
                                                            {vendor.name}
                                                        </div>
                                                        {isCheapest && <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md uppercase tracking-wider">Best Price</span>}
                                                    </h5>
                                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                        <div>
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Unit Price</label>
                                                            <div className="relative">
                                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                    <span className="text-slate-400 text-xs">₹</span>
                                                                </div>
                                                                <input 
                                                                    type="number" 
                                                                    value={quote.price || ''} 
                                                                    onChange={(e) => updateVendorQuote(vendorModal.itemIndex, qIndex, 'price', e.target.value)}
                                                                    className={`w-full pl-7 pr-3 py-2 bg-white border rounded-lg text-xs font-bold outline-none ${isCheapest ? 'border-emerald-300 focus:border-emerald-500' : 'border-slate-200 focus:border-teal-500'}`}
                                                                    placeholder="Price"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Lead Time</label>
                                                            <input 
                                                                type="text" 
                                                                value={quote.deliveryTime || ''} 
                                                                onChange={(e) => updateVendorQuote(vendorModal.itemIndex, qIndex, 'deliveryTime', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-teal-500 outline-none"
                                                                placeholder="e.g. 2 weeks"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Availability</label>
                                                            <input 
                                                                type="text" 
                                                                value={quote.availability || ''} 
                                                                onChange={(e) => updateVendorQuote(vendorModal.itemIndex, qIndex, 'availability', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-teal-500 outline-none"
                                                                placeholder="In stock?"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Win Prob. (%)</label>
                                                            <input 
                                                                type="number" 
                                                                min="0" max="100"
                                                                value={quote.probability || 0} 
                                                                onChange={(e) => updateVendorQuote(vendorModal.itemIndex, qIndex, 'probability', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-teal-500 outline-none"
                                                                placeholder="0-100"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1 col-span-2">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Remarks</label>
                                                            <input 
                                                                type="text" 
                                                                value={quote.remarks || ''} 
                                                                onChange={(e) => updateVendorQuote(vendorModal.itemIndex, qIndex, 'remarks', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-teal-500 outline-none"
                                                                placeholder="Notes..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-6">
                            <button
                                onClick={() => setVendorModal({ isOpen: false, itemIndex: null })}
                                className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                            >
                                Done & Close
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default CreateEnquiry;
