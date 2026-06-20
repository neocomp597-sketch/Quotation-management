import React, { useEffect, useState } from 'react';
import { csmService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdCategory, MdSettings, MdPriorityHigh, 
    MdAssignmentTurnedIn, MdPeople, MdAdd, 
    MdDelete, MdEdit, MdCloudDownload 
} from 'react-icons/md';

const CSMMasters = () => {
    const [activeTab, setActiveTab] = useState('categories');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    
    // Form states
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', responseSlaHours: '', resolutionSlaHours: '', color: '#64748b' });
    
    const tabs = [
        { id: 'categories', label: 'Categories', icon: <MdCategory size={20} /> },
        { id: 'types', label: 'Ticket Types', icon: <MdSettings size={20} /> },
        { id: 'priorities', label: 'Priorities', icon: <MdPriorityHigh size={20} /> },
        { id: 'teams', label: 'Service Teams', icon: <MdPeople size={20} /> }
    ];

    const fetchItems = async () => {
        setLoading(true);
        try {
            let res;
            if (activeTab === 'categories') res = await csmService.getCategories();
            else if (activeTab === 'types') res = await csmService.getTypes();
            else if (activeTab === 'priorities') res = await csmService.getPriorities();
            else if (activeTab === 'teams') res = await csmService.getTeams();
            
            setItems(res.data || []);
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Failed to load masters');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [activeTab]);

    const handleSeed = async () => {
        setLoading(true);
        try {
            await csmService.seedMasters();
            toast.success('Successfully seeded default configurations!');
            fetchItems();
        } catch (error) {
            toast.error('Seeding failed');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditId(item._id);
            setFormData({
                name: item.name,
                description: item.description || '',
                responseSlaHours: item.responseSlaHours || '',
                resolutionSlaHours: item.resolutionSlaHours || '',
                color: item.color || '#64748b'
            });
        } else {
            setEditId(null);
            setFormData({ name: '', description: '', responseSlaHours: '', resolutionSlaHours: '', color: '#64748b' });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (activeTab === 'categories') {
                if (editId) await csmService.updateCategory(editId, formData);
                else await csmService.createCategory(formData);
            } else if (activeTab === 'types') {
                if (editId) await csmService.updateType(editId, formData);
                else await csmService.createType(formData);
            } else if (activeTab === 'priorities') {
                if (editId) await csmService.updatePriority(editId, formData);
                else await csmService.createPriority(formData);
            } else if (activeTab === 'teams') {
                if (editId) await csmService.updateTeam(editId, formData);
                else await csmService.createTeam(formData);
            }
            toast.success('Saved successfully');
            setShowModal(false);
            fetchItems();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Save failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this master item?')) return;
        try {
            if (activeTab === 'categories') await csmService.deleteCategory(id);
            else if (activeTab === 'types') await csmService.deleteType(id);
            else if (activeTab === 'priorities') await csmService.deletePriority(id);
            else if (activeTab === 'teams') await csmService.deleteTeam(id);
            toast.success('Deleted successfully');
            fetchItems();
        } catch (error) {
            toast.error('Deletion failed');
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        CSM Master Configurations
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Manage categories, priorities, teams, and service SLA parameters.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSeed}
                        className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-md"
                    >
                        <MdCloudDownload size={18} />
                        Seed Defaults
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-lg shadow-primary-600/20 active:scale-95"
                    >
                        <MdAdd size={18} />
                        Add New
                    </button>
                </div>
            </div>

            {/* Tab Controls */}
            <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'border-primary-600 text-primary-600 font-black'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* List View */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Items...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-slate-400 font-bold text-lg mb-2">No configuration records found.</p>
                        <p className="text-slate-400 text-sm mb-4">Click "Seed Defaults" to populate standard system configurations instantly.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Description</th>
                                    {activeTab === 'priorities' && (
                                        <>
                                            <th className="px-6 py-4">Response SLA</th>
                                            <th className="px-6 py-4">Resolution SLA</th>
                                            <th className="px-6 py-4">Color Tag</th>
                                        </>
                                    )}
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                                {items.map((item) => (
                                    <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-black text-slate-900">{item.name}</td>
                                        <td className="px-6 py-4 text-slate-500 max-w-sm truncate">{item.description || '-'}</td>
                                        {activeTab === 'priorities' && (
                                            <>
                                                <td className="px-6 py-4">{item.responseSlaHours} hrs</td>
                                                <td className="px-6 py-4">{item.resolutionSlaHours} hrs</td>
                                                <td className="px-6 py-4">
                                                    <span 
                                                        className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
                                                        style={{ backgroundColor: item.color }}
                                                    >
                                                        {item.color}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-3">
                                                <button
                                                    onClick={() => handleOpenModal(item)}
                                                    className="p-2 rounded-xl text-slate-400 hover:text-primary-600 hover:bg-slate-50 transition-all"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item._id)}
                                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 transition-all"
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

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-scale-in">
                        <div className="px-6 py-5 border-b border-slate-50 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">
                                {editId ? 'Edit Configuration' : 'Create Configuration'}
                            </h3>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold h-24"
                                />
                            </div>
                            {activeTab === 'priorities' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Response SLA (Hrs) *</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formData.responseSlaHours}
                                            onChange={(e) => setFormData({ ...formData, responseSlaHours: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolution SLA (Hrs) *</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formData.resolutionSlaHours}
                                            onChange={(e) => setFormData({ ...formData, resolutionSlaHours: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Color Tag *</label>
                                        <input
                                            type="color"
                                            required
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="w-full h-12 p-1 rounded-xl border border-slate-200 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3 pt-4 border-t border-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/10"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CSMMasters;
