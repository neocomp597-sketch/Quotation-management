import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdArrowBack, MdAdd, MdDelete, MdCheckCircle, MdPerson, MdSearch, MdBadge, MdExpandMore, MdOutlineDriveFileRenameOutline, MdNumbers, MdStar, MdClose } from 'react-icons/md';
import { toast } from 'react-toastify';
import { customerService, enquiryService, salespersonService, vendorService } from '../services/api';
import Modal from '../components/Modal';

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

const CreateEnquiry = ({ id: propsId, isOpen, onClose }) => {
    const navigate = useNavigate();
    const params = useParams();
    const id = propsId || params.id;
    const isEditMode = !!id;

    const [customers, setCustomers] = useState([]);
    const [salespersons, setSalespersons] = useState([]);
    const [allVendors, setAllVendors] = useState([]);
    const [loading, setLoading] = useState(false);

    const [header, setHeader] = useState({
        enquiryNo: '',
        enquiryDate: new Date().toISOString().split('T')[0],
        customerId: '',
        refReceivedFrom: '',
        followUpDate: '',
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
                const [custRes, salesRes, vendRes] = await Promise.all([
                    customerService.getAll(),
                    salespersonService.getAll(),
                    vendorService.getAll(true) 
                ]);
                setCustomers(custRes.data);
                setSalespersons(salesRes.data);
                setAllVendors(vendRes.data);
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
                        refReceivedFrom: e.refReceivedFrom || '',
                        followUpDate: e.followUpDate ? new Date(e.followUpDate).toISOString().split('T')[0] : '',
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

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
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
        if (!header.enquiryNo || !header.customerId) {
            toast.error('Enquiry No and Customer are required');
            return;
        }

        const activeStages = ['New', 'Contacted', 'Quotation Pending', 'Quotation Received', 'Negotiation'];
        if (activeStages.includes(header.status) && !header.followUpDate) {
            toast.error(`Follow-up Date is required when status is ${header.status}`);
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
        
        setLoading(true);
        try {
            const payload = { ...header, items, followUpHistory: payloadHistory };
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

        if (!header.enquiryNo || !header.customerId) {
            toast.error('Enquiry No and Customer are required');
            return;
        }

        const activeStages = ['New', 'Contacted', 'Quotation Pending', 'Quotation Received', 'Negotiation'];
        if (activeStages.includes(header.status) && !header.followUpDate) {
            toast.error(`Follow-up Date is required when status is ${header.status}`);
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

        setLoading(true);
        try {
            await enquiryService.create({ ...header, items, followUpHistory: payloadHistory });
            toast.success('Enquiry created successfully');
            setHeader({
                enquiryNo: '',
                enquiryDate: new Date().toISOString().split('T')[0],
                customerId: '',
                refReceivedFrom: '',
                followUpDate: '',
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

    const isClosedStatus = ['Won', 'Lost', 'Finalized', 'PO Received'].includes(header.status);

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
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                            <MdBadge size={20} />
                        </div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Enquiry Details</h2>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enquiry Number <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <MdNumbers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input
                                    type="text"
                                    name="enquiryNo"
                                    value={header.enquiryNo}
                                    onChange={handleHeaderChange}
                                    placeholder="e.g. ABC/123"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer <span className="text-rose-500">*</span></label>
                            <CustomerSearchDropdown
                                customers={customers}
                                selectedCustomerId={header.customerId}
                                onSelect={(val) => setHeader(prev => ({ ...prev, customerId: val }))}
                            />
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
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Overall Status</label>
                            <select
                                name="status"
                                value={header.status}
                                onChange={handleHeaderChange}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold text-primary-700"
                            >
                                {['New', 'Contacted', 'Quotation Pending', 'Quotation Received', 'Negotiation', 'Finalized', 'PO Received', 'Lost'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Closure Probability (%)</label>
                            <input
                                type="number"
                                name="probability"
                                min="0" max="100"
                                value={header.probability}
                                onChange={handleHeaderChange}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                Follow-up Date {!isClosedStatus && <span className="text-rose-500">*</span>}
                            </label>
                            <input
                                type="date"
                                name="followUpDate"
                                value={header.followUpDate}
                                onChange={handleHeaderChange}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference</label>
                            <input
                                type="text"
                                name="refReceivedFrom"
                                value={header.refReceivedFrom}
                                onChange={handleHeaderChange}
                                placeholder="Source of Lead"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                            />
                        </div>
                        
                        {isClosedStatus && (
                            <div className="space-y-2 md:col-span-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Closure Reason (required for final status)</label>
                                <input
                                    type="text"
                                    name="closureReason"
                                    value={header.closureReason}
                                    onChange={handleHeaderChange}
                                    placeholder={`Why was it ${header.status}?`}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold mt-2"
                                />
                            </div>
                        )}
                        
                        <div className="space-y-2 md:col-span-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remarks</label>
                            <textarea
                                name="remarks"
                                value={header.remarks}
                                onChange={handleHeaderChange}
                                placeholder="Additional notes about this enquiry..."
                                rows="2"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold resize-none"
                            ></textarea>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                                <MdOutlineDriveFileRenameOutline size={20} />
                            </div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Enquiry Items & Progress</h2>
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
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[200px]">Product Name</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-24">Qty</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-32">UOM</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[150px]">Vendors & Quotes</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Final Vendor</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-16 text-center">Del</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                        <td className="px-6 py-4 text-xs font-bold text-slate-400">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.productName}
                                                onChange={(e) => updateItem(index, 'productName', e.target.value)}
                                                className="w-full px-4 py-2 bg-slate-50 border border-transparent rounded-xl focus:border-primary-500 focus:bg-white outline-none text-xs font-bold transition-all"
                                                placeholder="Enter product..."
                                            />
                                            <div className="flex gap-2 mt-2">
                                                <select
                                                    value={item.actionStatus}
                                                    onChange={(e) => updateItem(index, 'actionStatus', e.target.value)}
                                                    className="flex-1 px-3 py-1.5 bg-slate-100 border border-transparent rounded-lg outline-none text-[10px] font-bold transition-all text-primary-700 uppercase"
                                                >
                                                    {[
                                                        'VISIT CUSTOMER', 'Quotation given', 'Followup date time', 
                                                        'quotation revise', 'quotation finalise', 'po received', 'enquiry won'
                                                    ].map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={item.salespersonName}
                                                    onChange={(e) => updateItem(index, 'salespersonName', e.target.value)}
                                                    className="w-32 px-3 py-1.5 bg-slate-100 border border-transparent rounded-lg outline-none text-[10px] font-bold transition-all"
                                                >
                                                    <option value="">Salesman</option>
                                                    {salespersons.map(s => (
                                                        <option key={s._id} value={s.name}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </div>
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
                                                {['Pcs', 'Set', 'Ltr', 'Pack', 'Doz', 'Kg', 'Mtr'].map(u => (
                                                    <option key={u} value={u}>{u}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <button
                                                onClick={() => setVendorModal({ isOpen: true, itemIndex: index })}
                                                className={`w-full py-2 px-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border outline-none ${item.vendors.length > 0 ? "bg-primary-50 text-primary-700 border-primary-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
                                            >
                                                {item.vendors.length > 0 ? `${item.vendors.length} Vendors Cited` : 'Compare Vendors'}
                                            </button>
                                            {item.vendors.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {item.vendors.map(vId => {
                                                        const v = allVendors.find(vend => vend._id === vId);
                                                        return v ? (
                                                            <span key={vId} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-bold border border-slate-200 whitespace-nowrap">
                                                                {v.name}
                                                            </span>
                                                        ) : null;
                                                    })}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <select
                                                value={item.finalVendor}
                                                onChange={(e) => updateItem(index, 'finalVendor', e.target.value)}
                                                className={`w-full px-3 py-2 border rounded-xl outline-none text-xs font-bold transition-all ${item.finalVendor ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-transparent text-slate-500"}`}
                                                disabled={item.vendors.length === 0}
                                            >
                                                <option value="">Pending Selection</option>
                                                {item.vendors.map(vId => {
                                                    const v = allVendors.find(vend => vend._id === vId);
                                                    return v ? <option key={vId} value={vId}>{v.name}</option> : null;
                                                })}
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

                {/* Follow Up Tracking */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                                <MdStar size={20} />
                            </div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Follow-Up Log</h2>
                        </div>
                    </div>
                    
                    <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Add Follow-up Note</h3>
                            <div className="space-y-4">
                                <select 
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold text-slate-700"
                                    value={newFollowUpAction}
                                    onChange={(e) => setNewFollowUpAction(e.target.value)}
                                >
                                    <option value="Call">Phone Call</option>
                                    <option value="Email">Email Sent</option>
                                    <option value="Visit">Site/Client Visit</option>
                                    <option value="Meeting">Meeting</option>
                                    <option value="Other">Other</option>
                                </select>
                                <textarea 
                                    rows="3" 
                                    placeholder="What was discussed?"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold text-slate-700 resize-none"
                                    value={newFollowUpNote}
                                    onChange={(e) => setNewFollowUpNote(e.target.value)}
                                ></textarea>
                                <p className="text-[10px] text-slate-400 font-medium italic">Note: Save Enquiry to officially add this note.</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">History Trail</h3>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {followUpLog.length === 0 ? (
                                    <p className="text-sm font-medium text-slate-400 bg-slate-50 p-4 rounded-xl border border-slate-100">No previous follow-up logs found.</p>
                                ) : (
                                    followUpLog.map((log, i) => (
                                        <div key={i} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="px-2 py-1 bg-white text-xs font-bold text-slate-600 rounded drop-shadow-sm border border-slate-100">{log.actionType}</span>
                                                <span className="text-[10px] font-bold text-slate-400">{new Date(log.date).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-slate-800 font-medium">{log.note}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
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
