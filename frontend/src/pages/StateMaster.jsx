import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { stateMasterService } from '../services/api';
import { toast } from 'react-toastify';
import { MdMap, MdAdd, MdSearch, MdEdit, MdDelete, MdArrowBack } from 'react-icons/md';

const StateMaster = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();

    const [states, setStates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingState, setEditingState] = useState(null);
    const [formData, setFormData] = useState({
        state: '',
        shortCode: '',
        status: 'Active'
    });

    useEffect(() => {
        fetchStates();
    }, []);

    const fetchStates = async () => {
        try {
            setLoading(true);
            const res = await stateMasterService.getAll();
            const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setStates(list);
        } catch (error) {
            console.error('Failed to fetch states:', error);
            toast.error('Failed to load State Master data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isCreatePage) {
            setEditingState(null);
            setFormData({ state: '', shortCode: '', status: 'Active' });
            setShowModal(true);
        } else if (isEditPage && routeId) {
            setShowModal(true);
            const found = states.find(s => s._id === routeId);
            if (found) {
                setEditingState(found);
                setFormData({
                    state: found.state || '',
                    shortCode: found.shortCode || '',
                    status: found.status || 'Active'
                });
            } else {
                stateMasterService.getAll().then(res => {
                    const list = res.data?.data || [];
                    const item = list.find(s => s._id === routeId);
                    if (item) {
                        setEditingState(item);
                        setFormData({
                            state: item.state || '',
                            shortCode: item.shortCode || '',
                            status: item.status || 'Active'
                        });
                    }
                }).catch(err => console.error(err));
            }
        }
    }, [isCreatePage, isEditPage, routeId, states]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.state.trim() || !formData.shortCode.trim()) {
            toast.error('State name and Short Code are required');
            return;
        }

        try {
            if (editingState) {
                await stateMasterService.update(editingState._id, formData);
                toast.success('State updated successfully');
            } else {
                await stateMasterService.create(formData);
                toast.success('State created successfully');
            }
            setShowModal(false);
            fetchStates();
            navigate('/state-master');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Save failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this State entry?')) return;
        try {
            await stateMasterService.delete(id);
            toast.success('State deleted successfully');
            fetchStates();
        } catch (error) {
            toast.error('Deletion failed');
        }
    };

    const filteredStates = states.filter(s =>
        s.state?.toLowerCase().includes(search.toLowerCase()) ||
        s.shortCode?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">
                        State Master
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Manage Indian States, Union Territories & 2-Letter Short Codes for Branch Mapping.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/state-master/new')}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3.5 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95 self-start md:self-auto"
                >
                    <MdAdd size={18} />
                    <span>New State Entry</span>
                </button>
            </div>

            {/* Search and Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-6">
                <div className="relative max-w-md">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search state name or short code..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                </div>

                {loading ? (
                    <div className="p-20 text-center text-slate-400 font-medium">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                        <p className="text-xs uppercase font-black tracking-widest">Loading States...</p>
                    </div>
                ) : filteredStates.length === 0 ? (
                    <div className="p-16 text-center text-slate-400">
                        <p className="font-bold text-sm">No State entries found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                    <th className="py-4 px-6">State / Union Territory</th>
                                    <th className="py-4 px-6">Short Code</th>
                                    <th className="py-4 px-6">Status</th>
                                    <th className="py-4 px-6 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm font-semibold">
                                {filteredStates.map((item) => (
                                    <tr key={item._id} className="hover:bg-slate-50/60 transition-all">
                                        <td className="py-4 px-6 font-bold text-slate-900">{item.state}</td>
                                        <td className="py-4 px-6">
                                            <span className="font-mono bg-primary-50 text-primary-700 px-3 py-1 rounded-xl text-xs font-black border border-primary-100">
                                                {item.shortCode}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                                                item.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {item.status || 'Active'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/state-master/edit/${item._id}`)}
                                                    className="p-2 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded-xl transition-all"
                                                    title="Edit State"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item._id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Delete State"
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
                )}
            </div>

            {/* Form Page View */}
            {(showModal || isCreatePage || isEditPage) && (
                <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto p-6 md:p-10 flex flex-col items-center">
                    <div className="max-w-2xl w-full my-2 space-y-6">
                        {/* Header bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); navigate('/state-master'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingState ? 'Edit State Entry' : 'Create State Entry'}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingState ? `Update code mapping for ${editingState.state}` : 'Add a new State & Short Code pair'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); navigate('/state-master'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="state-master-form"
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    {editingState ? 'Save Changes' : 'Create Entry'}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form id="state-master-form" onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">State / Union Territory *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Maharashtra, Gujarat, Delhi"
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Short Code (2-Letter) *</label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={5}
                                            placeholder="e.g. MH, GJ, KA, DL"
                                            value={formData.shortCode}
                                            onChange={(e) => setFormData({ ...formData, shortCode: e.target.value.toUpperCase() })}
                                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-bold"
                                        />
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
                </div>
            )}
        </div>
    );
};

export default StateMaster;
