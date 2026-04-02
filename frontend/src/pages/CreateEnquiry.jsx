import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdArrowBack, MdAdd, MdDelete, MdSave, MdCheckCircle, MdPerson, MdSearch, MdClose, MdEventAvailable, MdBadge, MdExpandMore, MdOutlineDriveFileRenameOutline, MdNumbers } from 'react-icons/md';
import { toast } from 'react-toastify';
import { customerService, enquiryService, salespersonService } from '../services/api';

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

const CreateEnquiry = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [customers, setCustomers] = useState([]);
    const [salespersons, setSalespersons] = useState([]);
    const [loading, setLoading] = useState(false);

    const [header, setHeader] = useState({
        enquiryNo: '',
        enquiryDate: new Date().toISOString().split('T')[0],
        customerId: '',
        refReceivedFrom: '',
        followUpDate: ''
    });

    const [items, setItems] = useState([
        { productName: '', quantity: 1, uom: 'Pcs', actionStatus: 'VISIT CUSTOMER', salespersonName: '', agentName: '' }
    ]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [custRes, salesRes] = await Promise.all([
                    customerService.getAll(),
                    salespersonService.getAll()
                ]);
                setCustomers(custRes.data);
                setSalespersons(salesRes.data);
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
                        followUpDate: e.followUpDate ? new Date(e.followUpDate).toISOString().split('T')[0] : ''
                    });
                    setItems(e.items);
                } catch (err) {
                    toast.error('Failed to load enquiry');
                    navigate('/enquiries');
                } finally {
                    setLoading(false);
                }
            };
            fetchEnquiry();
        }
    }, [id, navigate]);

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
        setItems([...items, { productName: '', quantity: 1, uom: 'Pcs', actionStatus: 'VISIT CUSTOMER', salespersonName: '', agentName: '' }]);
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async () => {
        if (!header.enquiryNo || !header.customerId) {
            toast.error('Enquiry No and Customer are required');
            return;
        }
        
        setLoading(true);
        try {
            if (isEditMode) {
                await enquiryService.update(id, { ...header, items });
                toast.success('Enquiry updated successfully');
            } else {
                await enquiryService.create({ ...header, items });
                toast.success('Enquiry created successfully');
            }
            navigate('/enquiries');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving enquiry');
        } finally {
            setLoading(false);
        }
    };

    const selectedCustomer = customers.find(c => c._id === header.customerId);

    return (
        <div className="space-y-6 pb-24">
            {/* Top Bar */}
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

            <div className="grid grid-cols-1 gap-8">
                {/* Header Information */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                            <MdBadge size={20} />
                        </div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Enquiry Details</h2>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
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

                        <div className="space-y-2">
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
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference Received From</label>
                            <input
                                type="text"
                                name="refReceivedFrom"
                                value={header.refReceivedFrom}
                                onChange={handleHeaderChange}
                                placeholder="Source of Lead"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold"
                            />
                        </div>

                        {selectedCustomer && (
                            <div className="md:col-span-2 p-4 rounded-2xl bg-primary-50/50 border border-primary-100/50 flex flex-col justify-center">
                                <p className="text-xs text-primary-800 font-bold mb-1">Company: {selectedCustomer.companyName}</p>
                                <p className="text-[10px] text-primary-600/80 leading-relaxed uppercase font-black tracking-tighter">
                                    {selectedCustomer.billingAddress?.line1}, {selectedCustomer.billingAddress?.city}
                                </p>
                            </div>
                        )}
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
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Product Name</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-24">Qty</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-32">UOM</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Action 1 (Status)</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Salesman</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Agent/Middleman</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-16 text-center">Delete</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-xs font-bold text-slate-400">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.productName}
                                                onChange={(e) => updateItem(index, 'productName', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl focus:border-primary-500 focus:bg-white outline-none text-xs font-bold transition-all"
                                                placeholder="Enter product..."
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl focus:border-primary-500 focus:bg-white outline-none text-xs font-bold transition-all"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={item.uom}
                                                onChange={(e) => updateItem(index, 'uom', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl focus:border-primary-500 focus:bg-white outline-none text-xs font-bold transition-all appearance-none"
                                            >
                                                {['Pcs', 'Set', 'Ltr', 'Pack', 'Doz'].map(u => (
                                                    <option key={u} value={u}>{u}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={item.actionStatus}
                                                onChange={(e) => updateItem(index, 'actionStatus', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl focus:border-primary-500 focus:bg-white outline-none text-xs font-bold transition-all appearance-none text-primary-700 uppercase"
                                            >
                                                {[
                                                    'VISIT CUSTOMER', 'Quotation given', 'Followup date time', 
                                                    'quotation revise', 'quotation finalise', 'po received', 'enquiry won'
                                                ].map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={item.salespersonName}
                                                onChange={(e) => updateItem(index, 'salespersonName', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl focus:border-primary-500 focus:bg-white outline-none text-xs font-bold transition-all appearance-none"
                                            >
                                                <option value="">Select Salesman</option>
                                                {salespersons.map(s => (
                                                    <option key={s._id} value={s.name}>{s.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.agentName}
                                                onChange={(e) => updateItem(index, 'agentName', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl focus:border-primary-500 focus:bg-white outline-none text-xs font-bold transition-all"
                                                placeholder="Optional agent"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => removeItem(index)}
                                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
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
            </div>
        </div>
    );
};

export default CreateEnquiry;
