import React, { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdArrowBack, MdFileUpload } from 'react-icons/md';

import { toast } from 'react-toastify';
import { mgrService, attributeService, importService } from '../services/api';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';

import { useNavigate, useParams } from 'react-router-dom';

const Attributes = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const [mgr3s, setMgr3s] = useState([]);
    const [selectedMgr3, setSelectedMgr3] = useState('');
    const [attributes, setAttributes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mgr3Loading, setMgr3Loading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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

    useEffect(() => {
        if (isCreatePage) {
            setEditingAttribute(null);
            setFormData({ code: '', description: '', status: 'Active' });
            setIsModalOpen(true);
        } else if (isEditPage && routeId) {
            setIsModalOpen(true);
            const found = attributes.find(a => a._id === routeId);
            if (found) {
                setEditingAttribute(found);
                setFormData({
                    code: found.code,
                    description: found.description,
                    status: found.status
                });
            } else if (selectedMgr3) {
                attributeService.getByMGR3(selectedMgr3).then(res => {
                    const list = res.data || [];
                    const item = list.find(a => a._id === routeId);
                    if (item) {
                        setEditingAttribute(item);
                        setFormData({
                            code: item.code,
                            description: item.description,
                            status: item.status
                        });
                    }
                }).catch(err => console.error("Failed to load attribute", err));
            }
        }
    }, [isCreatePage, isEditPage, routeId, attributes, selectedMgr3]);

    const handleOpenModal = (attr = null) => {
        if (attr) {
            navigate(`/attributes/edit/${attr._id}`);
        } else {
            navigate('/attributes/new');
        }
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
            navigate('/attributes');
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

    const [searchTerm, setSearchTerm] = useState('');

    const filteredAttributes = attributes.filter(attr => 
        attr.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attr.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {!(isModalOpen || isCreatePage || isEditPage) ? (
                <>
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
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdFileUpload size={20} />
                        <span>Upload</span>
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        disabled={!selectedMgr3}
                        className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                    >
                        <MdAdd size={20} />
                        <span>Add Attribute</span>
                    </button>
                </div>
            </div>


            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center">
                    <div className="max-w-xs w-full space-y-2">
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
                    
                    {selectedMgr3 && (
                        <div className="flex-1 w-full space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Search Attributes</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    placeholder="Search by Code or Description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium transition-all"
                                />
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    )}
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
                                    {filteredAttributes.map(attr => (
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
                                    {filteredAttributes.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-slate-400 text-sm font-medium">
                                                {selectedMgr3 ? "No attributes found matching your search." : "Please select an MGR3 category."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
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
                                    onClick={() => { setIsModalOpen(false); navigate('/attributes'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingAttribute ? "Edit Attribute" : "Add Attribute"}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingAttribute ? `Update details for ${editingAttribute.code}` : 'Add a new attribute definition'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/attributes'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    {editingAttribute ? "Update" : "Save"}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Attribute Name / Code <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold uppercase transition-all"
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
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-medium transition-all"
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
                        </div>
                </div>
            )}

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Attributes Master"
                type="attribute-master"
                onImport={async (file) => {
                    const result = await importService.importAttributeMaster(file, selectedMgr3);
                    if (selectedMgr3) {
                        fetchAttributes();
                    }
                    return result;
                }}
                onDownloadTemplate={importService.getAttributeMasterTemplate}
            />

        </div>
    );
};

export default Attributes;
