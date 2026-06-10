import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdArrowBack, MdAdd, MdDelete, MdCheckCircle, MdPerson, MdSearch, MdBadge, MdExpandMore, MdOutlineDriveFileRenameOutline, MdNumbers, MdClose } from 'react-icons/md';
import { toast } from 'react-toastify';
import { customerService, enquiryService, vendorService, productService } from '../services/api';
import Modal from '../components/Modal';
import PortalDropdown from '../components/PortalDropdown';

// Reuse CustomerSearchDropdown from CreateQuotation pattern
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
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (customer) => {
        onSelect(customer._id);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div ref={dropdownRef} className="relative">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full pl-12 pr-10 py-3.5 bg-slate-50 border rounded-2xl cursor-pointer transition-all flex items-center ${isOpen ? 'border-primary-500 ring-4 ring-primary-500/10' : 'border-slate-200 hover:border-slate-300'}`}
            >
                <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <span className={`text-sm font-bold truncate flex-1 ${selectedCustomer ? 'text-slate-900' : 'text-slate-400'}`}>
                    {selectedCustomer ? `${selectedCustomer.companyName} (${selectedCustomer.gstin})` : 'Search & Select Customer...'}
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
                            <div key={customer._id} onClick={() => handleSelect(customer)} className="px-4 py-3 cursor-pointer hover:bg-primary-50 border-b border-slate-50 last:border-b-0">
                                <div className="font-bold text-slate-900 text-sm">{customer.companyName}</div>
                                <div className="text-[10px] text-slate-500">{customer.customerName} • {customer.gstin}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ProductSearchAutocomplete = ({ value, onChange, products, onSelectProduct }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const anchorRef = useRef(null);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    const filteredProducts = useMemo(() => {
        const query = (searchTerm || value || '').toLowerCase();
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

    const handleTextChange = (e) => {
        const val = e.target.value;
        onChange(val);
        setIsOpen(true);
    };

    const handleSelect = (product) => {
        onSelectProduct(product);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleSearchButtonClick = (e) => {
        e.stopPropagation();
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            setTimeout(() => {
                if (inputRef.current) inputRef.current.focus();
            }, 100);
        }
    };

    return (
        <div ref={anchorRef} className="relative w-full">
            <div className="relative">
                <textarea
                    rows="3"
                    value={value || ''}
                    onChange={handleTextChange}
                    onFocus={() => setIsOpen(true)}
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-transparent rounded-xl focus:border-primary-500 focus:bg-white outline-none text-xs font-bold transition-all resize-none"
                    placeholder="Product / service required"
                />
                <button
                    type="button"
                    onClick={handleSearchButtonClick}
                    className={`absolute right-3 top-3 transition-colors ${isOpen ? 'text-primary-600' : 'text-slate-400 hover:text-primary-600'}`}
                >
                    <MdSearch size={18} />
                </button>
            </div>
            <PortalDropdown isOpen={isOpen} anchorRef={anchorRef}>
                <div ref={dropdownRef} className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[320px]">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                        <div className="relative flex-1">
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search product name or code..."
                                className="w-full pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
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
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 hover:bg-slate-200 active:scale-95 rounded-lg text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center shrink-0"
                            title="Close dropdown"
                        >
                            <MdClose size={18} />
                        </button>
                    </div>
                    <div className="overflow-y-auto max-h-60 divide-y divide-slate-50">
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map(product => (
                                <div 
                                    key={product._id} 
                                    onClick={() => handleSelect(product)} 
                                    className="px-4 py-3 cursor-pointer hover:bg-primary-50 transition-colors text-left"
                                >
                                    <div className="font-bold text-slate-900 text-xs">
                                        {product.productName || 'Unnamed Product'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5 flex items-center gap-1.5 flex-wrap">
                                        <span className="text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded text-[9px] font-black">
                                            {product.productCode}
                                        </span>
                                        <span>•</span>
                                        <span>HSN: {product.hsnCode || 'N/A'}</span>
                                        <span>•</span>
                                        <span>GST: {product.gstPercentage}%</span>
                                        <span>•</span>
                                        <span>UOM: {product.uom}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-slate-400 text-xs font-semibold">
                                No matching products found.
                            </div>
                        )}
                    </div>
                </div>
            </PortalDropdown>
        </div>
    );
};

const generateNextEnquiryNumber = (existingEnquiries = []) => {
    let maxNum = 0;
    let prefix = '';
    
    existingEnquiries.forEach(e => {
        const str = String(e.enquiryNo || '').trim();
        const match = str.match(/^(.*?)(\d+)$/);
        if (match) {
            const currentPrefix = match[1];
            const num = parseInt(match[2], 10);
            if (num > maxNum) {
                maxNum = num;
                prefix = currentPrefix;
            }
        }
    });

    if (maxNum > 0) {
        const nextNum = maxNum + 1;
        const origNumStr = existingEnquiries.find(e => String(e.enquiryNo).endsWith(String(maxNum)))?.enquiryNo || '';
        const numMatch = origNumStr.match(/(\d+)$/);
        const paddingLen = numMatch ? numMatch[1].length : 0;
        const nextNumStr = String(nextNum).padStart(paddingLen, '0');
        return `${prefix}${nextNumStr}`;
    }
    
    return '5001';
};

const CreateEnquiry = ({ id: propsId, isOpen, onClose }) => {
    const navigate = useNavigate();
    const params = useParams();
    const id = propsId || params.id;
    const isEditMode = !!id;

    const [customers, setCustomers] = useState([]);
    const [allVendors, setAllVendors] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);

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
        siteAddress: '',
        projectName: '',
        requiredDeliveryDate: '',
        priority: 'Medium',
        budget: '',
        technicalSpecifications: '',
        attachmentName: '',
        status: 'New',
        probability: 0,
        remarks: '',
        closureReason: ''
    });
    
    const [followUpLog, setFollowUpLog] = useState([]);
    const [newFollowUpNote, setNewFollowUpNote] = useState('');
    const [newFollowUpAction, setNewFollowUpAction] = useState('Call');

    const [items, setItems] = useState([
        { 
            productName: '', 
            quantity: 1, 
            uom: 'Pcs', 
            actionStatus: 'VISIT CUSTOMER', 
            salespersonName: '', 
            agentName: '',
            vendors: [],
            vendorQuotes: [],
            finalVendor: ''
        }
    ]);

    const [vendorModal, setVendorModal] = useState({ isOpen: false, itemIndex: null });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [custRes, vendRes, prodRes] = await Promise.all([
                    customerService.getAll(),
                    vendorService.getAll(true),
                    productService.getAll()
                ]);
                setCustomers(custRes.data);
                setAllVendors(vendRes.data);
                setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || []);

                if (!id) {
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

        if (id) {
            const fetchEnquiry = async () => {
                setLoading(true);
                try {
                    const res = await enquiryService.getById(id);
                    const e = res.data;
                    setHeader({
                        enquiryNo: e.enquiryNo,
                        enquiryDate: new Date(e.enquiryDate).toISOString().split('T')[0],
                        customerId: e.customerId._id || e.customerId,
                        companyName: e.companyName || e.customerId?.companyName || '',
                        contactPerson: e.contactPerson || e.customerId?.customerName || '',
                        refReceivedFrom: e.refReceivedFrom || '',
                        followUpDate: e.followUpDate ? new Date(e.followUpDate).toISOString().split('T')[0] : '',
                        contactDesignation: e.contactDesignation || '',
                        contactMobile: e.contactMobile || e.customerId?.mobile || '',
                        contactEmail: e.contactEmail || e.customerId?.email || '',
                        siteAddress: e.siteAddress || '',
                        projectName: e.projectName || '',
                        requiredDeliveryDate: e.requiredDeliveryDate ? new Date(e.requiredDeliveryDate).toISOString().split('T')[0] : '',
                        priority: e.priority || 'Medium',
                        budget: e.budget || '',
                        technicalSpecifications: e.technicalSpecifications || '',
                        attachmentName: e.attachmentName || '',
                        status: e.status || 'New',
                        probability: e.probability || 0,
                        remarks: e.remarks || '',
                        closureReason: e.closureReason || ''
                    });
                    setFollowUpLog(e.followUpHistory || []);
                    
                    const mappedItems = e.items.map(item => ({
                        ...item,
                        vendors: item.vendors.map(v => typeof v === 'object' ? v._id : v),
                        vendorQuotes: item.vendorQuotes.map(vq => ({
                            ...vq,
                            vendorId: typeof vq.vendorId === 'object' ? vq.vendorId._id : vq.vendorId
                        })),
                        finalVendor: typeof item.finalVendor === 'object' ? item.finalVendor?._id : item.finalVendor || ''
                    }));
                    setItems(mappedItems);
                } catch (err) {
                    toast.error('Failed to load enquiry');
                    if (onClose) onClose();
                    else navigate('/enquiries');
                } finally {
                    setLoading(false);
                }
            };
            fetchEnquiry();
        }
    }, [id, navigate, onClose]);

    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        setHeader(prev => ({ ...prev, [name]: value }));
    };

    const formatCustomerAddress = (customer) => {
        const address = customer?.billingAddress;
        if (!address) return '';
        return [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ');
    };

    const handleCustomerSelect = (customerId) => {
        const customer = customers.find(c => c._id === customerId);
        setHeader(prev => ({
            ...prev,
            customerId,
            companyName: customer?.companyName || prev.companyName,
            contactPerson: customer?.customerName || prev.contactPerson,
            contactMobile: customer?.mobile || prev.contactMobile,
            contactEmail: customer?.email || prev.contactEmail,
            siteAddress: formatCustomerAddress(customer) || prev.siteAddress
        }));
    };

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleProductSelect = (index, product) => {
        const newItems = [...items];
        newItems[index].productName = product.productName;
        const validUoms = ['Pcs', 'Nos', 'Kg', 'Meter', 'Mtr', 'Set', 'Ltr', 'Pack', 'Doz'];
        const productUom = product.uom || 'Pcs';
        const matchedUom = validUoms.find(u => u.toLowerCase() === productUom.toLowerCase());
        newItems[index].uom = matchedUom || 'Pcs';

        if (product.vendors && Array.isArray(product.vendors) && product.vendors.length > 0) {
            const mappedVendorIds = product.vendors.map(v => typeof v.vendorId === 'object' ? v.vendorId._id : v.vendorId);
            newItems[index].vendors = mappedVendorIds;
            newItems[index].vendorQuotes = product.vendors.map(v => {
                const vendorId = typeof v.vendorId === 'object' ? v.vendorId._id : v.vendorId;
                return {
                    vendorId,
                    price: v.price || '',
                    deliveryTime: '',
                    availability: Number(v.stock || 0) > 0 ? 'In Stock' : 'Out of Stock',
                    remarks: '',
                    probability: 0
                };
            });
        }
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { 
            productName: '', 
            quantity: 1, 
            uom: 'Pcs', 
            actionStatus: 'VISIT CUSTOMER', 
            salespersonName: '', 
            agentName: '',
            vendors: [],
            vendorQuotes: [],
            finalVendor: ''
        }]);
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
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

    const handleSubmit = async () => {
        if (!header.customerId) {
            toast.error('Customer is required');
            return;
        }

        // Ensure all items have a Product Name
        const emptyProductIndex = items.findIndex(item => !item.productName || item.productName.trim() === '');
        if (emptyProductIndex !== -1) {
            toast.error(`Product Name is required for all items. Check Item ${emptyProductIndex + 1}`);
            return;
        }

        const finalStages = ['Finalized', 'PO Received', 'Won'];
        if (finalStages.includes(header.status)) {
            const missingVendorItem = items.findIndex(i => !i.finalVendor);
            if (missingVendorItem !== -1) {
                toast.error(`Final Vendor selection is required for all items before saving as ${header.status}. Check Item ${missingVendorItem + 1}`);
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

        const cleanedItems = items.map(item => {
            const cleaned = { ...item };
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
        
        setLoading(true);
        try {
            const payload = { ...cleanedHeader, items: cleanedItems, followUpHistory: payloadHistory };
            if (isEditMode) {
                await enquiryService.update(id, payload);
                toast.success('Enquiry updated successfully');
            } else {
                await enquiryService.create(payload);
                toast.success('Enquiry created successfully');
            }
            if (onClose) onClose();
            else navigate('/enquiries');
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

        // Ensure all items have a Product Name
        const emptyProductIndex = items.findIndex(item => !item.productName || item.productName.trim() === '');
        if (emptyProductIndex !== -1) {
            toast.error(`Product Name is required for all items. Check Item ${emptyProductIndex + 1}`);
            return;
        }

        const finalStages = ['Finalized', 'PO Received', 'Won'];
        if (finalStages.includes(header.status)) {
            const missingVendorItem = items.findIndex(i => !i.finalVendor);
            if (missingVendorItem !== -1) {
                toast.error(`Final Vendor selection is required for all items before saving as ${header.status}. Check Item ${missingVendorItem + 1}`);
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

        const cleanedItems = items.map(item => {
            const cleaned = { ...item };
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

        setLoading(true);
        try {
            const payload = { ...cleanedHeader, items: cleanedItems, followUpHistory: payloadHistory };
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
                siteAddress: '',
                projectName: '',
                requiredDeliveryDate: '',
                priority: 'Medium',
                budget: '',
                technicalSpecifications: '',
                attachmentName: '',
                status: 'New',
                probability: 0,
                remarks: '',
                closureReason: ''
            });
            setFollowUpLog([]);
            setNewFollowUpNote('');
            setNewFollowUpAction('Call');
            setItems([{
                productName: '',
                quantity: 1,
                uom: 'Pcs',
                actionStatus: 'VISIT CUSTOMER',
                salespersonName: '',
                agentName: '',
                vendors: [],
                vendorQuotes: [],
                finalVendor: ''
            }]);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving enquiry');
        } finally {
            setLoading(false);
        }
    };

    const selectedCustomer = customers.find(c => c._id === header.customerId);

    const content = (
        <div className={`space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ${isOpen ? '' : 'pb-24'}`}>
            {/* Top Bar - only show if not in modal */}
            {!isOpen && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-3 bg-white hover:bg-slate-50 rounded-2xl shadow-sm border border-slate-100 transition-all text-slate-400 hover:text-primary-600">
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
                        className="px-8 py-3.5 bg-primary-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-600/20 active:scale-95 flex items-center gap-2"
                    >
                        <MdCheckCircle size={18} />
                        {isEditMode ? 'Update Enquiry' : 'Save Enquiry'}
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8">
                {/* Header Information */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                            <MdBadge size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Industrial Enquiry Form</h2>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">Capture enquiry, customer, project, and requirement details</p>
                        </div>
                    </div>
                    <div className="p-5 md:p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enquiry No.</label>
                            <div className="relative">
                                <MdNumbers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input
                                    type="text"
                                    name="enquiryNo"
                                    value={header.enquiryNo}
                                    onChange={handleHeaderChange}
                                        placeholder="Leave blank to auto-generate"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
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
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Name</label>
                                <input
                                    type="text"
                                    name="projectName"
                                    value={header.projectName}
                                    onChange={handleHeaderChange}
                                    placeholder="Project / plant / site"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Required Delivery Date</label>
                                <input
                                    type="date"
                                    name="requiredDeliveryDate"
                                    value={header.requiredDeliveryDate}
                                    onChange={handleHeaderChange}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="space-y-2 lg:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Company Name <span className="text-rose-500">*</span></label>
                                <CustomerSearchDropdown
                                    customers={customers}
                                    selectedCustomerId={header.customerId}
                                    onSelect={handleCustomerSelect}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designation</label>
                                <input
                                    type="text"
                                    name="contactDesignation"
                                    value={header.contactDesignation}
                                    onChange={handleHeaderChange}
                                    placeholder="Purchase manager, owner..."
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Person</label>
                                <input
                                    type="text"
                                    name="contactPerson"
                                    value={header.contactPerson}
                                    onChange={handleHeaderChange}
                                    placeholder="Contact person"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile No.</label>
                                <input
                                    type="tel"
                                    name="contactMobile"
                                    value={header.contactMobile}
                                    onChange={handleHeaderChange}
                                    placeholder="Mobile number"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                <input
                                    type="email"
                                    name="contactEmail"
                                    value={header.contactEmail}
                                    onChange={handleHeaderChange}
                                    placeholder="Email address"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                            <textarea
                                name="siteAddress"
                                value={header.siteAddress}
                                onChange={handleHeaderChange}
                                placeholder={selectedCustomer?.billingAddress ? `${selectedCustomer.billingAddress.line1 || ''} ${selectedCustomer.billingAddress.line2 || ''} ${selectedCustomer.billingAddress.city || ''}`.trim() : 'Site / billing / delivery address'}
                                rows="3"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold resize-none"
                            ></textarea>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Budget</label>
                                <input
                                    type="text"
                                    name="budget"
                                    value={header.budget}
                                    onChange={handleHeaderChange}
                                    placeholder="Optional"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                                <select
                                    name="priority"
                                    value={header.priority}
                                    onChange={handleHeaderChange}
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold text-slate-700"
                                >
                                    {['Low', 'Medium', 'High', 'Urgent'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Technical Specifications</label>
                            <textarea
                                name="technicalSpecifications"
                                value={header.technicalSpecifications}
                                onChange={handleHeaderChange}
                                placeholder="Model, make, rating, dimensions, process notes, or other specifications"
                                rows="4"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold resize-none"
                            ></textarea>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Attachment</label>
                                <input
                                    type="file"
                                    onChange={(e) => setHeader(prev => ({ ...prev, attachmentName: e.target.files?.[0]?.name || '' }))}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold file:mr-4 file:rounded-xl file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-xs file:font-black file:text-primary-700"
                                />
                                {header.attachmentName && <p className="text-xs font-bold text-slate-500 ml-1">Selected: {header.attachmentName}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remarks</label>
                                <textarea
                                    name="remarks"
                                    value={header.remarks}
                                    onChange={handleHeaderChange}
                                    placeholder="Additional notes about this enquiry"
                                    rows="3"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold resize-none"
                                ></textarea>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                                <MdOutlineDriveFileRenameOutline size={20} />
                            </div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Product / Service Required</h2>
                        </div>
                        <button
                            onClick={addItem}
                            className="px-4 py-2 bg-primary-50 text-primary-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-100 transition-all flex items-center gap-2"
                        >
                            <MdAdd size={16} /> Add Row
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Sr.</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[360px]">Product / Service Required</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-28">Quantity</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-36">Unit</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-16 text-center">Del</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                        <td className="px-6 py-4 text-xs font-bold text-slate-400">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <ProductSearchAutocomplete
                                                value={item.productName}
                                                onChange={(val) => updateItem(index, 'productName', val)}
                                                products={products}
                                                onSelectProduct={(product) => handleProductSelect(index, product)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:border-primary-500 focus:bg-white outline-none text-xs font-bold transition-all"
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <select
                                                value={item.uom}
                                                onChange={(e) => updateItem(index, 'uom', e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:border-primary-500 focus:bg-white outline-none text-xs font-bold transition-all appearance-none"
                                            >
                                                {['Pcs', 'Nos', 'Kg', 'Meter', 'Mtr', 'Set', 'Ltr', 'Pack', 'Doz'].map(u => (
                                                    <option key={u} value={u}>{u}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-center align-top">
                                            <button
                                                onClick={() => removeItem(index)}
                                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all outline-none"
                                            >
                                                <MdDelete size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-600/20 disabled:opacity-60"
                    >
                        <MdCheckCircle size={18} />
                        {isEditMode ? 'Save' : 'Save'}
                    </button>
                    {!isEditMode && (
                        <button
                            type="button"
                            onClick={handleSaveAndNew}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all disabled:opacity-60"
                        >
                            <MdAdd size={18} />
                            Save & New
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onClose ? onClose() : navigate('/enquiries')}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all disabled:opacity-60"
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
                        <div className="p-4 bg-primary-50 text-primary-800 rounded-2xl border border-primary-100">
                            <h3 className="font-black text-sm uppercase tracking-wide">
                                Product: {items[vendorModal.itemIndex].productName || 'Unnamed Product'}
                            </h3>
                            <p className="text-xs font-medium text-primary-600/80 mt-1">Select vendors and compare their quotations.</p>
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
                                                ${isSelected ? 'bg-primary-50 border-primary-300 shadow-sm ring-1 ring-primary-500/50' : 'bg-white border-slate-200 hover:border-primary-200'}
                                            `}
                                        >
                                            <span className={`text-xs font-bold ${isSelected ? 'text-primary-800' : 'text-slate-600'} truncate mr-2`}>{vendor.name}</span>
                                            <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-300'}`}>
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
                                    <span className="text-[9px] font-bold lowercase text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full normal-case">(Lowest price highlighted)</span>
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
                                                            <span className={`w-2 h-2 rounded-full ${isCheapest ? 'bg-emerald-500' : 'bg-primary-500'}`}></span>
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
                                                                    className={`w-full pl-7 pr-3 py-2 bg-white border rounded-lg text-xs font-bold outline-none ${isCheapest ? 'border-emerald-300 focus:border-emerald-500' : 'border-slate-200 focus:border-primary-500'}`}
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
                                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-primary-500 outline-none"
                                                                placeholder="e.g. 2 weeks"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Availability</label>
                                                            <input 
                                                                type="text" 
                                                                value={quote.availability || ''} 
                                                                onChange={(e) => updateVendorQuote(vendorModal.itemIndex, qIndex, 'availability', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-primary-500 outline-none"
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
                                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-primary-500 outline-none"
                                                                placeholder="0-100"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1 col-span-2">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Remarks</label>
                                                            <input 
                                                                type="text" 
                                                                value={quote.remarks || ''} 
                                                                onChange={(e) => updateVendorQuote(vendorModal.itemIndex, qIndex, 'remarks', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-primary-500 outline-none"
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

    if (isOpen) {
        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={isEditMode ? 'Edit Enquiry' : 'Create Enquiry'}
                maxWidth="max-w-[95vw] md:max-w-7xl"
            >
                {content}
            </Modal>
        );
    }

    return content;
};

export default CreateEnquiry;
