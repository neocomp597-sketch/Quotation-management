import React, { useState, useEffect } from 'react';
import { salesService } from '../services/api';
import { toast } from 'react-toastify';
import { MdPhone, MdEmail, MdEvent, MdChat, MdAssignment, MdNote, MdFilterList } from 'react-icons/md';

const TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Task', 'Note'];
const ICONS = { Call: <MdPhone />, Email: <MdEmail />, Meeting: <MdEvent />, WhatsApp: <MdChat />, Task: <MdAssignment />, Note: <MdNote /> };
const COLORS = {
    Call: 'bg-blue-100 text-blue-700 border-blue-200',
    Email: 'bg-purple-100 text-purple-700 border-purple-200',
    Meeting: 'bg-amber-100 text-amber-700 border-amber-200',
    WhatsApp: 'bg-green-100 text-green-700 border-green-200',
    Task: 'bg-red-100 text-red-700 border-red-200',
    Note: 'bg-slate-100 text-slate-700 border-slate-200'
};

const SalesActivities = () => {
    const [activities, setActivities] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => { loadActivities(); }, [filterType, page]);

    const loadActivities = async () => {
        try {
            setLoading(true);
            const params = { page, limit: 30 };
            if (filterType) params.type = filterType;
            const res = await salesService.getAllActivities(params);
            setActivities(res.data.activities || []);
            setTotal(res.data.total || 0);
        } catch (err) {
            toast.error('Failed to load activities');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Sales Activities</h1>
                    <p className="text-sm text-slate-500">Unified activity timeline across all deals</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => { setFilterType(''); setPage(1); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${!filterType ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                        All
                    </button>
                    {TYPES.map(t => (
                        <button key={t} onClick={() => { setFilterType(t); setPage(1); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                filterType === t ? COLORS[t] : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
                            }`}>
                            {ICONS[t]} {t}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
                    {activities.length > 0 ? activities.map((a, i) => (
                        <div key={i} className="flex items-start gap-4 p-5 hover:bg-slate-50/50 transition-all">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${COLORS[a.type] || 'bg-slate-100 text-slate-600'}`}>
                                {ICONS[a.type] || <MdNote />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-900 font-semibold">{a.description}</p>
                                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                                    <span className="font-bold text-slate-600">{a.dealId?.title || '—'}</span>
                                    {a.dealId?.customerId && <span>• {a.dealId.customerId.companyName || a.dealId.customerId.customerName}</span>}
                                    <span>• {a.performedBy?.name || 'System'}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xs text-slate-400">
                                    {new Date(a.activityDate || a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-slate-300">
                                    {new Date(a.activityDate || a.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-20 text-slate-400 text-sm">No activities found</div>
                    )}
                </div>
            )}

            {/* Pagination */}
            {total > 30 && (
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-40">Prev</button>
                    <span className="text-sm text-slate-500">Page {page} of {Math.ceil(total / 30)}</span>
                    <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 30)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 disabled:opacity-40">Next</button>
                </div>
            )}
        </div>
    );
};

export default SalesActivities;
