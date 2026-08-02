import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdAdd, MdEdit, MdDelete, MdArrowBack } from 'react-icons/md';
import { toast } from 'react-toastify';
import { statusService } from '../services/api';
import Modal from '../components/Modal';
import PaginationControls from '../components/PaginationControls';

const LIST_PAGE_SIZE = 20;

const StatusMaster = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStatus, setEditingStatus] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        isActive: true
    });

    const pagedStatuses = statuses;

    useEffect(() => {
        fetchStatuses();
    }, [page]);

    const fetchStatuses = async () => {
        setLoading(true);
        try {
            const res = await statusService.getAll({ page, limit: LIST_PAGE_SIZE });
            const payload = res.data;
            setStatuses(Array.isArray(payload) ? payload : payload.data || []);
            setPagination(payload.pagination || {
                page: 1,
                limit: LIST_PAGE_SIZE,
                total: Array.isArray(payload) ? payload.length : 0,
                pages: 1
            });
        } catch (err) {
            console.error("Error fetching statuses:", err);
            toast.error('Failed to load statuses');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isCreatePage) {
            setEditingStatus(null);
            setFormData({ name: '', isActive: true });
            setIsModalOpen(true);
        } else if (isEditPage && routeId) {
            setIsModalOpen(true);
            const found = statuses.find(s => s._id === routeId);
            if (found) {
                setEditingStatus(found);
                setFormData({
                    name: found.name,
                    isActive: found.isActive
                });
            } else {
                statusService.getAll({ limit: 1000 }).then(res => {
                    const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
                    const item = list.find(s => s._id === routeId);
                    if (item) {
                        setEditingStatus(item);
                        setFormData({
                            name: item.name,
                            isActive: item.isActive
                        });
                    }
                }).catch(err => console.error("Failed to load status", err));
            }
        }
    }, [isCreatePage, isEditPage, routeId, statuses]);

    const handleOpenModal = (status = null) => {
        if (status) {
            navigate(`/status-master/edit/${status._id}`);
        } else {
            navigate('/status-master/new');
        }
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? checked : value 
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name?.trim()) {
            toast.error('Status name is required');
            return;
        }

        try {
            if (editingStatus) {
                await statusService.update(editingStatus._id, formData);
                toast.success(`Status updated successfully!`);
            } else {
                await statusService.create(formData);
                toast.success(`Status created successfully!`);
            }
            fetchStatuses();
            setIsModalOpen(false);
            navigate('/status-master');
        } catch (err) {
            console.error("Error saving status:", err);
            toast.error(err.response?.data?.message || 'Error saving data');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this status? Existing records using this status might be affected.")) {
            try {
                await statusService.delete(id);
                toast.success('Deleted successfully!');
                fetchStatuses();
            } catch (err) {
                console.error("Error deleting status:", err);
                toast.error('Failed to delete');
            }
        }
    };

    return (
        <div className="space-y-6">
            {!(isModalOpen || isCreatePage || isEditPage) ? (
                <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Status Master</h1>
                    <p className="text-slate-500 font-medium">Manage statuses for planning and tracking.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdAdd size={20} />
                    <span>Add Status</span>
                </button>
            </div>

            <div className="mobile-master-shell bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
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
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest first:rounded-l-xl">Status Name</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Is Active</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right last:rounded-r-xl">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedStatuses.map(status => (
                                        <tr key={status._id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4">
                                                <span className="text-sm font-bold text-slate-800">{status.name}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${status.isActive
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                        : 'bg-rose-50 text-rose-600 border-rose-200'
                                                    }`}>
                                                    {status.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(status)}
                                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                        title="Edit"
                                                    >
                                                        <MdEdit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(status._id)}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                        title="Delete"
                                                    >
                                                        <MdDelete size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {statuses.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-slate-400 text-sm font-medium">
                                                No statuses found.
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
                                    onClick={() => { setIsModalOpen(false); navigate('/status-master'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingStatus ? "Edit Status" : "Add Status"}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingStatus ? `Update parameters for ${editingStatus.name}` : 'Create a new quotation status entry'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/status-master'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    {editingStatus ? "Update" : "Save"}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Name <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold transition-all"
                                        placeholder="e.g. In Progress"
                                        required
                                    />
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${formData.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Active Status</span>
                                </div>
                            </form>
                        </div>
                </div>
            )}
        </div>
    );
};

export default StatusMaster;
