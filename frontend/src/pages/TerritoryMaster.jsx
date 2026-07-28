import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
    MdAdd, MdEdit, MdDelete, MdMap, MdPerson, MdPeople, 
    MdLocationCity, MdChevronRight, MdExpandMore, 
    MdKeyboardArrowRight, MdInfoOutline, MdArrowBack 
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { territoryService, userService, mgrService, csmService } from '../services/api';
import Modal from '../components/Modal';
import { useSubmitGuard } from '../hooks/useSubmitGuard';

const TERRITORY_TYPE_OPTIONS = ['Country', 'Zone', 'State', 'City', 'Area', 'Custom'];
const TERRITORY_LOAD_TOAST_ID = 'territory-master-territories-load-error';
const USER_LOAD_TOAST_ID = 'territory-master-users-load-error';

const TerritoryMaster = ({ isCreatePage, isEditPage }) => {
    const navigate = useNavigate();
    const { id: routeId } = useParams();
    const [territories, setTerritories] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTerritory, setEditingTerritory] = useState(null);
    const [mgrsData, setMgrsData] = useState({ mgr1: [], mgr2: [], mgr3: [], mgr4: [], mgr5: [] });
    const [engineers, setEngineers] = useState([]);
    
    // UI state for tree collapse/expand
    const [expandedNodes, setExpandedNodes] = useState({});
    
    const [formData, setFormData] = useState({
        name: '',
        type: 'City',
        parent: '',
        manager: '',
        salesReps: [],
        engineerId: '',
        rules: {
            cities: '',
            pincodes: ''
        },
        mgr1: '',
        mgr2: '',
        mgr3: '',
        mgr4: '',
        mgr5: ''
    });

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const [terrResult, userResult, m1, m2, m3, m4, m5, engResult] = await Promise.allSettled([
                territoryService.getAll(),
                userService.getAll(),
                mgrService.getAll('MGR1'),
                mgrService.getAll('MGR2'),
                mgrService.getAll('MGR3'),
                mgrService.getAll('MGR4'),
                mgrService.getAll('MGR5'),
                csmService.getEngineers()
            ]);

            if (terrResult.status === 'fulfilled') {
                setTerritories(Array.isArray(terrResult.value.data) ? terrResult.value.data : []);
            } else {
                console.error('Error fetching territories:', terrResult.reason);
                toast.error(terrResult.reason?.response?.data?.message || 'Failed to load territories.', {
                    toastId: TERRITORY_LOAD_TOAST_ID
                });
            }

            if (userResult.status === 'fulfilled') {
                setUsers(Array.isArray(userResult.value.data) ? userResult.value.data : []);
            } else {
                console.error('Error fetching users:', userResult.reason);
                toast.error(userResult.reason?.response?.data?.message || 'Failed to load users.', {
                    toastId: USER_LOAD_TOAST_ID
                });
            }

            if (engResult.status === 'fulfilled') {
                const engList = Array.isArray(engResult.value.data) ? engResult.value.data : [];
                setEngineers(engList.filter(eng => eng.status === 'Active'));
            } else {
                console.error('Error fetching engineers:', engResult.reason);
            }

            setMgrsData({
                mgr1: m1.status === 'fulfilled' ? m1.value.data.filter(m => m.status === 'Active') : [],
                mgr2: m2.status === 'fulfilled' ? m2.value.data.filter(m => m.status === 'Active') : [],
                mgr3: m3.status === 'fulfilled' ? m3.value.data.filter(m => m.status === 'Active') : [],
                mgr4: m4.status === 'fulfilled' ? m4.value.data.filter(m => m.status === 'Active') : [],
                mgr5: m5.status === 'fulfilled' ? m5.value.data.filter(m => m.status === 'Active') : []
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleToggleNode = (id) => {
        setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    useEffect(() => {
        const defaultTerrForm = {
            name: '',
            type: 'City',
            parent: '',
            manager: '',
            salesReps: [],
            engineerId: '',
            rules: { cities: '', pincodes: '' },
            mgr1: '', mgr2: '', mgr3: '', mgr4: '', mgr5: ''
        };

        if (isCreatePage) {
            setEditingTerritory(null);
            setFormData(defaultTerrForm);
            setIsModalOpen(true);
        } else if (isEditPage && routeId) {
            setIsModalOpen(true);
            const found = territories.find(t => t._id === routeId);
            if (found) {
                setEditingTerritory(found);
                setFormData({
                    name: found.name,
                    type: found.type,
                    parent: found.parent?._id || found.parent || '',
                    manager: found.manager?._id || found.manager || '',
                    salesReps: (found.salesReps || []).map(r => r._id || r),
                    engineerId: found.engineerId?._id || found.engineerId || '',
                    rules: {
                        cities: (found.rules?.cities || []).join(', '),
                        pincodes: (found.rules?.pincodes || []).join(', ')
                    },
                    mgr1: found.mgr1?._id || found.mgr1 || '',
                    mgr2: found.mgr2?._id || found.mgr2 || '',
                    mgr3: found.mgr3?._id || found.mgr3 || '',
                    mgr4: found.mgr4?._id || found.mgr4 || '',
                    mgr5: found.mgr5?._id || found.mgr5 || ''
                });
            } else {
                territoryService.getAll().then(res => {
                    const list = Array.isArray(res.data) ? res.data : [];
                    const item = list.find(t => t._id === routeId);
                    if (item) {
                        setEditingTerritory(item);
                        setFormData({
                            name: item.name,
                            type: item.type,
                            parent: item.parent?._id || item.parent || '',
                            manager: item.manager?._id || item.manager || '',
                            salesReps: (item.salesReps || []).map(r => r._id || r),
                            engineerId: item.engineerId?._id || item.engineerId || '',
                            rules: {
                                cities: (item.rules?.cities || []).join(', '),
                                pincodes: (item.rules?.pincodes || []).join(', ')
                            },
                            mgr1: item.mgr1?._id || item.mgr1 || '',
                            mgr2: item.mgr2?._id || item.mgr2 || '',
                            mgr3: item.mgr3?._id || item.mgr3 || '',
                            mgr4: item.mgr4?._id || item.mgr4 || '',
                            mgr5: item.mgr5?._id || item.mgr5 || ''
                        });
                    }
                }).catch(err => console.error("Failed to load territory", err));
            }
        }
    }, [isCreatePage, isEditPage, routeId, territories]);

    const handleOpenModal = (territory = null) => {
        if (territory) {
            navigate(`/territory-master/edit/${territory._id}`);
        } else {
            navigate('/territory-master/new');
        }
    };

    const { isSubmitting: isSaving, execute: handleSubmit } = useSubmitGuard(async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Territory Name is required');
            return;
        }

        const formattedData = {
            ...formData,
            parent: formData.parent || null,
            manager: formData.manager || null,
            engineerId: formData.engineerId || null,
            mgr1: formData.mgr1 || null,
            mgr2: formData.mgr2 || null,
            mgr3: formData.mgr3 || null,
            mgr4: formData.mgr4 || null,
            mgr5: formData.mgr5 || null,
            rules: {
                cities: formData.rules.cities.split(',').map(s => s.trim()).filter(Boolean),
                pincodes: formData.rules.pincodes.split(',').map(s => s.trim()).filter(Boolean)
            }
        };

        try {
            if (editingTerritory) {
                await territoryService.update(editingTerritory._id, formattedData);
                toast.success('Territory updated successfully!');
            } else {
                await territoryService.create(formattedData);
                toast.success('Territory created successfully!');
            }
            fetchAllData();
            setIsModalOpen(false);
            navigate('/territory-master');
        } catch (err) {
            console.error('Error saving territory:', err);
            toast.error(err.response?.data?.message || 'Error saving territory');
        }
    });

    const handleDelete = async (territory) => {
        const hasChildren = territories.some(t => String(t.parent?._id || t.parent) === String(territory._id));
        const message = hasChildren 
            ? `Warning: This territory has child territories. If deleted, all children and mapped customers will safely move to its parent territory: "${territory.parent?.name || 'Unassigned Parent'}".\n\nAre you sure you want to proceed?`
            : `Are you sure you want to delete the territory "${territory.name}"? Orphaned customers will be moved to its parent.`;

        if (window.confirm(message)) {
            try {
                await territoryService.delete(territory._id);
                toast.success('Territory deleted successfully!');
                fetchAllData();
            } catch (err) {
                console.error('Error deleting territory:', err);
                toast.error('Failed to delete territory');
            }
        }
    };

    const handleSalesRepToggle = (userId) => {
        setFormData(prev => {
            const reps = [...prev.salesReps];
            const idx = reps.indexOf(userId);
            if (idx >= 0) {
                reps.splice(idx, 1);
            } else {
                reps.push(userId);
            }
            return { ...prev, salesReps: reps };
        });
    };

    // Recursive helper to render the territory tree
    const renderTreeNodes = (parentId = null, depth = 0) => {
        const nodes = territories.filter(t => {
            const pId = t.parent?._id || t.parent;
            if (parentId === null) return !pId;
            return String(pId) === String(parentId);
        });

        if (nodes.length === 0) return null;

        return (
            <div className={`space-y-1.5 ${depth > 0 ? 'ml-6 mt-1 border-l-2 border-slate-100 pl-3' : ''}`}>
                {nodes.map(node => {
                    const hasChildren = territories.some(t => String(t.parent?._id || t.parent) === String(node._id));
                    const isExpanded = expandedNodes[node._id];
                    const managerName = node.manager?.name || 'Unassigned';
                    const repCount = (node.salesReps || []).length;

                    return (
                        <div key={node._id} className="group/node">
                            <div className="flex items-center justify-between p-3.5 bg-white border border-slate-100 hover:border-primary-100 hover:shadow-md rounded-2xl transition-all">
                                <div className="flex items-center gap-3">
                                    {hasChildren ? (
                                        <button 
                                            onClick={() => handleToggleNode(node._id)}
                                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary-600 transition-colors"
                                        >
                                            {isExpanded ? <MdExpandMore size={18} /> : <MdChevronRight size={18} />}
                                        </button>
                                    ) : (
                                        <div className="w-6 flex justify-center text-slate-300">
                                            <MdKeyboardArrowRight size={16} />
                                        </div>
                                    )}
                                    <div className="p-2 bg-primary-50/50 text-primary-600 rounded-xl">
                                        <MdMap size={18} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 text-sm md:text-base">
                                                {node.name}
                                                {(node.mgr1 || node.mgr2 || node.mgr3 || node.mgr4 || node.mgr5) && (
                                                    <span className="font-medium text-slate-400 text-xs md:text-sm ml-2.5">
                                                        + {[node.mgr1?.code || node.mgr1, node.mgr2?.code || node.mgr2, node.mgr3?.code || node.mgr3, node.mgr4?.code || node.mgr4, node.mgr5?.code || node.mgr5].filter(Boolean).join(' + ')}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-primary-50 text-primary-700">
                                                {node.type}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-400 font-medium">
                                            <span className="flex items-center gap-1">
                                                <MdPerson size={13} className="text-slate-400" /> Mgr: {managerName}
                                            </span>
                                            {node.engineerId && (
                                                <span className="flex items-center gap-1">
                                                    🛠️ Eng: {node.engineerId.name || node.engineerId}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <MdPeople size={13} className="text-slate-400" /> Reps: {repCount}
                                            </span>
                                            {node.rules?.cities?.length > 0 && (
                                                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                    <MdLocationCity size={12} /> {node.rules.cities.length} Cities
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 opacity-0 group-hover/node:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleOpenModal(node)}
                                        className="p-2 bg-white border border-slate-100 text-primary-600 hover:bg-primary-50 rounded-xl transition-all shadow-sm"
                                        title="Edit Territory"
                                    >
                                        <MdEdit size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(node)}
                                        className="p-2 bg-white border border-slate-100 text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm"
                                        title="Delete Territory"
                                    >
                                        <MdDelete size={16} />
                                    </button>
                                </div>
                            </div>
                            {hasChildren && isExpanded && renderTreeNodes(node._id, depth + 1)}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Territory Master</h1>
                    <p className="text-slate-500 font-medium">Organize sales zones, map reps, and configure automatic customer tagging.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95 shrink-0"
                >
                    <MdAdd size={20} />
                    <span>Create Territory</span>
                </button>
            </div>

            {loading ? (
                <div className="p-20 text-center text-slate-400 font-medium">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent mb-4"></div>
                    <p className="text-xs uppercase font-black tracking-widest">Loading Territories...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left 2 Columns: Territory Hierarchy Tree */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
                            <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                                <MdMap size={22} className="text-primary-600" />
                                Geographic Hierarchy Tree
                            </h2>
                            {territories.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-2xl">
                                    No territories configured. Get started by creating your first zone!
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {renderTreeNodes(null, 0)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right 1 Column: Mini summary of Rules */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-primary-50 to-blue-50/50 rounded-[2rem] border border-primary-100/50 p-6 space-y-4">
                            <h3 className="font-black text-primary-950 uppercase tracking-widest text-xs flex items-center gap-2">
                                <MdInfoOutline size={18} className="text-primary-600" />
                                Hierarchy Routing Rules
                            </h3>
                            <ul className="space-y-3 text-xs text-primary-900/80 font-semibold leading-relaxed list-decimal pl-4">
                                <li><strong>Country → Zone → State → City → Area</strong> hierarchy scales to unlimited levels.</li>
                                <li><strong>Auto-Assignment</strong> tags new customers based on matching pincode or city name.</li>
                                <li>Pincode matches first (highest priority), then falls back to lowercase City.</li>
                                <li>Manager oversees sales reps, and reps only view quotations and customers inside their designated territories.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Page View */}
            {(isModalOpen || isCreatePage || isEditPage) && (
                <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto p-6 md:p-10 flex flex-col items-center">
                    <div className="max-w-4xl w-full my-2 space-y-6">
                        {/* Header bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/territory-master'); }}
                                    className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all border border-slate-200"
                                >
                                    <MdArrowBack size={20} />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">
                                        {editingTerritory ? `Edit Territory: ${editingTerritory.name}` : "Create New Territory"}
                                    </h1>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {editingTerritory ? `Update hierarchy and assignment rules` : 'Add a new region to territory hierarchy'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); navigate('/territory-master'); }}
                                    className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-xs tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={isSaving}
                                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-xs tracking-widest active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? "Saving..." : (editingTerritory ? "Update Details" : "Create Territory")}
                                </button>
                            </div>
                        </div>

                        {/* Form Card Body */}
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <form className="space-y-6 py-2" onSubmit={handleSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Territory Name <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                            placeholder="e.g. Pune City, West Zone"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Level Type
                                        </label>
                                        <select
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                        >
                                            {TERRITORY_TYPE_OPTIONS.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Parent Territory
                                        </label>
                                        <select
                                            value={formData.parent}
                                            onChange={(e) => setFormData({ ...formData, parent: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                        >
                                            <option value="">None (Top Level)</option>
                                            {territories
                                                .filter(t => !editingTerritory || String(t._id) !== String(editingTerritory._id))
                                                .map(t => (
                                                    <option key={t._id} value={t._id}>{t.name} ({t.type})</option>
                                                ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Territory Manager
                                        </label>
                                        <select
                                            value={formData.manager}
                                            onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                        >
                                            <option value="">Unassigned</option>
                                            {users.map(u => (
                                                <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Assigned Engineer
                                        </label>
                                        <select
                                            value={formData.engineerId}
                                            onChange={(e) => setFormData({ ...formData, engineerId: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                        >
                                            <option value="">Unassigned</option>
                                            {engineers.map(eng => (
                                                <option key={eng._id} value={eng._id}>{eng.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Sales Reps Checkboxes */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Sales Representatives Mapping
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                        {users.filter(u => u.role?.toLowerCase() === 'sales').map(u => {
                                            const isChecked = formData.salesReps.includes(u._id);
                                            return (
                                                <label key={u._id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-100 hover:border-primary-100 cursor-pointer transition-all">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {
                                                            const newReps = isChecked
                                                                ? formData.salesReps.filter(id => id !== u._id)
                                                                : [...formData.salesReps, u._id];
                                                            setFormData({ ...formData, salesReps: newReps });
                                                        }}
                                                        className="rounded text-primary-600 focus:ring-primary-500/20 h-4.5 w-4.5"
                                                    />
                                                    <div className="overflow-hidden">
                                                        <p className="text-xs font-bold text-slate-800 truncate">{u.name}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{u.role}</p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* MGR Mappings */}
                                <div className="border-t border-slate-100 pt-6 space-y-4">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                        Manager Code Mappings (MGR 1 to 5)
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                                        {[1, 2, 3, 4, 5].map(num => {
                                            const mgrKey = `mgr${num}`;
                                            return (
                                                <div key={mgrKey} className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                        MGR {num}
                                                    </label>
                                                    <select
                                                        value={formData[mgrKey]}
                                                        onChange={(e) => setFormData({ ...formData, [mgrKey]: e.target.value })}
                                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-xs font-bold bg-white"
                                                    >
                                                        <option value="">Select MGR {num}</option>
                                                        {(mgrsData[mgrKey] || []).map(m => (
                                                            <option key={m._id} value={m._id}>{m.code} - {m.description}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Assignment Rules */}
                                <div className="border-t border-slate-100 pt-6 space-y-4">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                        Automatic Customer Tagging Rules
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                City Names (Comma separated)
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.rules.cities}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    rules: { ...formData.rules, cities: e.target.value } 
                                                })}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                                placeholder="e.g. Pune, Pimpri Chinchwad"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                Pincodes (Comma separated)
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.rules.pincodes}
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    rules: { ...formData.rules, pincodes: e.target.value } 
                                                })}
                                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none text-sm font-bold"
                                                placeholder="e.g. 411001, 411014"
                                            />
                                        </div>
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

export default TerritoryMaster;
