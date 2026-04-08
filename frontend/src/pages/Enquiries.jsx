import React, { useState, useEffect, useMemo } from 'react';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdMoreVert, MdTimer, MdCheckCircle, MdCancel, MdPerson, MdNumbers, MdEventAvailable, MdReceiptLong, MdFilterList, MdPercent, MdAnalytics } from 'react-icons/md';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { enquiryService } from '../services/api';
import Modal from '../components/Modal';
import CreateEnquiry from './CreateEnquiry';

const StatusPill = ({ status }) => {
    const styles = {
        'New': 'bg-blue-50 text-blue-600 border-blue-100',
        'Contacted': 'bg-indigo-50 text-indigo-600 border-indigo-100',
        'Quotation Pending': 'bg-amber-50 text-amber-600 border-amber-100',
        'Quotation Received': 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100',
        'Negotiation': 'bg-purple-50 text-purple-600 border-purple-100',
        'Finalized': 'bg-teal-50 text-teal-600 border-teal-100',
        'PO Received': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'Lost': 'bg-rose-50 text-rose-600 border-rose-100'
    };
    return (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {status}
        </span>
    );
};

const ActionStatusPill = ({ status }) => {
    const colorMap = {
        'VISIT CUSTOMER': 'bg-slate-50 text-slate-600',
        'Quotation given': 'bg-sky-50 text-sky-600',
        'Followup date time': 'bg-amber-50 text-amber-600',
        'quotation revise': 'bg-indigo-50 text-indigo-600',
        'quotation finalise': 'bg-purple-50 text-purple-600',
        'po received': 'bg-emerald-50 text-emerald-600',
        'enquiry won': 'bg-emerald-100 text-emerald-700'
    };
    return (
        <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-tight ${colorMap[status] || 'bg-slate-50 text-slate-500'}`}>
            {status}
        </span>
    );
};

const Enquiries = () => {
    const navigate = useNavigate();
    const [enquiries, setEnquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
    const [enquiryModal, setEnquiryModal] = useState({ open: false, id: null });
    const [showFilters, setShowFilters] = useState(false);

    // Advanced Filters State
    const [filters, setFilters] = useState({
        searchTerm: '',
        status: '',
        followUpDate: '',
        minProbability: '',
        productName: '',
        vendorName: ''
    });

    const fetchEnquiries = async () => {
        setLoading(true);
        try {
            const res = await enquiryService.getAll();
            setEnquiries(res.data);
        } catch (err) {
            toast.error('Failed to fetch enquiries');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEnquiries();
    }, []);

    const handleDelete = async () => {
        try {
            await enquiryService.delete(deleteModal.id);
            toast.success('Enquiry removed');
            fetchEnquiries();
        } catch (err) {
            toast.error('Deletion failed');
        } finally {
            setDeleteModal({ open: false, id: null });
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const clearFilters = () => {
        setFilters({
            searchTerm: '',
            status: '',
            followUpDate: '',
            minProbability: '',
            productName: '',
            vendorName: ''
        });
    };

    const filteredEnquiries = useMemo(() => {
        return enquiries.filter(e => {
            // General text match
            const matchesSearch = 
                e.enquiryNo.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                e.customerId?.companyName?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                e.customerId?.customerName?.toLowerCase().includes(filters.searchTerm.toLowerCase());

            const matchesStatus = filters.status ? e.status === filters.status : true;
            
            const matchesFollowUp = filters.followUpDate ? 
                (e.followUpDate && e.followUpDate.startsWith(filters.followUpDate)) : true;

            const matchesProb = filters.minProbability ? 
                (Number(e.probability) >= Number(filters.minProbability)) : true;

            const matchesProduct = filters.productName ? 
                e.items.some(item => item.productName.toLowerCase().includes(filters.productName.toLowerCase())) : true;

            const matchesVendor = filters.vendorName ?
                e.items.some(item => 
                    item.vendors.some(v => v.name && v.name.toLowerCase().includes(filters.vendorName.toLowerCase())) ||
                    (item.finalVendor && item.finalVendor.name && item.finalVendor.name.toLowerCase().includes(filters.vendorName.toLowerCase()))
                ) : true;

            return matchesSearch && matchesStatus && matchesFollowUp && matchesProb && matchesProduct && matchesVendor;
        });
    }, [enquiries, filters]);

    const wonCount = enquiries.filter(e => e.status === 'PO Received' || e.status === 'Finalized').length;
    const progressCount = enquiries.length - wonCount - enquiries.filter(e => e.status === 'Lost').length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Lead Management
                        <span className="text-sm font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">{filteredEnquiries.length}</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Track enquiries from lead to conversion</p>
                </div>
                <div className="flex gap-3 flex-col sm:flex-row">
                    <button
                        onClick={() => navigate('/enquiries/analytics')}
                        className="group px-6 py-4 bg-slate-100 text-slate-700 rounded-[2rem] font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all shadow-lg flex items-center gap-3"
                    >
                        <MdAnalytics size={18} />
                        Analytics
                    </button>
                    <button
                        onClick={() => setEnquiryModal({ open: true, id: null })}
                        className="group px-8 py-4 bg-primary-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-600/20 active:scale-95 flex items-center gap-3"
                    >
                        <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform">
                            <MdAdd size={20} />
                        </div>
                        New Lead Entry
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Enquiries', value: enquiries.length, icon: MdReceiptLong, color: 'text-primary-600', bg: 'bg-primary-50' },
                    { label: 'Final/PO Received', value: wonCount, icon: MdCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'In Progress', value: progressCount, icon: MdTimer, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Lost', value: enquiries.filter(e => e.status === 'Lost').length, icon: MdCancel, color: 'text-rose-600', bg: 'bg-rose-50' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
                        <div className={`h-14 w-14 rounded-[1.2rem] ${stat.bg} ${stat.color} flex items-center justify-center`}>
                            <stat.icon size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                            <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[500px]">
                {/* Tool Bar */}
                <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="relative flex-1 max-w-md">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                        <input
                            type="text"
                            placeholder="Search by enquiry number or customer..."
                            value={filters.searchTerm}
                            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                            className="w-full pl-14 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 outline-none transition-all placeholder:text-slate-300"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs font-bold transition-all border ${showFilters ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                        <MdFilterList size={18} />
                        Advanced Filters
                    </button>
                </div>

                {/* Advanced Filters Panel */}
                {showFilters && (
                    <div className="p-6 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Status (Outcome)</label>
                            <select 
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary-500 text-slate-700"
                            >
                                <option value="">All Statuses</option>
                                {['New', 'Contacted', 'Quotation Pending', 'Quotation Received', 'Negotiation', 'Finalized', 'PO Received', 'Lost'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Follow-up Date</label>
                            <input 
                                type="date"
                                value={filters.followUpDate}
                                onChange={(e) => handleFilterChange('followUpDate', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary-500 text-slate-700"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Min. Probability (%)</label>
                            <div className="relative">
                                <MdPercent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                <input 
                                    type="number"
                                    min="0" max="100"
                                    placeholder="e.g. 50"
                                    value={filters.minProbability}
                                    onChange={(e) => handleFilterChange('minProbability', e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary-500 text-slate-700"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Product</label>
                            <input 
                                type="text"
                                placeholder="Any product..."
                                value={filters.productName}
                                onChange={(e) => handleFilterChange('productName', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary-500 text-slate-700"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Vendor Cited</label>
                            <input 
                                type="text"
                                placeholder="Any vendor..."
                                value={filters.vendorName}
                                onChange={(e) => handleFilterChange('vendorName', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary-500 text-slate-700"
                            />
                        </div>
                        <div className="md:col-span-5 flex justify-end">
                            <button 
                                onClick={clearFilters}
                                className="text-xs font-bold text-slate-500 hover:text-slate-900 underline"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                )}

                {/* Data Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Enquiry No</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[180px]">Customer & Date</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Items (Vendors Cited)</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[150px]">Stats</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="6" className="px-8 py-10"><div className="h-4 bg-slate-100 rounded-full w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredEnquiries.length > 0 ? (
                                filteredEnquiries.map((e) => (
                                    <tr key={e._id} className="group hover:bg-primary-50/30 transition-colors duration-300">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary-100 group-hover:text-primary-600 transition-colors">
                                                    <MdNumbers size={20} />
                                                </div>
                                                <span className="font-black text-slate-900 tracking-tight text-sm">{e.enquiryNo}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                                                    <MdPerson className="text-slate-300" size={16} />
                                                    {e.customerId?.companyName}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                    <MdEventAvailable size={14} />
                                                    {new Date(e.enquiryDate).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {e.items.slice(0, 2).map((item, i) => (
                                                    <div key={i} className="text-xs font-bold text-slate-700 truncate max-w-[200px]">
                                                        • {item.productName} 
                                                        <span className="text-[9px] text-slate-400 ml-1">
                                                            ({item.finalVendor ? 1 : item.vendors.length} vend)
                                                        </span>
                                                    </div>
                                                ))}
                                                {e.items.length > 2 && (
                                                    <span className="text-[10px] font-bold text-primary-500">+{e.items.length - 2} more items</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                                                    <span className="w-16">Probability:</span> 
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${e.probability >= 70 ? 'bg-emerald-100 text-emerald-700' : e.probability >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{e.probability || 0}%</span>
                                                </div>
                                                {e.followUpDate && (
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                                                        <span className="w-16">Follow-up:</span> 
                                                        <span className="text-slate-900">{new Date(e.followUpDate).toLocaleDateString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusPill status={e.status} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setEnquiryModal({ open: true, id: e._id })}
                                                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                                                    title="Edit Enquiry"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteModal({ open: true, id: e._id })}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Delete Enquiry"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center text-slate-400 font-bold">
                                        No leads found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delete Modal */}
            <Modal
                isOpen={deleteModal.open}
                onClose={() => setDeleteModal({ open: false, id: null })}
                title="Remove Lead Entry"
            >
                <div className="space-y-6">
                    <p className="text-slate-600 font-medium">Are you sure you want to remove this lead? This action cannot be undone.</p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setDeleteModal({ open: false, id: null })}
                            className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Create/Edit Enquiry Modal */}
            {enquiryModal.open && (
                <CreateEnquiry 
                    id={enquiryModal.id} 
                    isOpen={enquiryModal.open} 
                    onClose={() => {
                        setEnquiryModal({ open: false, id: null });
                        fetchEnquiries();
                    }} 
                />
            )}
        </div>
    );
};

export default Enquiries;
