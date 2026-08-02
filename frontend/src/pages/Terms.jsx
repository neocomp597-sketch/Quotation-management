import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdAdd, MdEdit, MdDelete, MdDescription, MdCheckCircle, MdArrowBack } from 'react-icons/md';
import { toast } from 'react-toastify';
import { termsService } from '../services/api';
import Modal from '../components/Modal';
import PaginationControls from '../components/PaginationControls';
import { formatDate } from '../utils/helpers';

const LIST_PAGE_SIZE = 20;

const Terms = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, limit: LIST_PAGE_SIZE, total: 0, pages: 1 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [formData, setFormData] = useState({
        templateName: '',
        content: '',
        isDefault: false
    });

    const defaultContent = `Mandatory Terms & Conditions
1. Quotation Validity: Valid for 30 days.
2. PO Issuance: Must be issued within validity period by authorized person.
3. Price Validity: Agreed rate valid for 6 months.
4. Price Escalation: 6% increase if not lifted within validity.
5. Delivery Schedule: Within 6 months from PO. Reschedule with 15 days notice.
6. Terms of Supply: Goods delivered at site by authorized dealers.
7. Terms of Payment: 100% advance with PO.
8. Communication: All in writing to Project Head.
9. Modification: Modified products may be provided.
10. Product Discontinuance: 6 months to order discontinued products.
11. Warranty: Covered under company policy.
12. Installation: Authorized service provider only.`;

    const pagedTemplates = templates;

    useEffect(() => {
        fetchTemplates();
    }, [page]);

    useEffect(() => {
        if (isCreatePage) {
            setEditingTemplate(null);
            setFormData({
                templateName: '',
                content: defaultContent,
                isDefault: false
            });
            setIsModalOpen(true);
        } else if (isEditPage && routeId) {
            setIsModalOpen(true);
            const found = templates.find(t => t._id === routeId);
            if (found) {
                setEditingTemplate(found);
                setFormData({
                    templateName: found.templateName,
                    content: found.content,
                    isDefault: found.isDefault
                });
            } else {
                termsService.getAll({ limit: 1000 }).then(res => {
                    const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
                    const item = list.find(t => t._id === routeId);
                    if (item) {
                        setEditingTemplate(item);
                        setFormData({
                            templateName: item.templateName,
                            content: item.content,
                            isDefault: item.isDefault
                        });
                    }
                }).catch(err => console.error("Failed to load terms template", err));
            }
        }
    }, [isCreatePage, isEditPage, routeId, templates]);

    const fetchTemplates = async () => {
        try {
            const res = await termsService.getAll({ page, limit: LIST_PAGE_SIZE });
            const payload = res.data;
            setTemplates(Array.isArray(payload) ? payload : payload.data || []);
            setPagination(payload.pagination || {
                page: 1,
                limit: LIST_PAGE_SIZE,
                total: Array.isArray(payload) ? payload.length : 0,
                pages: 1
            });
        } catch (err) {
            console.error("Error fetching terms templates:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (template = null) => {
        if (template) {
            navigate(`/terms/edit/${template._id}`);
        } else {
            navigate('/terms/new');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.templateName?.trim()) {
            toast.error('Template Name is required');
            return;
        }
        if (!formData.content?.trim()) {
            toast.error('Terms Content is required');
            return;
        }

        try {
            if (editingTemplate) {
                await termsService.update(editingTemplate._id, formData);
                toast.success('Template updated successfully!');
            } else {
                await termsService.create(formData);
                toast.success('Template created successfully!');
            }
            fetchTemplates();
            setIsModalOpen(false);
            navigate('/terms');
        } catch (err) {
            console.error("Error saving template:", err);
            toast.error(err.response?.data?.message || 'Error saving template');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this template?")) {
            try {
                await termsService.delete(id);
                toast.success('Template deleted successfully!');
                fetchTemplates();
            } catch (err) {
                console.error("Error deleting template:", err);
                toast.error('Failed to delete template');
            }
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            {!(isModalOpen || isCreatePage || isEditPage) ? (
                <>
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Terms & Conditions</h1>
                    <p className="text-slate-500 font-medium">Manage legal templates for reliable quotations.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdAdd size={20} />
                    <span>New Template</span>
                </button>
            </div>

            {loading ? (
                <div className="p-20 text-center text-slate-400 font-medium">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                    <p className="text-xs uppercase font-black tracking-widest">Loading Templates...</p>
                </div>
            ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pagedTemplates.map((t) => (
                        <div key={t._id} className="mobile-master-card bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 hover:shadow-xl transition-all group relative overflow-hidden flex flex-col">
                            {t.isDefault && (
                                <div className="absolute top-0 right-0 bg-emerald-50 text-emerald-600 px-4 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest border-b border-l border-emerald-100">
                                    Default
                                </div>
                            )}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-primary-50 text-primary-600 rounded-2xl">
                                    <MdDescription size={24} />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 leading-tight">{t.templateName}</h3>
                            </div>

                            <div className="flex-1 bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
                                <p className="text-xs text-slate-500 font-mono whitespace-pre-wrap line-clamp-6 leading-relaxed">
                                    {t.content}
                                </p>
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                    {formatDate(t.createdAt)}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleOpenModal(t)}
                                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                        title="Edit Template"
                                    >
                                        <MdEdit size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(t._id)}
                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                                        title="Delete Template"
                                    >
                                        <MdDelete size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <PaginationControls pagination={pagination} onPageChange={setPage} />
                </>
            )}
            </>
            ) : (
                <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
                        {/* Header bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/terms'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingTemplate ? "Edit Template" : "Draft New Template"}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingTemplate ? `Update parameters for ${editingTemplate.templateName}` : 'Create a new quotation terms & conditions template'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/terms'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    {editingTemplate ? "Update Template" : "Save Template"}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Template Name <span className="text-rose-500">*</span></label>
                                        <input
                                            type="text"
                                            value={formData.templateName}
                                            onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                            placeholder="e.g. Standard Terms 2024"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2 flex flex-col justify-end pb-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-12 h-6 md:w-14 md:h-8 flex items-center bg-slate-200 rounded-full p-1 transition-colors duration-300 ${formData.isDefault ? 'bg-emerald-500' : ''}`}>
                                                <div className={`bg-white w-4 h-4 md:w-6 md:h-6 rounded-full shadow-md transform duration-300 ${formData.isDefault ? 'translate-x-6' : ''}`}></div>
                                            </div>
                                            <span className="text-sm font-bold text-slate-600 group-hover:text-emerald-600 transition-colors">Set as Default Template</span>
                                            <input
                                                type="checkbox"
                                                checked={formData.isDefault}
                                                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terms Content <span className="text-rose-500">*</span></label>
                                    <textarea
                                        value={formData.content}
                                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-xs font-mono leading-relaxed h-64 md:h-96 resize-none"
                                        placeholder="Enter the detailed terms and conditions here..."
                                        required
                                    />
                                </div>
                            </form>
                        </div>
                </div>
            )}
        </div>
    );
};

export default Terms;
