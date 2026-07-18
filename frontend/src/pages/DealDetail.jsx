import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { salesService, customerService } from '../services/api';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import PortalDropdown from '../components/PortalDropdown';
import SearchableSelect from '../components/SearchableSelect';
import {
    MdArrowBack, MdEdit, MdSave, MdClose, MdAdd, MdPhone, MdEmail,
    MdEvent, MdChat, MdAssignment, MdNote, MdDelete, MdReplay, MdBlock,
    MdBusiness, MdPerson, MdCalendarToday, MdTrendingUp
} from 'react-icons/md';

const ACTIVITY_ICONS = {
    Call: <MdPhone />, Email: <MdEmail />, Meeting: <MdEvent />,
    WhatsApp: <MdChat />, Task: <MdAssignment />, Note: <MdNote />
};

const ACTIVITY_COLORS = {
    Call: 'bg-blue-100 text-blue-700', Email: 'bg-purple-100 text-purple-700',
    Meeting: 'bg-amber-100 text-amber-700', WhatsApp: 'bg-green-100 text-green-700',
    Task: 'bg-red-100 text-red-700', Note: 'bg-slate-100 text-slate-700'
};

const FORECAST_CATS = ['Pipeline', 'Best Case', 'Commit', 'Closed', 'Omitted'];

const formatCurrency = (val) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
};

const DealDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [deal, setDeal] = useState(null);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(!id);
    const [customers, setCustomers] = useState([]);
    const [pipelines, setPipelines] = useState([]);
    const [showActivity, setShowActivity] = useState(false);
    const [showLost, setShowLost] = useState(false);
    const [activityForm, setActivityForm] = useState({ type: 'Call', description: '', activityDate: '' });
    const [lostReason, setLostReason] = useState('Price');

    const [customerSearch, setCustomerSearch] = useState('');
    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
    const customerAnchorRef = useRef(null);

    const [sources, setSources] = useState([]);

    const [form, setForm] = useState({
        title: '', customerId: '', value: '', expectedCloseDate: '',
        forecastCategory: 'Pipeline', source: 'Other', tags: '', notes: ''
    });

    const handleAddSource = async (name) => {
        if (!name.trim()) return;
        try {
            const res = await salesService.createSource({ name });
            toast.success('Source added successfully');
            const sourcesRes = await salesService.getSources();
            setSources(sourcesRes.data || []);
            setForm(prev => ({ ...prev, source: res.data.name }));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add source');
        }
    };

    const handleDeleteSource = async (option) => {
        if (!window.confirm(`Are you sure you want to delete the source "${option.label}"?`)) return;
        try {
            await salesService.deleteSource(option.id);
            toast.success('Source deleted successfully');
            const sourcesRes = await salesService.getSources();
            setSources(sourcesRes.data || []);
            if (form.source === option.value) {
                setForm(prev => ({ ...prev, source: 'Other' }));
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete source');
        }
    };

    useEffect(() => {
        loadSupport();
        if (id) loadDeal();
        else setLoading(false);
    }, [id]);

    const loadSupport = async () => {
        try {
            const [custRes, pipeRes, sourceRes] = await Promise.all([
                customerService.getAll({ limit: 500 }),
                salesService.getPipelines(),
                salesService.getSources()
            ]);
            setCustomers(custRes.data?.data || custRes.data || []);
            setPipelines(pipeRes.data || []);
            setSources(sourceRes.data || []);
        } catch (err) {
            console.error('Failed to load support:', err);
        }
    };

    const loadDeal = async () => {
        try {
            setLoading(true);
            const res = await salesService.getDeal(id);
            setDeal(res.data);
            setActivities(res.data.activities || []);
            setForm({
                title: res.data.title || '',
                customerId: res.data.customerId?._id || '',
                value: res.data.value || '',
                expectedCloseDate: res.data.expectedCloseDate ? res.data.expectedCloseDate.split('T')[0] : '',
                forecastCategory: res.data.forecastCategory || 'Pipeline',
                source: res.data.source || 'Other',
                tags: (res.data.tags || []).join(', '),
                notes: res.data.notes || ''
            });
            const cust = res.data.customerId;
            setCustomerSearch(cust ? (cust.companyName || cust.customerName || '') : '');
        } catch (err) {
            toast.error('Failed to load deal');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.title.trim()) return toast.error('Title is required');
        try {
            const payload = {
                ...form,
                value: parseFloat(form.value) || 0,
                tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
            };
            if (id) {
                await salesService.updateDeal(id, payload);
                toast.success('Deal updated');
            } else {
                const defaultPipeline = pipelines.find(p => p.isDefault) || pipelines[0];
                if (!defaultPipeline) return toast.error('No pipeline found');
                payload.pipelineId = defaultPipeline._id;
                payload.stageId = defaultPipeline.stages[0]?._id;
                const res = await salesService.createDeal(payload);
                toast.success('Deal created');
                navigate(`/sales/deals/${res.data._id}`);
                return;
            }
            setEditing(false);
            loadDeal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save');
        }
    };

    const handleAddActivity = async (e) => {
        e.preventDefault();
        if (!activityForm.description.trim()) return toast.error('Description is required');
        try {
            await salesService.addDealActivity(id, activityForm);
            toast.success('Activity added');
            setShowActivity(false);
            setActivityForm({ type: 'Call', description: '', activityDate: '' });
            loadDeal();
        } catch (err) {
            toast.error('Failed to add activity');
        }
    };

    const handleMarkLost = async () => {
        try {
            await salesService.markDealLost(id, lostReason);
            toast.success('Deal marked as Lost');
            setShowLost(false);
            loadDeal();
        } catch (err) {
            toast.error('Failed');
        }
    };

    const handleReopen = async () => {
        try {
            await salesService.reopenDeal(id);
            toast.success('Deal reopened');
            loadDeal();
        } catch (err) {
            toast.error('Failed');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Delete this deal?')) return;
        try {
            await salesService.deleteDeal(id);
            toast.success('Deal deleted');
            navigate('/sales/deals');
        } catch (err) {
            toast.error('Failed');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const currentPipeline = deal?.pipelineId;
    const currentStage = currentPipeline?.stages?.find(s => s._id === deal?.stageId);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/sales/deals')} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
                        <MdArrowBack size={22} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">{id ? (editing ? 'Edit Deal' : deal?.title) : 'New Deal'}</h1>
                        {deal && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                    deal.status === 'Won' ? 'bg-emerald-100 text-emerald-700' :
                                    deal.status === 'Lost' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>{deal.status}</span>
                                {currentStage && (
                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStage.color }} />
                                        {currentStage.name}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {id && (
                    <div className="flex items-center gap-2">
                        {!editing && deal?.status === 'Open' && (
                            <>
                                <button onClick={() => setEditing(true)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
                                    <MdEdit size={16} /> Edit
                                </button>
                                <button onClick={() => setShowLost(true)} className="px-3 py-2 rounded-xl border border-red-200 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5">
                                    <MdBlock size={16} /> Lost
                                </button>
                            </>
                        )}
                        {deal?.status === 'Lost' && (
                            <button onClick={handleReopen} className="px-3 py-2 rounded-xl border border-emerald-200 text-sm font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-1.5">
                                <MdReplay size={16} /> Reopen
                            </button>
                        )}
                        <button onClick={handleDelete} className="px-3 py-2 rounded-xl border border-red-200 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5">
                            <MdDelete size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Deal Form / Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Key Metrics */}
                    {deal && !editing && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white rounded-2xl border border-slate-100 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase">Value</p>
                                <p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(deal.value)}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase">Probability</p>
                                <p className="text-xl font-black text-indigo-600 mt-1">{deal.probability}%</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase">Weighted</p>
                                <p className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(deal.weightedValue)}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase">Close Date</p>
                                <p className="text-xl font-black text-slate-900 mt-1">
                                    {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    {(editing || !id) && (
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deal Title *</label>
                                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative" ref={customerAnchorRef}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer</label>
                                    <input
                                        type="text"
                                        value={customerDropdownOpen ? customerSearch : (customers.find(c => c._id === form.customerId)?.companyName || customers.find(c => c._id === form.customerId)?.customerName || '')}
                                        onFocus={() => {
                                            setCustomerDropdownOpen(true);
                                            const currentName = customers.find(c => c._id === form.customerId)?.companyName || customers.find(c => c._id === form.customerId)?.customerName || '';
                                            setCustomerSearch(currentName);
                                        }}
                                        onBlur={() => {
                                            setTimeout(() => {
                                                setCustomerDropdownOpen(false);
                                            }, 200);
                                        }}
                                        onChange={(e) => {
                                            setCustomerSearch(e.target.value);
                                        }}
                                        placeholder="Search & Select Customer..."
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400"
                                    />
                                    <PortalDropdown isOpen={customerDropdownOpen} anchorRef={customerAnchorRef}>
                                        <ul className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-50 overflow-hidden">
                                            {customers
                                                .filter(c => {
                                                    const query = customerSearch.toLowerCase();
                                                    return (
                                                        c.companyName?.toLowerCase().includes(query) ||
                                                        c.customerName?.toLowerCase().includes(query)
                                                    );
                                                })
                                                .map(c => (
                                                    <li
                                                        key={c._id}
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setForm(prev => ({ ...prev, customerId: c._id }));
                                                            setCustomerSearch(c.companyName || c.customerName);
                                                            setCustomerDropdownOpen(false);
                                                        }}
                                                        className="px-5 py-3.5 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer text-sm font-bold text-slate-700 transition-colors"
                                                    >
                                                        <div className="font-bold text-slate-900 text-sm">{c.companyName || c.customerName}</div>
                                                        {(c.companyName && c.customerName) && (
                                                            <div className="text-[10px] text-slate-500 font-semibold">{c.customerName}</div>
                                                        )}
                                                    </li>
                                                ))}
                                            {customers.filter(c => {
                                                const query = customerSearch.toLowerCase();
                                                return (
                                                    c.companyName?.toLowerCase().includes(query) ||
                                                    c.customerName?.toLowerCase().includes(query)
                                                );
                                            }).length === 0 && (
                                                <li className="px-5 py-4 text-center text-sm text-slate-400 font-semibold">
                                                    No customers found
                                                </li>
                                            )}
                                        </ul>
                                    </PortalDropdown>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deal Value (₹)</label>
                                    <input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expected Close</label>
                                    <input type="date" value={form.expectedCloseDate} onChange={e => setForm({ ...form, expectedCloseDate: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source</label>
                                    <SearchableSelect
                                        options={sources.map(s => ({ value: s.name, label: s.name, id: s._id }))}
                                        value={form.source}
                                        onChange={val => setForm({ ...form, source: val })}
                                        placeholder="Select Source"
                                        onAddOption={handleAddSource}
                                        onDeleteOption={handleDeleteSource}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forecast Category</label>
                                    <select value={form.forecastCategory} onChange={e => setForm({ ...form, forecastCategory: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                                        {FORECAST_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags (comma-separated)</label>
                                <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="e.g. enterprise, high-value" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                            </div>
                            <div className="flex gap-3">
                                {id && <button onClick={() => { setEditing(false); loadDeal(); }} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>}
                                <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 flex items-center gap-1.5">
                                    <MdSave size={16} /> Save
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Deal Details (View Mode) */}
                    {deal && !editing && (
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase">Details</h3>
                            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                                <div><span className="text-slate-400 font-bold">Customer:</span> <span className="text-slate-900 font-semibold ml-2">{deal.customerId?.companyName || deal.customerId?.customerName || '—'}</span></div>
                                <div><span className="text-slate-400 font-bold">Owner:</span> <span className="text-slate-900 font-semibold ml-2">{deal.ownerId?.name || '—'}</span></div>
                                <div><span className="text-slate-400 font-bold">Source:</span> <span className="text-slate-900 font-semibold ml-2">{deal.source}</span></div>
                                <div><span className="text-slate-400 font-bold">Forecast:</span> <span className="text-slate-900 font-semibold ml-2">{deal.forecastCategory}</span></div>
                                <div><span className="text-slate-400 font-bold">Pipeline:</span> <span className="text-slate-900 font-semibold ml-2">{currentPipeline?.name || '—'}</span></div>
                                {deal.lostReason && <div><span className="text-red-400 font-bold">Lost Reason:</span> <span className="text-red-600 font-semibold ml-2">{deal.lostReason}</span></div>}
                            </div>
                            {deal.tags?.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-400">Tags:</span>
                                    {deal.tags.map((tag, i) => (
                                        <span key={i} className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">{tag}</span>
                                    ))}
                                </div>
                            )}
                            {deal.notes && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{deal.notes}</p>}
                        </div>
                    )}
                </div>

                {/* Activity Timeline */}
                {id && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl border border-slate-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black text-slate-900 uppercase">Activity Timeline</h3>
                                <button onClick={() => setShowActivity(!showActivity)}
                                    className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-all">
                                    <MdAdd size={18} />
                                </button>
                            </div>

                            {showActivity && (
                                <form onSubmit={handleAddActivity} className="mb-4 p-4 bg-slate-50 rounded-xl space-y-3">
                                    <div className="flex gap-2">
                                        {Object.keys(ACTIVITY_ICONS).map(type => (
                                            <button key={type} type="button"
                                                onClick={() => setActivityForm({ ...activityForm, type })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                    activityForm.type === type ? ACTIVITY_COLORS[type] : 'bg-white text-slate-400 border border-slate-200'
                                                }`}>
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea value={activityForm.description}
                                        onChange={e => setActivityForm({ ...activityForm, description: e.target.value })}
                                        rows={2} placeholder="What happened?"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                                    <div className="flex gap-2">
                                        <input type="datetime-local" value={activityForm.activityDate}
                                            onChange={e => setActivityForm({ ...activityForm, activityDate: e.target.value })}
                                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">Add</button>
                                    </div>
                                </form>
                            )}

                            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                                {activities.length > 0 ? activities.map((a, i) => (
                                    <div key={i} className="flex gap-3 items-start">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${ACTIVITY_COLORS[a.type] || 'bg-slate-100 text-slate-600'}`}>
                                            {ACTIVITY_ICONS[a.type] || <MdNote />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-900">{a.description}</p>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                                <span className="font-bold">{a.performedBy?.name || 'System'}</span>
                                                <span>•</span>
                                                <span>{new Date(a.activityDate || a.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-center text-sm text-slate-400 py-8">No activities yet</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Lost Modal */}
            <Modal
                isOpen={showLost}
                onClose={() => setShowLost(false)}
                title="Mark as Lost"
                maxWidth="max-w-sm"
                footer={
                    <>
                        <button onClick={() => setShowLost(false)} className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button onClick={handleMarkLost} className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700">Mark Lost</button>
                    </>
                }
            >
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason</label>
                    <select value={lostReason} onChange={e => setLostReason(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm">
                        {['Price', 'Competitor', 'Budget', 'No Response', 'Other'].map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </div>
            </Modal>
        </div>
    );
};

export default DealDetail;
