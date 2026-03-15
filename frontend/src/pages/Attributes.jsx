import React, { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdArrowBack } from 'react-icons/md';
import { toast } from 'react-toastify';
import { mgrService, attributeService } from '../services/api';
import Modal from '../components/Modal';
import { useNavigate } from 'react-router-dom';

const Attributes = () => {
    const navigate = useNavigate();
    const [mgr3s, setMgr3s] = useState([]);
    const [selectedMgr3, setSelectedMgr3] = useState('');
    const [attributes, setAttributes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mgr3Loading, setMgr3Loading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAttribute, setEditingAttribute] = useState(null);

    const [formData, setFormData] = useState({
        code: '',
        description: '',
        status: 'Active'
    });

    useEffect(() => {
        fetchMGR3s();
    }, []);

    useEffect(() => {
        if (selectedMgr3) {
            fetchAttributes();
        } else {
            setAttributes([]);
        }
    }, [selectedMgr3]);

    const fetchMGR3s = async () => {
        try {
            const res = await mgrService.getAll('MGR3');
            setMgr3s(res.data);
            if (res.data.length > 0) {
                setSelectedMgr3(res.data[0]._id);
            }
        } catch (err) {
            toast.error('Failed to load MGR3 categories');
        } finally {
            setMgr3Loading(false);
        }
    };

    const fetchAttributes = async () => {
        setLoading(true);
        try {
            const res = await attributeService.getByMGR3(selectedMgr3);
            setAttributes(res.data);
        } catch (err) {
            toast.error('Failed to load attributes');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (attr = null) => {
        if (attr) {
            setEditingAttribute(attr);
            setFormData({
                code: attr.code,
                description: attr.description,
                status: attr.status
            });
        } else {
            setEditingAttribute(null);
            setFormData({
                code: '',
                description: '',
                status: 'Active'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedMgr3) {
            toast.error('Please select an MGR3 first');
            return;
        }

        if (!formData.code.trim() || !formData.description.trim()) {
            toast.error('Code and Description are required');
            return;
        }

        try {
            if (editingAttribute) {
                await attributeService.update(editingAttribute._id, formData);
                toast.success('Attribute updated successfully');
            } else {
                await attributeService.create({ ...formData, mgr3Id: selectedMgr3 });
                toast.success('Attribute created successfully');
            }
            fetchAttributes();
            setIsModalOpen(false);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving attribute');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this attribute?')) {
            try {
                await attributeService.delete(id);
                toast.success('Deleted successfully');
                fetchAttributes();
            } catch (err) {
                toast.error('Failed to delete attribute');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/mgr-master')}
                        className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-600"
                    >
                        <MdArrowBack size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Attributes Master</h1>
                        <p className="text-slate-500 font-medium">Manage attributes for MGR3 categories.</p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    disabled={!selectedMgr3}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdAdd size={20} />
                    <span>Add Attribute</span>
                </button>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 bg-slate-50 border-b border-slate-100">
                    <div className="max-w-xs space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select MGR 3 Category</label>
                        <select
                            value={selectedMgr3}
                            onChange={(e) => setSelectedMgr3(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Select MGR3</option>
                            {mgr3s.map(mgr => (
                                <option key={mgr._id} value={mgr._id}>{mgr.description} ({mgr.code})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="py-20 text-center">
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
                                    {attributes.map(attr => (
                                        <tr key={attr._id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-sm font-bold text-slate-800">{attr.code}</td>
                                            <td className="p-4 text-sm font-medium text-slate-600">{attr.description}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${attr.status === 'Active'
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                        : 'bg-rose-50 text-rose-600 border-rose-200'
                                                    }`}>
                                                    {attr.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(attr)}
                                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                    >
                                                        <MdEdit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(attr._id)}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    >
                                                        <MdDelete size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {attributes.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-400 text-sm font-medium">
                                                {selectedMgr3 ? "No attributes found for this MGR3." : "Please select an MGR3 category."}
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
                title={editingAttribute ? "Edit Attribute" : "Add Attribute"}
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
                            {editingAttribute ? "Update" : "Save"}
                        </button>
                    </>
                }
            >
                <form className="space-y-4 py-2">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Attribute Name / Code <span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold uppercase transition-all"
                            placeholder="e.g. BRAND"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description <span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium transition-all"
                            placeholder="e.g. Product Brand"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                        <div className="flex gap-4">
                            {['Active', 'Inactive'].map((st) => (
                                <label key={st} className="flex-1 flex items-center justify-center gap-2 cursor-pointer group bg-slate-50 py-3 rounded-2xl border border-slate-200 transition-all has-[:checked]:bg-primary-50 has-[:checked]:border-primary-200">
                                    <input
                                        type="radio"
                                        name="status"
                                        value={st}
                                        checked={formData.status === st}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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

export default Attributes;
