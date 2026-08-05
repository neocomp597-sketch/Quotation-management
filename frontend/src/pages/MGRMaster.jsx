import React, { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdArrowBack } from 'react-icons/md';
import { toast } from 'react-toastify';
import { mgrService } from '../services/api';
import Modal from '../components/Modal';
import PaginationControls from '../components/PaginationControls';
import { useNavigate, useParams } from 'react-router-dom';

const LIST_PAGE_SIZE = 20;

const MGRMaster = ({ isCreatePage = false, isEditPage = false }) => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [mgrs, setMgrs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('MGR1');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMGR, setEditingMGR] = useState(null);

    const [formData, setFormData] = useState({
        code: '',
        description: '',
        status: 'Active'
    });

    useEffect(() => {
        if (isEditPage && id) {
            mgrService.getById(id).then(res => {
                const item = res.data;
                if (item) {
                    setEditingMGR(item);
                    setFormData({
                        code: item.code || '',
                        description: item.description || '',
                        status: item.status || 'Active'
                    });
                    if (item.mgrType) setActiveTab(item.mgrType);
                }
            }).catch(err => {
                console.error("Error fetching MGR detail:", err);
                toast.error('Failed to load item details');
            });
        }
    }, [isEditPage, id]);

    useEffect(() => {
        setPage(1);
    }, [activeTab]);

    useEffect(() => {
        fetchMGRs();
    }, [activeTab, page]);

    const pagedMGRs = mgrs;

    const fetchMGRs = async () => {
        setLoading(true);
        try {
            const res = await mgrService.getAll(activeTab, { page, limit: LIST_PAGE_SIZE });
            const payload = res.data;
            setMgrs(Array.isArray(payload) ? payload : payload.data || []);
            setPagination(payload.pagination || {
                page: 1,
                limit: LIST_PAGE_SIZE,
                total: Array.isArray(payload) ? payload.length : 0,
                pages: 1
            });
        } catch (err) {
            console.error("Error fetching MGRs:", err);
            toast.error('Failed to load MGRs');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (mgr = null) => {
        if (mgr) {
            setEditingMGR(mgr);
            setFormData({
                code: mgr.code,
                description: mgr.description,
                status: mgr.status
            });
        } else {
            setEditingMGR(null);
            setFormData({
                code: '',
                description: '',
                status: 'Active'
            });
        }
        setIsModalOpen(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.code?.trim() || !formData.description?.trim()) {
            toast.error('Code and Description are required');
            return;
        }

        const payload = {
            ...formData,
            mgrType: activeTab
        };

        try {
            const targetId = editingMGR?._id || (isEditPage ? id : null);
            if (targetId) {
                await mgrService.update(targetId, payload);
                toast.success(`${activeTab} updated successfully!`);
            } else {
                await mgrService.create(payload);
                toast.success(`${activeTab} created successfully!`);
            }
            if (isCreatePage || isEditPage) {
                navigate('/mgrs');
            } else {
                fetchMGRs();
                setIsModalOpen(false);
            }
        } catch (err) {
            console.error("Error saving MGR:", err);
            toast.error(err.response?.data?.message || 'Error saving data');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this specific MGR?")) {
            try {
                await mgrService.delete(id);
                toast.success('Deleted successfully!');
                fetchMGRs();
            } catch (err) {
                console.error("Error deleting MGR:", err);
                toast.error('Failed to delete');
            }
        }
    };

    const toggleStatus = async (mgr) => {
        try {
            const newStatus = mgr.status === 'Active' ? 'Inactive' : 'Active';
            await mgrService.update(mgr._id, { status: newStatus });
            toast.success(`Status updated to ${newStatus}`);
            fetchMGRs();
        } catch (err) {
            console.error("Error toggling status:", err);
            toast.error('Failed to update status');
        }
    };

    return (
        <div className="space-y-6">
            {!(isModalOpen || isCreatePage || isEditPage) ? (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">MGR Master</h1>
                    <p className="text-slate-500 font-medium">Manage MGRs for product grouping.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/attributes')}
                        className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-slate-900/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <span>Attributes</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add {activeTab}</span>
                    </button>
                </div>
            </div>

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="mobile-master-toolbar p-4 border-b border-slate-100 flex flex-wrap gap-2 bg-slate-50">
                    {['MGR1', 'MGR2', 'MGR3', 'MGR4', 'MGR5'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${activeTab === tab
                                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                                    : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="py-20 text-center text-slate-400 font-medium">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                            <p className="text-xs uppercase font-black tracking-widest">Loading...</p>
                        </div>
                    ) : (
                        <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 rounded-xl">
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest first:rounded-l-xl">Code</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Description</th>
                                        {activeTab === 'MGR3' && <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Attributes</th>}
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right last:rounded-r-xl">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedMGRs.map(mgr => (
                                        <tr key={mgr._id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-sm font-bold text-slate-800">{mgr.code}</td>
                                            <td className="p-4 text-sm font-medium text-slate-600">{mgr.description}</td>
                                            {activeTab === 'MGR3' && (
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => navigate('/attributes')}
                                                        className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 hover:underline"
                                                    >
                                                        Manage
                                                    </button>
                                                </td>
                                            )}
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => toggleStatus(mgr)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${mgr.status === 'Active'
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                                            : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                                        }`}
                                                >
                                                    {mgr.status}
                                                </button>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(mgr)}
                                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                        title="Edit"
                                                    >
                                                        <MdEdit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(mgr._id)}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                        title="Delete"
                                                    >
                                                        <MdDelete size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {mgrs.length === 0 && (
                                        <tr>
                                            <td colSpan={activeTab === 'MGR3' ? 5 : 4} className="p-8 text-center text-slate-400 text-sm font-medium">
                                                No {activeTab} items found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls pagination={pagination} onPageChange={setPage} />
                        </>
                    )}
                </div>
            </div>
            </>
            ) : (
                <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
                        {/* Header bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/mgrs'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingMGR ? `Edit ${activeTab}` : `Add ${activeTab}`}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingMGR ? `Update parameters for ${editingMGR.code}` : `Create a new ${activeTab} item`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/mgrs'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    {editingMGR ? "Update" : "Save"}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Code <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold uppercase transition-all"
                                        placeholder="e.g. DKT"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium transition-all"
                                        placeholder="e.g. Desktop"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                                    <div className="flex gap-4 p-1">
                                        {['Active', 'Inactive'].map((st) => (
                                            <label key={st} className="flex-1 flex items-center justify-center gap-2 cursor-pointer group bg-slate-50 py-3.5 rounded-2xl border border-slate-200 transition-all has-[:checked]:bg-primary-50 has-[:checked]:border-primary-200">
                                                <input
                                                    type="radio"
                                                    name="status"
                                                    value={st}
                                                    checked={formData.status === st}
                                                    onChange={handleFormChange}
                                                    className="sr-only"
                                                />
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${formData.status === st ? 'text-primary-600' : 'text-slate-400'}`}>{st}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </div>
                </div>
            )}
        </div>
    );
};

export default MGRMaster;
