import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdMoreVert, MdTimer, MdCheckCircle, MdCancel, MdPerson, MdNumbers, MdEventAvailable, MdReceiptLong } from 'react-icons/md';
import { toast } from 'react-toastify';
import { enquiryService } from '../services/api';
import Modal from '../components/Modal';

const StatusPill = ({ status }) => {
    const styles = {
        'Open': 'bg-blue-50 text-blue-600 border-blue-100',
        'Won': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'Lost': 'bg-rose-50 text-rose-600 border-rose-100'
    };
    return (
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[status]}`}>
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
        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-tight ${colorMap[status] || 'bg-slate-50 text-slate-500'}`}>
            {status}
        </span>
    );
};

const Enquiries = () => {
    const navigate = useNavigate();
    const [enquiries, setEnquiries] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });

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

    const filteredEnquiries = enquiries.filter(e =>
        e.enquiryNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.customerId?.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Lead Management
                        <span className="text-sm font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">{filteredEnquiries.length}</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Track enquiries from lead to conversion</p>
                </div>
                <button
                    onClick={() => navigate('/enquiries/create')}
                    className="group px-8 py-4 bg-primary-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-600/20 active:scale-95 flex items-center gap-3"
                >
                    <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform">
                        <MdAdd size={20} />
                    </div>
                    New Lead Entry
                </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Enquiries', value: enquiries.length, icon: MdReceiptLong, color: 'text-primary-600', bg: 'bg-primary-50' },
                    { label: 'Won', value: enquiries.filter(e => e.status === 'Won').length, icon: MdCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'In Progress', value: enquiries.filter(e => e.status === 'Open').length, icon: MdTimer, color: 'text-amber-600', bg: 'bg-amber-50' },
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
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 outline-none transition-all placeholder:text-slate-300"
                        />
                    </div>
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Enquiry No</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Customer & Date</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Progress (Item Status)</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-8 py-10"><div className="h-4 bg-slate-100 rounded-full w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredEnquiries.length > 0 ? (
                                filteredEnquiries.map((e) => (
                                    <tr key={e._id} className="group hover:bg-primary-50/30 transition-colors duration-300">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary-100 group-hover:text-primary-600 transition-colors">
                                                    <MdNumbers size={24} />
                                                </div>
                                                <span className="font-black text-slate-900 tracking-tight">{e.enquiryNo}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
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
                                        <td className="px-8 py-6">
                                            <div className="flex flex-wrap gap-2">
                                                {e.items.slice(0, 2).map((item, i) => (
                                                    <ActionStatusPill key={i} status={item.actionStatus} />
                                                ))}
                                                {e.items.length > 2 && (
                                                    <span className="text-[10px] font-bold text-slate-400">+{e.items.length - 2} more</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <StatusPill status={e.status} />
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/enquiries/edit/${e._id}`)}
                                                    className="p-3 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-2xl transition-all"
                                                >
                                                    <MdEdit size={20} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteModal({ open: true, id: e._id })}
                                                    className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                                                >
                                                    <MdDelete size={20} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center text-slate-400 font-bold">
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
        </div>
    );
};

export default Enquiries;
