import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdEmail, MdPhone, MdEdit, MdAdd, MdLocationOn, MdClose, MdArrowBack } from 'react-icons/md';
import PaginationControls from '../components/PaginationControls';
import { salespersonService, territoryService } from '../services/api';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';

const LIST_PAGE_SIZE = 20;

const Salespersons = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const [salespersons, setSalespersons] = useState([]);
    const [territories, setTerritories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });

    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [editingSalesperson, setEditingSalesperson] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile: '',
        territoryId: '',
        status: 'Active'
    });

    useEffect(() => {
        fetchSalespersons();
    }, [page]);

    useEffect(() => {
        fetchTerritories();
    }, []);

    const fetchSalespersons = async () => {
        try {
            const res = await salespersonService.getAll({ page, limit: LIST_PAGE_SIZE });
            const payload = res.data;
            setSalespersons(Array.isArray(payload) ? payload : payload.data || []);
            setPagination(payload.pagination || {
                page: 1,
                limit: LIST_PAGE_SIZE,
                total: Array.isArray(payload) ? payload.length : 0,
                pages: 1
            });
        } catch (err) {
            console.error('Failed to fetch salespersons:', err);
            toast.error('Failed to load salespersons');
        } finally {
            setLoading(false);
        }
    };

    const fetchTerritories = async () => {
        try {
            const res = await territoryService.getAll();
            setTerritories(res.data || []);
        } catch (err) {
            console.error('Failed to fetch territories:', err);
        }
    };

    useEffect(() => {
        if (isCreatePage) {
            setEditingSalesperson(null);
            setFormData({
                name: '',
                email: '',
                mobile: '',
                territoryId: '',
                status: 'Active'
            });
            setShowModal(true);
        } else if (isEditPage && routeId) {
            setShowModal(true);
            const found = salespersons.find(sp => sp._id === routeId);
            if (found) {
                setEditingSalesperson(found);
                setFormData({
                    name: found.name || '',
                    email: found.email || '',
                    mobile: found.mobile || '',
                    territoryId: found.territoryId?._id || found.territoryId || '',
                    status: found.status || 'Active'
                });
            } else {
                salespersonService.getAll({ limit: 1000 }).then(res => {
                    const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
                    const item = list.find(sp => sp._id === routeId);
                    if (item) {
                        setEditingSalesperson(item);
                        setFormData({
                            name: item.name || '',
                            email: item.email || '',
                            mobile: item.mobile || '',
                            territoryId: item.territoryId?._id || item.territoryId || '',
                            status: item.status || 'Active'
                        });
                    }
                }).catch(err => console.error("Failed to load salesperson", err));
            }
        }
    }, [isCreatePage, isEditPage, routeId, salespersons]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Name is required');
            return;
        }

        try {
            if (editingSalesperson) {
                await salespersonService.update(editingSalesperson._id, formData);
                toast.success('Salesperson updated successfully!');
            } else {
                await salespersonService.create(formData);
                toast.success('Salesperson created successfully!');
            }
            setShowModal(false);
            fetchSalespersons();
            navigate('/salespersons');
        } catch (err) {
            console.error('Failed to save salesperson:', err);
            toast.error(err.response?.data?.message || 'Error saving salesperson');
        }
    };

    return (
        <div className="space-y-6">
            {!(showModal || isCreatePage || isEditPage) ? (
                <>
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">
                        Salesperson Master
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Manage sales staff, profiles, and their territory mapping.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/salespersons/new')}
                    className="flex items-center gap-2 px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-lg shadow-primary-600/20 active:scale-95 self-start md:self-auto animate-fade-in-up"
                >
                    <MdAdd size={18} />
                    New Salesperson
                </button>
            </div>

            {/* Grid display */}
            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden p-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading...</p>
                    </div>
                ) : salespersons.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <p className="text-lg font-bold">No salespersons configured yet.</p>
                        <p className="text-sm">Click "New Salesperson" to get started.</p>
                    </div>
                ) : (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {salespersons.map(user => (
                            <div key={user._id} className="mobile-master-card p-6 border border-slate-100 rounded-2xl flex items-start gap-4 hover:shadow-md transition-shadow relative bg-white">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 ${user.role === 'admin' ? 'bg-primary-700' : 'bg-primary-600'}`}>
                                    {user.name ? user.name.charAt(0).toUpperCase() : 'S'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-900 truncate pr-8">{user.name}</h3>
                                    
                                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                                        <div className="flex items-center gap-1.5 truncate">
                                            <MdEmail size={14} className="text-slate-400" /> {user.email || 'No email'}
                                        </div>
                                        {user.mobile && (
                                            <div className="flex items-center gap-1.5">
                                                <MdPhone size={14} className="text-slate-400" /> {user.mobile}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 text-primary-600 font-bold mt-1.5">
                                            <MdLocationOn size={14} /> 
                                            <span className="truncate">Territory: {user.territoryId?.name || 'Unmapped'}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mt-3">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${user.role === 'admin' ? 'bg-primary-100 text-primary-800' : 'bg-primary-50 text-primary-600'}`}>
                                            {user.role || 'Sales'}
                                        </span>
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${user.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                            {user.status || 'Active'}
                                        </span>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => navigate(`/salespersons/edit/${user._id}`)}
                                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                                    title="Edit Salesperson"
                                >
                                    <MdEdit size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <PaginationControls pagination={pagination} onPageChange={setPage} className="-mx-6 mt-6 mb-[-1.5rem]" />
                    </>
                )}
            </div>
            </>
            ) : (
                <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
                        {/* Header bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); navigate('/salespersons'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingSalesperson ? 'Edit Salesperson' : 'Create Salesperson'}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingSalesperson ? `Update details for ${editingSalesperson.name}` : 'Add a new sales team member profile'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); navigate('/salespersons'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="salesperson-form"
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    {editingSalesperson ? 'Save Changes' : 'Create'}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form id="salesperson-form" onSubmit={handleFormSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Full Name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</label>
                                        <input
                                            type="email"
                                            placeholder="Email Address"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile</label>
                                        <input
                                            type="text"
                                            placeholder="Mobile number"
                                            value={formData.mobile}
                                            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assign Territory</label>
                                        <select
                                            value={formData.territoryId}
                                            onChange={(e) => setFormData({ ...formData, territoryId: e.target.value })}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                        >
                                            <option value="">Select Territory (Unmapped)</option>
                                            {territories.map(t => (
                                                <option key={t._id} value={t._id}>{t.name} ({t.type})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                            </form>
                        </div>
                </div>
            )}
        </div>
    );
};

export default Salespersons;
