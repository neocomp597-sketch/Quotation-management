import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { csmService, territoryService, payrollService } from '../services/api';
import { toast } from 'react-toastify';
import { 
    MdCategory, MdSettings, MdPriorityHigh, 
    MdAssignmentTurnedIn, MdPeople, MdAdd, 
    MdDelete, MdEdit, MdCloudDownload, MdBuild, MdArrowBack
} from 'react-icons/md';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';

const CSMMasters = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const defaultTab = queryParams.get('tab') || 'categories';
    const [activeTab, setActiveTab] = useState(defaultTab);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab) {
            setActiveTab(tab);
        }
    }, [location.search]);
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [territories, setTerritories] = useState([]);
    const [employeesList, setEmployeesList] = useState([]);
    
    // Form states
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ 
        name: '', 
        description: '', 
        responseSlaHours: '', 
        resolutionSlaHours: '', 
        color: '#64748b',
        employeeId: '',
        email: '',
        mobile: '',
        status: 'Active',
        territoryId: '',
        pincodes: ''
    });
    
    const tabs = [
        { id: 'categories', label: 'Categories', icon: <MdCategory size={20} /> },
        { id: 'types', label: 'Ticket Types', icon: <MdSettings size={20} /> },
        { id: 'priorities', label: 'Priorities', icon: <MdPriorityHigh size={20} /> },
        { id: 'teams', label: 'Service Teams', icon: <MdPeople size={20} /> },
        { id: 'engineers', label: 'Engineers Master', icon: <MdBuild size={20} /> }
    ];

    const fetchTerritories = async () => {
        try {
            const res = await territoryService.getAll();
            setTerritories(res.data || []);
        } catch (e) {
            console.error('Fetch territories error:', e);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await payrollService.getEmployees({ status: 'Active' });
            setEmployeesList(res.data || []);
        } catch (e) {
            console.error('Fetch employees error:', e);
        }
    };

    const fetchItems = async () => {
        setLoading(true);
        try {
            let res;
            if (activeTab === 'categories') res = await csmService.getCategories();
            else if (activeTab === 'types') res = await csmService.getTypes();
            else if (activeTab === 'priorities') res = await csmService.getPriorities();
            else if (activeTab === 'teams') res = await csmService.getTeams();
            else if (activeTab === 'engineers') res = await csmService.getEngineers();
            
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
        if (activeTab === 'engineers') {
            fetchTerritories();
            fetchEmployees();
        }
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

    useEffect(() => {
        if (isCreatePage) {
            if (activeTab === 'engineers') {
                toast.info('Engineers are automatically created from Employee Master when designation is set to "Service Engineer". Manual creation is disabled.');
                navigate('/csm/masters?tab=engineers');
                return;
            }
            setEditId(null);
            setFormData({ 
                name: '', 
                description: '', 
                responseSlaHours: '', 
                resolutionSlaHours: '', 
                color: '#64748b',
                employeeId: '',
                email: '',
                mobile: '',
                status: 'Active',
                territoryId: '',
                pincodes: ''
            });
            setShowModal(true);
        } else if (isEditPage && routeId) {
            setShowModal(true);
            const found = items.find(i => i._id === routeId);
            if (found) {
                setEditId(found._id);
                setFormData({
                    name: found.name,
                    description: found.description || '',
                    responseSlaHours: found.responseSlaHours || '',
                    resolutionSlaHours: found.resolutionSlaHours || '',
                    color: found.color || '#64748b',
                    employeeId: found.employeeId?._id || found.employeeId || '',
                    email: found.email || '',
                    mobile: found.mobile || '',
                    status: found.status || 'Active',
                    territoryId: found.territoryId?._id || found.territoryId || '',
                    pincodes: found.pincodes ? found.pincodes.join(', ') : ''
                });
            }
        }
    }, [isCreatePage, isEditPage, routeId, items, activeTab, navigate]);

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditId(item._id);
            setFormData({
                name: item.name,
                description: item.description || '',
                responseSlaHours: item.responseSlaHours || '',
                resolutionSlaHours: item.resolutionSlaHours || '',
                color: item.color || '#64748b',
                employeeId: item.employeeId?._id || item.employeeId || '',
                email: item.email || '',
                mobile: item.mobile || '',
                status: item.status || 'Active',
                territoryId: item.territoryId?._id || item.territoryId || '',
                pincodes: item.pincodes ? item.pincodes.join(', ') : ''
            });
            setShowModal(true);
        } else {
            if (activeTab === 'engineers') {
                toast.info('Engineers are automatically created from Employee Master when designation is set to "Service Engineer".');
                return;
            }
            navigate('/csm/masters/new');
        }
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
            } else if (activeTab === 'engineers') {
                if (!editId) {
                    toast.error('Manual creation of engineers is disabled. Create a Service Engineer in Employee Master.');
                    return;
                }
                const payload = {
                    territoryId: formData.territoryId || null,
                    pincodes: typeof formData.pincodes === 'string'
                        ? formData.pincodes.split(',').map(p => p.trim()).filter(Boolean)
                        : (formData.pincodes || []),
                    status: formData.status
                };
                await csmService.updateEngineer(editId, payload);
            }
            toast.success('Saved successfully');
            setShowModal(false);
            fetchItems();
            navigate('/csm/masters?tab=' + activeTab);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Save failed');
        }
    };

    const handleDelete = async (id) => {
        if (activeTab === 'engineers') {
            toast.info('Engineers are managed via Employee Master.');
            return;
        }
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
            {!(showModal || isCreatePage || isEditPage) ? (
                <>
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
                    {activeTab !== 'engineers' && (
                        <button
                            onClick={() => handleOpenModal()}
                            className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-lg shadow-primary-600/20 active:scale-95"
                        >
                            <MdAdd size={18} />
                            Add New
                        </button>
                    )}
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
                {activeTab === 'engineers' && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold text-teal-900 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-600"></span>
                            </span>
                            <span><strong>Service Engineer Source:</strong> Employees created with designation <em>"Service Engineer"</em> in Employee Master automatically appear here. Use <strong>Edit</strong> to assign territories. Manual creation is disabled.</span>
                        </div>
                    </div>
                )}
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
                                    {activeTab === 'engineers' ? (
                                        <>
                                            <th className="px-6 py-4">Email</th>
                                            <th className="px-6 py-4">Mobile</th>
                                            <th className="px-6 py-4">Territory</th>
                                            <th className="px-6 py-4">Direct Pincodes</th>
                                            <th className="px-6 py-4">Status</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-6 py-4">Description</th>
                                            {activeTab === 'priorities' && (
                                                <>
                                                    <th className="px-6 py-4">Response SLA</th>
                                                    <th className="px-6 py-4">Resolution SLA</th>
                                                    <th className="px-6 py-4">Color Tag</th>
                                                </>
                                            )}
                                        </>
                                    )}
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                                {items.map((item) => (
                                    <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-black text-slate-900">{item.name}</td>
                                        {activeTab === 'engineers' ? (
                                            <>
                                                <td className="px-6 py-4 text-slate-500">{item.email || '-'}</td>
                                                <td className="px-6 py-4 text-slate-500">{item.mobile || '-'}</td>
                                                <td className="px-6 py-4 text-slate-900 font-bold">{item.territoryId?.name || '-'}</td>
                                                <td className="px-6 py-4 max-w-xs truncate text-slate-500">
                                                    {item.pincodes && item.pincodes.length > 0 ? item.pincodes.join(', ') : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${item.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
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
                                            </>
                                        )}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-3">
                                                <button
                                                    onClick={() => handleOpenModal(item)}
                                                    title={activeTab === 'engineers' ? "Edit Engineer & Assign Territory" : "Edit Item"}
                                                    className="p-2 rounded-xl text-slate-400 hover:text-primary-600 hover:bg-slate-50 transition-all"
                                                >
                                                    <MdEdit size={18} />
                                                </button>
                                                {activeTab !== 'engineers' && (
                                                    <button
                                                        onClick={() => handleDelete(item._id)}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 transition-all"
                                                    >
                                                        <MdDelete size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
                                    onClick={() => { setShowModal(false); navigate('/csm/masters'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editId ? (activeTab === 'engineers' ? 'Edit Engineer & Assign Territory' : 'Edit Configuration') : (activeTab === 'engineers' ? 'Engineer Details' : 'Create Configuration')}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {activeTab === 'engineers' ? 'Assign territory and direct pincodes for this Service Engineer' : (editId ? 'Update master configuration details' : `Add new ${activeTab} item`)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); navigate('/csm/masters'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95"
                                >
                                    Save
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {activeTab !== 'engineers' && (
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold transition-all"
                                        />
                                    </div>
                                )}
                                {activeTab !== 'engineers' && (
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-semibold h-32"
                                        />
                                    </div>
                                )}
                                {activeTab === 'engineers' && (
                                    <>
                                        <div className="p-5 bg-teal-50/60 border border-teal-100 rounded-2xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-teal-700">
                                                    🛠️ Service Engineer Profile (Auto-Synced from Employee Master)
                                                </span>
                                                <span className="px-2.5 py-1 bg-teal-100 text-teal-800 text-[10px] font-black uppercase tracking-wider rounded-lg">
                                                    Employee Master Sourced
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Engineer Name</span>
                                                    <span className="font-bold text-slate-900 text-sm">{formData.name || '—'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Email</span>
                                                    <span className="text-slate-600 font-semibold text-xs">{formData.email || '—'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Mobile</span>
                                                    <span className="text-slate-600 font-semibold text-xs">{formData.mobile || '—'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assign Territory</label>
                                            <select
                                                value={formData.territoryId}
                                                onChange={(e) => setFormData({ ...formData, territoryId: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-semibold cursor-pointer"
                                            >
                                                <option value="">-- Select Territory --</option>
                                                {territories.map(t => (
                                                    <option key={t._id} value={t._id}>{t.name}</option>
                                                ))}
                                            </select>
                                            {(() => {
                                                const selectedTerritory = territories.find(t => t._id === formData.territoryId);
                                                if (selectedTerritory && selectedTerritory.rules?.pincodes?.length > 0) {
                                                    return (
                                                        <div className="mt-1.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 font-semibold flex flex-col gap-0.5 animate-fade-in">
                                                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Territory Pincodes (Auto-Covered)</span>
                                                            <p className="text-slate-700">{selectedTerritory.rules.pincodes.join(', ')}</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Additional Direct Pincodes (Optional)</label>
                                            <input
                                                type="text"
                                                value={formData.pincodes}
                                                onChange={(e) => setFormData({ ...formData, pincodes: e.target.value })}
                                                placeholder="e.g. 400074, 422209"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-semibold"
                                            />
                                            <p className="text-[9px] text-slate-400 font-semibold leading-normal mt-1 pl-1">
                                                Only specify extra pincodes here if they are outside the selected territory.
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</label>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-semibold cursor-pointer"
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                                {activeTab === 'priorities' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Response SLA (Hrs) *</label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={formData.responseSlaHours}
                                                onChange={(e) => setFormData({ ...formData, responseSlaHours: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-semibold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolution SLA (Hrs) *</label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={formData.resolutionSlaHours}
                                                onChange={(e) => setFormData({ ...formData, resolutionSlaHours: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-semibold"
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-1">
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
                            </form>
                        </div>
                </div>
            )}
        </div>
    );
};

export default CSMMasters;
