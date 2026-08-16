import React, { useState, useEffect, useMemo } from 'react';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdMoreVert, MdTimer, MdCheckCircle, MdCancel, MdPerson, MdNumbers, MdEventAvailable, MdReceiptLong, MdFilterList, MdPercent, MdAnalytics, MdVisibility, MdStar, MdClose, MdPeople } from 'react-icons/md';
import { toast } from 'react-toastify';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { enquiryService, salespersonService, userService, payrollService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import CreateEnquiry from './CreateEnquiry';
import { formatDate } from '../utils/helpers';

const StatusPill = ({ status }) => {
    const styles = {
        'Open': 'bg-teal-50 text-teal-700 border-teal-200',
        'Assigned': 'bg-indigo-50 text-indigo-700 border-indigo-200',
        'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
        'Pending Customer': 'bg-purple-50 text-purple-700 border-purple-200',
        'Resolved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Closed': 'bg-slate-100 text-slate-700 border-slate-200',
        'Cancelled': 'bg-rose-50 text-rose-700 border-rose-200',
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
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, isAdmin, isSuperAdmin } = useAuth();

    const isManagerOrAdmin = useMemo(() => {
        if (!user) return false;
        const role = String(user.role || '').toLowerCase();
        return isAdmin || isSuperAdmin || role === 'admin' || role === 'manager' || role === 'super_admin' || role === 'superadmin';
    }, [user, isAdmin, isSuperAdmin]);

    const activeTab = searchParams.get('tab') || 'my';

    const handleTabChange = (newTab) => {
        setFilters(prev => ({ ...prev, assignedTo: '' }));
        setSearchParams({ tab: newTab });
    };

    const [enquiries, setEnquiries] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
    const [enquiryModal, setEnquiryModal] = useState({ open: false, id: null });
    const [viewModal, setViewModal] = useState({ open: false, id: null, data: null });
    const [reassignModal, setReassignModal] = useState({ open: false, enquiry: null, targetUser: '' });
    const [newNote, setNewNote] = useState('');
    const [newActionType, setNewActionType] = useState('Call');
    const [addingFollowUp, setAddingFollowUp] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    const [filters, setFilters] = useState({
        searchTerm: '',
        status: '',
        followUpDate: '',
        minProbability: '',
        productName: '',
        vendorName: '',
        assignedTo: '',
        itemCategory: ''
    });

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const [salesRes, userRes, empRes] = await Promise.allSettled([
                    salespersonService.getAll(),
                    userService.getAll({ limit: 1000 }),
                    payrollService.getEmployees({ limit: 1000 })
                ]);
                const sData = salesRes.status === 'fulfilled' ? (salesRes.value.data?.data || salesRes.value.data || []) : [];
                const uData = userRes.status === 'fulfilled' ? (userRes.value.data?.data || userRes.value.data || []) : [];
                const eData = empRes.status === 'fulfilled' ? (empRes.value.data?.data || empRes.value.data || []) : [];

                const empDesignationMap = new Map();
                eData.forEach(emp => {
                    if (!emp) return;
                    const desig = String(emp.designation || '').trim();
                    if (emp.email) {
                        empDesignationMap.set(String(emp.email).toLowerCase().trim(), desig);
                    }
                    if (emp.userId) {
                        const uId = typeof emp.userId === 'object' ? emp.userId._id : emp.userId;
                        if (uId) empDesignationMap.set(String(uId), desig);
                    }
                });

                const isSalesExecutiveDesignation = (desigStr, roleStr) => {
                    const desigLower = (desigStr || '').toLowerCase().trim();
                    const roleLower = (roleStr || '').toLowerCase().trim().replace(/_/g, ' ');
                    if (desigLower) {
                        return desigLower === 'sales executive' || desigLower === 'sales executive role' || desigLower === 'salesperson';
                    }
                    return roleLower === 'sales executive' || roleLower === 'sales executive role' || roleLower === 'sales' || roleLower === 'salesperson' || roleLower === 'sales_executive';
                };

                const mergedMap = new Map();

                sData.forEach(item => {
                    if (item && item._id && !mergedMap.has(item._id.toString())) {
                        const empDesig = item.email ? empDesignationMap.get(String(item.email).toLowerCase().trim()) : null;
                        if (!empDesig || isSalesExecutiveDesignation(empDesig, 'Sales Executive')) {
                            mergedMap.set(item._id.toString(), {
                                _id: item._id.toString(),
                                name: item.name,
                                email: item.email,
                                role: 'Sales Executive'
                            });
                        }
                    }
                });

                uData.forEach(item => {
                    if (item && item._id && !mergedMap.has(item._id.toString())) {
                        const emailStr = String(item.email || '').toLowerCase().trim();
                        const empDesig = empDesignationMap.get(item._id.toString()) || empDesignationMap.get(emailStr);
                        if (isSalesExecutiveDesignation(empDesig, item.role)) {
                            mergedMap.set(item._id.toString(), {
                                _id: item._id.toString(),
                                name: item.name,
                                email: item.email,
                                role: 'Sales Executive'
                            });
                        }
                    }
                });

                eData.forEach(emp => {
                    if (!emp || !emp.name) return;
                    const desig = String(emp.designation || '').trim();
                    if (isSalesExecutiveDesignation(desig, '')) {
                        const targetId = emp.userId ? (typeof emp.userId === 'object' ? emp.userId._id : emp.userId) : emp._id;
                        const idStr = String(targetId);
                        if (!mergedMap.has(idStr)) {
                            mergedMap.set(idStr, {
                                _id: idStr,
                                name: emp.name,
                                email: emp.email || '',
                                role: 'Sales Executive'
                            });
                        }
                    }
                });

                setUsers(Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
            } catch (err) {
                console.error('Failed to load salespersons for assignment:', err);
            }
        };
        loadUsers();
    }, []);

    const fetchEnquiries = async () => {
        setLoading(true);
        try {
            const params = { tab: activeTab };
            if (filters.assignedTo && String(filters.assignedTo).trim() !== '') params.assignedTo = filters.assignedTo;
            if (filters.status && String(filters.status).trim() !== '') params.status = filters.status;
            const res = await enquiryService.getAll(params);
            setEnquiries(res.data || []);
        } catch (err) {
            toast.error('Failed to fetch enquiries');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenViewModal = async (id) => {
        try {
            const res = await enquiryService.getById(id);
            setViewModal({ open: true, id, data: res.data });
        } catch (err) {
            toast.error('Failed to load enquiry details');
        }
    };

    const handleReassign = async () => {
        if (!reassignModal.enquiry) return;
        try {
            const payload = {
                ...reassignModal.enquiry,
                assignedTo: reassignModal.targetUser || null
            };
            if (payload.customerId && typeof payload.customerId === 'object') payload.customerId = payload.customerId._id;
            if (payload.createdBy && typeof payload.createdBy === 'object') payload.createdBy = payload.createdBy._id;
            
            payload.items = (payload.items || []).map(item => {
                const cleaned = { ...item };
                if (cleaned.productId && typeof cleaned.productId === 'object') {
                    cleaned.productId = cleaned.productId._id;
                } else if (!cleaned.productId || cleaned.productId === '') {
                    delete cleaned.productId;
                }
                if (cleaned.finalVendor && typeof cleaned.finalVendor === 'object') {
                    cleaned.finalVendor = cleaned.finalVendor._id;
                } else if (!cleaned.finalVendor || cleaned.finalVendor === '') {
                    delete cleaned.finalVendor;
                }
                cleaned.vendors = (cleaned.vendors || []).map(v => (v && typeof v === 'object') ? v._id : v).filter(Boolean);
                cleaned.vendorQuotes = (cleaned.vendorQuotes || []).map(vq => ({
                    ...vq,
                    vendorId: (vq.vendorId && typeof vq.vendorId === 'object') ? vq.vendorId._id : vq.vendorId
                })).filter(vq => vq.vendorId);
                return cleaned;
            });

            await enquiryService.update(reassignModal.enquiry._id, payload);
            toast.success('Sales Executive assigned successfully');
            setReassignModal({ open: false, enquiry: null, targetUser: '' });
            fetchEnquiries();
            if (viewModal.open && viewModal.id === reassignModal.enquiry._id) {
                handleOpenViewModal(reassignModal.enquiry._id);
            }
        } catch (err) {
            toast.error('Failed to assign Sales Executive');
        }
    };

    const handleAddFollowUp = async (e) => {
        e.preventDefault();
        if (!newNote.trim()) {
            toast.error('Follow-up note cannot be empty');
            return;
        }
        setAddingFollowUp(true);
        try {
            const currentHistory = viewModal.data.followUpHistory || [];
            const updatedHistory = [...currentHistory, { note: newNote, actionType: newActionType, date: new Date() }];
            const payload = { ...viewModal.data, followUpHistory: updatedHistory };
            if (payload.customerId && typeof payload.customerId === 'object') payload.customerId = payload.customerId._id;
            if (payload.assignedTo && typeof payload.assignedTo === 'object') payload.assignedTo = payload.assignedTo._id;
            if (payload.createdBy && typeof payload.createdBy === 'object') payload.createdBy = payload.createdBy._id;
            payload.items = (payload.items || []).map(item => {
                const cleaned = { ...item };
                if (cleaned.productId && typeof cleaned.productId === 'object') {
                    cleaned.productId = cleaned.productId._id;
                } else if (!cleaned.productId || cleaned.productId === '') {
                    delete cleaned.productId;
                }
                if (cleaned.finalVendor && typeof cleaned.finalVendor === 'object') {
                    cleaned.finalVendor = cleaned.finalVendor._id;
                } else if (!cleaned.finalVendor || cleaned.finalVendor === '') {
                    delete cleaned.finalVendor;
                }
                cleaned.vendors = (cleaned.vendors || []).map(v => (v && typeof v === 'object') ? v._id : v).filter(Boolean);
                return cleaned;
            });

            await enquiryService.update(viewModal.id, payload);
            toast.success('Follow-up entry added successfully');
            const refreshed = await enquiryService.getById(viewModal.id);
            setViewModal(prev => ({ ...prev, data: refreshed.data }));
            setNewNote('');
            fetchEnquiries();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add follow-up entry');
        } finally {
            setAddingFollowUp(false);
        }
    };

    useEffect(() => {
        fetchEnquiries();
        const handleRealtimeUpdate = (e) => {
            if (e.detail?.entity === 'ENQUIRY') fetchEnquiries();
        };
        window.addEventListener('onCrmSocketUpdate', handleRealtimeUpdate);
        return () => window.removeEventListener('onCrmSocketUpdate', handleRealtimeUpdate);
    }, [activeTab, filters.assignedTo]);

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
            vendorName: '',
            assignedTo: '',
            itemCategory: ''
        });
    };

    const filteredEnquiries = useMemo(() => {
        const filtered = enquiries.filter(e => {
            const matchesSearch = 
                e.enquiryNo.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                e.customerId?.companyName?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
                e.customerId?.customerName?.toLowerCase().includes(filters.searchTerm.toLowerCase());

            const matchesStatus = filters.status ? e.status === filters.status : true;
            const matchesFollowUp = filters.followUpDate ? (e.followUpDate && e.followUpDate.startsWith(filters.followUpDate)) : true;
            const matchesProb = filters.minProbability ? (Number(e.probability) >= Number(filters.minProbability)) : true;
            const matchesProduct = filters.productName ? e.items.some(item => (item.productName || item.productId?.productName || '').toLowerCase().includes(filters.productName.toLowerCase())) : true;
            const matchesVendor = filters.vendorName ? e.items.some(item => item.vendors.some(v => v.name && v.name.toLowerCase().includes(filters.vendorName.toLowerCase())) || (item.finalVendor && item.finalVendor.name && item.finalVendor.name.toLowerCase().includes(filters.vendorName.toLowerCase()))) : true;
            const matchesItemCategory = filters.itemCategory ? e.items.some(item => {
                const cat = item.itemCategory || (item.isManual ? 'Manual' : 'Added');
                return cat === filters.itemCategory;
            }) : true;

            return matchesSearch && matchesStatus && matchesFollowUp && matchesProb && matchesProduct && matchesVendor && matchesItemCategory;
        });
        return filtered.sort((a, b) => String(b.enquiryNo || '').localeCompare(String(a.enquiryNo || ''), undefined, { numeric: true, sensitivity: 'base' }));
    }, [enquiries, filters]);

    const wonCount = enquiries.filter(e => e.status === 'PO Received' || e.status === 'Finalized').length;
    const progressCount = enquiries.length - wonCount - enquiries.filter(e => e.status === 'Lost').length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Enquiry Register
                        <span className="text-sm font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">{filteredEnquiries.length}</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Track and manage enquiries from creation to closure</p>
                </div>
                <div className="flex gap-3 flex-col sm:flex-row">
                    <button
                        onClick={() => navigate('/enquiries/analytics')}
                        className="group px-6 py-4 bg-slate-100 text-slate-700 rounded-[2rem] font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all shadow-lg flex items-center gap-3"
                    >
                        <MdAnalytics size={18} /> Analytics
                    </button>
                    <button
                        onClick={() => navigate('/enquiries/create')}
                        className="group px-8 py-4 bg-primary-600 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-600/20 active:scale-95 flex items-center gap-3"
                    >
                        <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform"><MdAdd size={20} /></div>
                        New Enquiry
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <button
                    onClick={() => handleTabChange('my')}
                    className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'my' ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                    <MdPerson size={18} /> My Enquiries {activeTab === 'my' && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-black">{enquiries.length}</span>}
                </button>
                <button
                    onClick={() => handleTabChange('team')}
                    className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'team' ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                    <MdPeople size={18} /> Team Enquiries {activeTab === 'team' && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-black">{enquiries.length}</span>}
                </button>
                {isManagerOrAdmin && (
                    <button
                        onClick={() => handleTabChange('all')}
                        className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'all' ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                    >
                        <MdReceiptLong size={18} /> All Enquiries {activeTab === 'all' && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-black">{enquiries.length}</span>}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: activeTab === 'my' ? 'My Total Enquiries' : activeTab === 'team' ? 'Team Total Enquiries' : 'Total System Enquiries', value: enquiries.length, icon: MdReceiptLong, color: 'text-primary-600', bg: 'bg-primary-50' },
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

            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[500px]">
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
                        <MdFilterList size={18} /> Advanced Filters
                    </button>
                </div>

                {showFilters && (
                    <div className="p-6 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Status (Outcome)</label>
                            <select 
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary-500 text-slate-700"
                            >
                                <option value="">All Statuses</option>
                                {['Open', 'Assigned', 'In Progress', 'Pending Customer', 'Resolved', 'Closed', 'Cancelled'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        {isManagerOrAdmin && (
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Assigned Executive</label>
                                <select 
                                    value={filters.assignedTo}
                                    onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary-500 text-slate-700"
                                >
                                    <option value="">All Executives</option>
                                    {users.map(u => (
                                        <option key={u._id} value={u._id}>{u.name} {u.role ? `(${u.role})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                        )}
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
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Product Category</label>
                            <select 
                                value={filters.itemCategory}
                                onChange={(e) => handleFilterChange('itemCategory', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary-500 text-slate-700 cursor-pointer"
                            >
                                <option value="">All Categories</option>
                                <option value="Added">Added (Catalog)</option>
                                <option value="Manual">Manual (Custom)</option>
                            </select>
                        </div>
                        <div className="md:col-span-6 flex justify-end">
                            <button 
                                onClick={clearFilters}
                                className="text-xs font-bold text-slate-500 hover:text-slate-900 underline"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Enquiry No</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[180px]">Customer & Date</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Assigned Executive</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Items / Partners</th>
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
                                                    {e.customerId?.companyName || e.customerId?.customerName || 'N/A'}
                                                </div>
                                                <div className="flex flex-col gap-0.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                    <div className="flex items-center gap-1.5">
                                                        <MdEventAvailable size={14} />
                                                        {formatDate(e.enquiryDate)}
                                                    </div>
                                                    {e.followUpDate && (
                                                        <div className="flex items-center gap-1.5 text-amber-600">
                                                            <span>Follow-up: {formatDate(e.followUpDate)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                                    {e.assignedTo?.name ? e.assignedTo.name.charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-slate-900 leading-none">
                                                        {e.assignedTo?.name || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                                                    </div>
                                                    {isManagerOrAdmin && (
                                                        <button
                                                            onClick={() => setReassignModal({ open: true, enquiry: e, targetUser: e.assignedTo?._id || '' })}
                                                            className="text-[10px] font-bold text-primary-600 hover:underline mt-0.5 block"
                                                        >
                                                            Reassign
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {e.items.slice(0, 2).map((item, i) => (
                                                    <div key={i} className="text-xs font-bold text-slate-700 truncate max-w-[200px]">
                                                        • {item.productName || item.productId?.productName || 'Unnamed Product'} 
                                                        <span className="text-[9px] text-slate-400 ml-1">
                                                        ({item.finalVendor ? 1 : item.vendors.length} vend)
                                                        </span>
                                                    </div>
                                                ))}
                                                {e.items.length > 2 && (
                                                    <span className="text-[10px] font-bold text-primary-500">+{e.items.length - 2} more items</span>
                                                )}
                                                {Array.isArray(e.partners) && e.partners.length > 0 && (
                                                    <span className="text-[10px] font-black text-teal-600 uppercase tracking-wider">{e.partners.length} partner{e.partners.length > 1 ? 's' : ''}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusPill status={e.status} />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleOpenViewModal(e._id)}
                                                    title="View Details"
                                                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                                                >
                                                    <MdVisibility size={18} />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/enquiries/edit/${e._id}`)}
                                                    title="Edit Enquiry"
                                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteModal({ open: true, id: e._id })}
                                                    title="Delete Enquiry"
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                                >
                                                    <MdDelete size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-8 py-16 text-center">
                                        <div className="max-w-xs mx-auto space-y-3">
                                            <div className="h-16 w-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                                                <MdReceiptLong size={32} />
                                            </div>
                                            <p className="text-sm font-bold text-slate-700">No enquiries found</p>
                                            <p className="text-xs text-slate-400">Try adjusting your filters or search term to locate the records you need.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={deleteModal.open}
                onClose={() => setDeleteModal({ open: false, id: null })}
                title="Confirm Deletion"
            >
                <div className="space-y-6">
                    <p className="text-sm font-bold text-slate-600 leading-relaxed">
                        Are you sure you want to delete this enquiry? This action is permanent and cannot be undone.
                    </p>
                    <div className="flex gap-4">
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

            <Modal
                isOpen={reassignModal.open}
                onClose={() => setReassignModal({ open: false, enquiry: null, targetUser: '' })}
                title="Assign Sales Executive"
            >
                <div className="space-y-4">
                    <p className="text-xs font-semibold text-slate-600">
                        Assign or reassign Enquiry <span className="font-bold text-slate-900">{reassignModal.enquiry?.enquiryNo}</span> to a Sales Executive.
                    </p>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sales Executive</label>
                        <select
                            value={reassignModal.targetUser}
                            onChange={(e) => setReassignModal(prev => ({ ...prev, targetUser: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-primary-500"
                        >
                            <option value="">Unassigned</option>
                            {users.map(u => (
                                <option key={u._id} value={u._id}>{u.name} {u.role ? `(${u.role})` : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setReassignModal({ open: false, enquiry: null, targetUser: '' })}
                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReassign}
                            className="px-5 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 shadow-md"
                        >
                            Save Assignment
                        </button>
                    </div>
                </div>
            </Modal>

            {viewModal.open && viewModal.data && (
                <Modal
                    isOpen={viewModal.open}
                    onClose={() => setViewModal({ open: false, id: null, data: null })}
                    title={`Enquiry Details: ${viewModal.data.enquiryNo}`}
                    maxWidth="max-w-[95vw] md:max-w-7xl"
                >
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 p-6 bg-slate-50 border border-slate-100 rounded-3xl">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Customer Name</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">{viewModal.data.customerId?.companyName || viewModal.data.customerId?.customerName || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Assigned Executive</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-black text-slate-900 block">{viewModal.data.assignedTo?.name || 'Unassigned'}</span>
                                    {isManagerOrAdmin && (
                                        <button
                                            onClick={() => setReassignModal({ open: true, enquiry: viewModal.data, targetUser: viewModal.data.assignedTo?._id || '' })}
                                            className="text-[10px] font-bold text-primary-600 hover:underline"
                                        >
                                            Change
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Enquiry Date</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">{formatDate(viewModal.data.enquiryDate)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Outcome Status</span>
                                <div className="mt-1 flex"><StatusPill status={viewModal.data.status} /></div>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Closure Probability</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">{viewModal.data.probability || 0}%</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3 mb-4 flex items-center gap-2">
                                        <MdPerson className="text-primary-600" size={16} /> Customer Details
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                                        <div>
                                            <span className="text-slate-400 block">Contact Person</span>
                                            <span className="text-slate-900 font-bold">{viewModal.data.customerId?.customerName || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block">GSTIN</span>
                                            <span className="text-slate-900 font-bold">{viewModal.data.customerId?.gstin || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block">Mobile Phone</span>
                                            <span className="text-slate-900 font-bold">{viewModal.data.customerId?.mobile || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block">Email Address</span>
                                            <span className="text-slate-900 font-bold">{viewModal.data.customerId?.email || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3 mb-4 flex items-center gap-2">
                                        <MdReceiptLong className="text-orange-600" size={16} /> Enquiry Items
                                    </h3>
                                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {viewModal.data.items?.map((item, idx) => (
                                            <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-xs font-black text-slate-900">{item.productName || item.productId?.productName || 'Unnamed Product'}</h4>
                                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                                                                (item.itemCategory === 'Manual' || item.isManual)
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                            }`}>
                                                                {item.itemCategory || (item.isManual ? 'Manual' : 'Added')}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-500 mt-1">Qty: {item.quantity} {item.uom}</p>
                                                    </div>
                                                    <ActionStatusPill status={item.actionStatus} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-[10px] font-medium border-t border-slate-200/60 pt-2">
                                                    <div>
                                                        <span className="text-slate-400 block">Final Vendor Selection</span>
                                                        <span className="text-emerald-700 font-bold">{item.finalVendor?.name || 'Pending Selection'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 block">Assigned Salesman</span>
                                                        <span className="text-slate-700 font-bold">{item.salespersonName || 'Unassigned'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col max-h-[85vh]">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3 mb-4 flex items-center gap-2">
                                        <MdStar className="text-purple-600" size={16} /> Follow-Up Logs & Add Entry
                                    </h3>

                                    <form onSubmit={handleAddFollowUp} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3 mb-4">
                                        <div className="flex gap-2">
                                            <select
                                                value={newActionType}
                                                onChange={(e) => setNewActionType(e.target.value)}
                                                className="px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700"
                                            >
                                                <option value="Call">Call</option>
                                                <option value="Email">Email</option>
                                                <option value="Visit">Visit</option>
                                                <option value="Meeting">Meeting</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="What was discussed with the client?"
                                                value={newNote}
                                                onChange={(e) => setNewNote(e.target.value)}
                                                className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700"
                                                required
                                            />
                                            <button
                                                type="submit"
                                                disabled={addingFollowUp}
                                                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-700 transition-all shadow-md shadow-primary-600/10"
                                            >
                                                {addingFollowUp ? 'Adding...' : 'Add'}
                                            </button>
                                        </div>
                                    </form>

                                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 max-h-[35vh]">
                                        {(!viewModal.data.followUpHistory || viewModal.data.followUpHistory.length === 0) ? (
                                            <p className="text-xs font-bold text-slate-400 bg-slate-50/50 p-4 rounded-2xl border border-dashed border-slate-200 text-center">No follow-up entries recorded yet.</p>
                                        ) : (
                                            viewModal.data.followUpHistory.slice().reverse().map((log, idx) => (
                                                <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="px-2 py-0.5 bg-white text-[9px] font-black text-slate-600 rounded-md border border-slate-100 uppercase tracking-wider">{log.actionType}</span>
                                                        <span className="text-[9px] font-bold text-slate-400">{new Date(log.date).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-700 font-bold leading-relaxed">{log.note}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Enquiries;
