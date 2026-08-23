import React, { useEffect, useState } from 'react';
import { csmService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { MdBook, MdSearch, MdAdd, MdRemoveRedEye, MdEdit, MdDelete, MdStorage } from 'react-icons/md';
import Modal from '../components/Modal';

const KnowledgeBase = () => {
    const { isAdmin, isSuperAdmin } = useAuth();
    const isExecutive = isAdmin || isSuperAdmin;

    const [loading, setLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [articles, setArticles] = useState([]);
    const [selectedArticle, setSelectedArticle] = useState(null);
    
    // Search states
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    
    // Form Modal states
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ title: '', category: '', content: '' });

    const categories = ['General', 'Warranty Claims', 'Troubleshooting', 'Billing & Invoices', 'Device Reset'];

    const fetchArticles = async (showLoadingSpinner = true) => {
        if (showLoadingSpinner) setLoading(true);
        try {
            const res = await csmService.getArticles({
                search,
                category: selectedCategory
            });
            const data = res.data || [];
            setArticles(data);
            
            // Auto select first article if none selected or if previously selected is not in current list
            if (data.length > 0) {
                const stillExists = selectedArticle ? data.find(a => a._id === selectedArticle._id) : null;
                if (!stillExists) {
                    setSelectedArticle(data[0]);
                }
            } else {
                setSelectedArticle(null);
            }
        } catch (error) {
            toast.error('Failed to load KB articles');
        } finally {
            if (showLoadingSpinner) setLoading(false);
        }
    };

    useEffect(() => {
        fetchArticles();
    }, [selectedCategory, search]);

    useEffect(() => {
        const handleSeeded = () => fetchArticles(false);
        window.addEventListener('onCsmKbSeeded', handleSeeded);
        return () => {
            window.removeEventListener('onCsmKbSeeded', handleSeeded);
        };
    }, []);

    const handleSelectArticle = async (article) => {
        try {
            // Fetch by ID to increment views and get detailed info
            const res = await csmService.getArticleById(article._id);
            setSelectedArticle(res.data);
            
            // Increment local view count for visual feedback
            setArticles(articles.map(a => a._id === article._id ? { ...a, views: a.views + 1 } : a));
        } catch (error) {
            setSelectedArticle(article);
        }
    };

    const handleOpenForm = (art = null) => {
        if (art) {
            setEditId(art._id);
            setFormData({ title: art.title, category: art.category, content: art.content });
        } else {
            setEditId(null);
            setFormData({ title: '', category: 'General', content: '' });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                await csmService.updateArticle(editId, formData);
                toast.success('Article updated successfully');
            } else {
                await csmService.createArticle(formData);
                toast.success('KB article published successfully');
            }
            setShowModal(false);
            fetchArticles(false);
        } catch (error) {
            toast.error('Error saving article');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this troubleshooting article?')) return;
        try {
            await csmService.deleteArticle(id);
            toast.success('Article deleted');
            setSelectedArticle(null);
            fetchArticles(false);
        } catch (error) {
            toast.error('Deletion failed');
        }
    };

    const handleSeedKb = async () => {
        setSeeding(true);
        const toastId = toast.loading("Seeding Knowledge Base with troubleshooting guides...");
        try {
            await csmService.seedKbData();
            toast.update(toastId, { 
                render: "Knowledge Base FAQs seeded successfully!", 
                type: "success", 
                isLoading: false, 
                autoClose: 3000 
            });
            await fetchArticles(false);
        } catch (error) {
            console.error('Seed KB error:', error);
            toast.update(toastId, { 
                render: error.response?.data?.message || 'Error seeding Knowledge Base articles', 
                type: "error", 
                isLoading: false, 
                autoClose: 4000 
            });
        } finally {
            setSeeding(false);
        }
    };

    const isKbEmpty = articles.length === 0 && search === '' && selectedCategory === '';

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        Knowledge Base Troubleshooting FAQs
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Access solutions, hardware guides, billing policies, and self-help files.
                    </p>
                </div>
                {isExecutive && (
                    <div className="flex items-center gap-2 self-start md:self-auto">
                        <button
                            onClick={() => handleOpenForm()}
                            className="flex items-center gap-2 px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-lg active:scale-95"
                        >
                            <MdAdd size={18} />
                            New Article
                        </button>
                    </div>
                )}
            </div>

            {isKbEmpty ? (
                /* Empty Catalog Call-to-action */
                <div className="bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950 text-white rounded-[2.5rem] p-12 shadow-xl text-center space-y-6 max-w-2xl mx-auto my-12 border border-teal-950 animate-scale-in">
                    <div className="w-20 h-20 bg-teal-800/50 rounded-3xl flex items-center justify-center mx-auto text-teal-300">
                        <MdBook size={48} className="animate-float" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black font-outfit">Empty Knowledge Base Catalog</h3>
                        <p className="text-teal-200/80 text-sm max-w-md mx-auto leading-relaxed font-medium">
                            No troubleshooting guides, electrical fault FAQs, or breaker lockout manual sheets are currently logged for your company.
                        </p>
                    </div>
                    {isExecutive && (
                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={() => handleOpenForm()}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-slate-900 font-black px-6 py-4 rounded-2xl hover:bg-slate-50 transition-all text-xs uppercase tracking-wider"
                            >
                                <MdAdd size={16} /> Create Article
                            </button>
                            <button
                                onClick={handleSeedKb}
                                disabled={seeding}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-400 to-emerald-400 text-teal-950 font-black px-6 py-4 rounded-2xl hover:from-teal-300 hover:to-emerald-300 transition-all shadow-lg text-xs uppercase tracking-wider"
                            >
                                {seeding ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-teal-950 border-t-transparent rounded-full animate-spin"></div>
                                        Seeding KB Catalog...
                                    </>
                                ) : "Populate KB Catalog"}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* Split Screen Grid */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Panel: Search & Index List */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Search */}
                        <div className="glass shadow-premium rounded-[2.5rem] p-4 bg-white border border-slate-100 relative">
                            <input
                                type="text"
                                placeholder="Search articles..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs font-semibold"
                            />
                            <MdSearch className="absolute left-7 top-7 text-slate-400" size={18} />
                        </div>

                        {/* Category Filter */}
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            <button
                                onClick={() => setSelectedCategory('')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    selectedCategory === ''
                                        ? 'bg-primary-600 text-white shadow-md'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                All Categories
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                        selectedCategory === cat
                                            ? 'bg-primary-600 text-white shadow-md'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Article Index List */}
                        <div className="glass shadow-premium rounded-[2rem] p-4 bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 max-h-[500px] overflow-y-auto custom-scrollbar space-y-2">
                            {loading ? (
                                <p className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Index...</p>
                            ) : articles.length === 0 ? (
                                <p className="text-center py-8 text-xs font-bold text-slate-400">No articles found.</p>
                            ) : (
                                articles.map(art => (
                                    <button
                                        key={art._id}
                                        onClick={() => handleSelectArticle(art)}
                                        className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-1.5 ${
                                            selectedArticle?._id === art._id
                                                ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/60'
                                                : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className="text-[9px] font-black uppercase text-teal-600 dark:text-teal-400 tracking-wider">{art.category}</span>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-tight">{art.title}</h4>
                                        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-bold">
                                            <div className="flex items-center gap-1">
                                                <MdRemoveRedEye size={12} />
                                                <span>{art.views} views</span>
                                            </div>
                                            <span>{new Date(art.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Article Reader */}
                    <div className="lg:col-span-2">
                        {selectedArticle ? (
                            <div className="glass shadow-premium rounded-[2.5rem] p-6 bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 min-h-[500px] flex flex-col justify-between">
                                <div className="space-y-6">
                                    <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-start justify-between gap-4">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">{selectedArticle.category}</span>
                                            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 font-outfit uppercase -mt-0.5">{selectedArticle.title}</h2>
                                            <div className="flex items-center gap-4 text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">
                                                <span>Created by: {selectedArticle.createdBy?.name || 'Technical Support'}</span>
                                                <span>Views: {selectedArticle.views} hits</span>
                                            </div>
                                        </div>
                                        {isExecutive && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleOpenForm(selectedArticle)}
                                                    className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-primary-600 rounded-xl transition-all border border-slate-100"
                                                >
                                                    <MdEdit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(selectedArticle._id)}
                                                    className="p-2.5 bg-rose-50 hover:bg-rose-100/50 text-rose-500 rounded-xl transition-all border border-rose-100"
                                                >
                                                    <MdDelete size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Markdown Article Text body */}
                                    <div className="rich-text-container prose max-w-none text-slate-600 font-semibold text-sm leading-relaxed whitespace-pre-wrap">
                                        {selectedArticle.content}
                                    </div>
                                </div>

                                <div className="border-t border-slate-50 pt-4 mt-8 flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-wider">
                                    <span>CSM Platform Knowledge base portal</span>
                                    <span>Article ID: {selectedArticle._id}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="glass shadow-premium rounded-[2.5rem] p-6 bg-white border border-slate-100 min-h-[500px] flex flex-col items-center justify-center text-center text-slate-400">
                                <MdBook size={48} className="text-slate-200 mb-2" />
                                <h3 className="font-outfit font-black text-slate-900 uppercase">Select an article</h3>
                                <p className="text-xs font-semibold">Choose a troubleshooting instruction from the catalog to read details.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Creation Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editId ? 'Edit FAQ Article' : 'Publish FAQ Article'}
                maxWidth="max-w-lg"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="flex-1 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg text-center"
                        >
                            {editId ? 'Save Changes' : 'Publish Article'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Article Category *</label>
                        <select
                            required
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Article Title *</label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Article Body Content *</label>
                        <textarea
                            required
                            placeholder="Write markdown instructions or step-by-step resolution details here..."
                            value={formData.content}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold h-48 custom-scrollbar"
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default KnowledgeBase;
