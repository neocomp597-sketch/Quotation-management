import React, { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdSync } from 'react-icons/md';
import { toast } from 'react-toastify';
import { mgrService } from '../services/api';
import Modal from '../components/Modal';

const MGRMaster = () => {
    const [mgrs, setMgrs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('MGR1');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMGR, setEditingMGR] = useState(null);

    const [formData, setFormData] = useState({
        code: '',
        description: '',
        status: 'Active'
    });

    useEffect(() => {
        fetchMGRs();
    }, [activeTab]);

    const fetchMGRs = async () => {
        setLoading(true);
        try {
            const res = await mgrService.getAll(activeTab);
            setMgrs(res.data);
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
            if (editingMGR) {
                await mgrService.update(editingMGR._id, payload);
                toast.success(`${activeTab} updated successfully!`);
            } else {
                await mgrService.create(payload);
                toast.success(`${activeTab} created successfully!`);
            }
            fetchMGRs();
            setIsModalOpen(false);
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">MGR Master</h1>
                    <p className="text-slate-500 font-medium">Manage MGRs for product grouping.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add {activeTab}</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 bg-slate-50">
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
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 rounded-xl">
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest first:rounded-l-xl">Code</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Description</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right last:rounded-r-xl">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mgrs.map(mgr => (
                                        <tr key={mgr._id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-sm font-bold text-slate-800">{mgr.code}</td>
                                            <td className="p-4 text-sm font-medium text-slate-600">{mgr.description}</td>
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
                                            <td colSpan={4} className="p-8 text-center text-slate-400 text-sm font-medium">
                                                No {activeTab} items found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingMGR ? `Edit ${activeTab}` : `Add ${activeTab}`}
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2.5 text-slate-500 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-[10px] tracking-widest"
                        >
                            {editingMGR ? "Update" : "Save"}
                        </button>
                    </>
                }
            >
                <form className="space-y-4 py-2">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Code <span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            name="code"
                            value={formData.code}
                            onChange={handleFormChange}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold uppercase transition-all"
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
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium transition-all"
                            placeholder="e.g. Desktop"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                        <div className="flex gap-4 p-1">
                            {['Active', 'Inactive'].map((st) => (
                                <label key={st} className="flex-1 flex items-center justify-center gap-2 cursor-pointer group bg-slate-50 py-3 rounded-2xl border border-slate-200 transition-all has-[:checked]:bg-primary-50 has-[:checked]:border-primary-200">
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
            </Modal>
        </div>
    );
};

export default MGRMaster;
