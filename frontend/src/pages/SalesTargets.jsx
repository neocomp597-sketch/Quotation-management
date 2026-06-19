import React, { useState, useEffect } from 'react';
import { salesService, userService } from '../services/api';
import { toast } from 'react-toastify';
import { MdAdd, MdClose, MdFlag, MdEdit, MdDelete } from 'react-icons/md';
import Modal from '../components/Modal';

const formatCurrency = (val) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
};

const PERIODS = ['monthly', 'quarterly', 'yearly'];

const SalesTargets = () => {
    const [targets, setTargets] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterPeriod, setFilterPeriod] = useState('monthly');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ userId: '', period: 'monthly', periodLabel: '', targetAmount: '' });

    useEffect(() => {
        loadTargets();
        loadUsers();
    }, [filterPeriod]);

    const loadTargets = async () => {
        try {
            setLoading(true);
            const res = await salesService.getTargets({ period: filterPeriod });
            setTargets(res.data || []);
        } catch (err) {
            toast.error('Failed to load targets');
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const res = await userService.getAll();
            setUsers(Array.isArray(res.data) ? res.data : res.data?.users || []);
        } catch (err) {
            console.error('Failed to load users');
        }
    };

    const openCreate = () => {
        setEditId(null);
        const now = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let defaultLabel = `${monthNames[now.getMonth()]}-${now.getFullYear()}`;
        if (filterPeriod === 'quarterly') {
            const q = Math.ceil((now.getMonth() + 1) / 3);
            defaultLabel = `Q${q}-${now.getFullYear()}`;
        } else if (filterPeriod === 'yearly') {
            const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
            defaultLabel = `${fy}-${(fy + 1).toString().slice(-2)}`;
        }
        setForm({ userId: '', period: filterPeriod, periodLabel: defaultLabel, targetAmount: '' });
        setShowForm(true);
    };

    const openEdit = (target) => {
        setEditId(target._id);
        setForm({
            userId: target.userId?._id || target.userId,
            period: target.period,
            periodLabel: target.periodLabel,
            targetAmount: target.targetAmount
        });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.userId || !form.periodLabel || !form.targetAmount) return toast.error('All fields are required');
        try {
            if (editId) {
                await salesService.updateTarget(editId, { targetAmount: parseFloat(form.targetAmount) });
            } else {
                await salesService.createTarget({ ...form, targetAmount: parseFloat(form.targetAmount) });
            }
            toast.success(editId ? 'Target updated' : 'Target created');
            setShowForm(false);
            loadTargets();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this target?')) return;
        try {
            await salesService.deleteTarget(id);
            toast.success('Deleted');
            loadTargets();
        } catch (err) {
            toast.error('Failed');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
                        <MdFlag size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Sales Targets</h1>
                        <p className="text-xs text-slate-500">Set and track quotas</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {PERIODS.map(p => (
                        <button key={p} onClick={() => setFilterPeriod(p)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                                filterPeriod === p ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                            }`}>{p}</button>
                    ))}
                    <button onClick={openCreate}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 flex items-center gap-1.5">
                        <MdAdd size={18} /> Set Target
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {targets.map(t => {
                        const pct = t.achievementPercent || 0;
                        return (
                            <div key={t._id} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg transition-all">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="font-black text-slate-900">{t.userId?.name || 'Unknown'}</h3>
                                        <p className="text-xs text-slate-400 font-bold">{t.periodLabel} • {t.period}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><MdEdit size={16} /></button>
                                        <button onClick={() => handleDelete(t._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><MdDelete size={16} /></button>
                                    </div>
                                </div>
                                <div className="flex items-end justify-between mb-3">
                                    <div>
                                        <p className="text-xs text-slate-400">Achieved</p>
                                        <p className="text-lg font-black text-indigo-600">{formatCurrency(t.achievedAmount)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-400">Target</p>
                                        <p className="text-lg font-black text-slate-900">{formatCurrency(t.targetAmount)}</p>
                                    </div>
                                </div>
                                <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${
                                        pct >= 100 ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                                        pct >= 75 ? 'bg-gradient-to-r from-blue-500 to-indigo-500' :
                                        pct >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                                        'bg-gradient-to-r from-red-500 to-pink-500'
                                    }`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <p className={`text-right text-sm font-black mt-1 ${
                                    pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-indigo-600' : 'text-red-600'
                                }`}>{pct}%</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {targets.length === 0 && !loading && (
                <div className="text-center py-20 text-slate-400">
                    <p className="text-lg font-bold mb-2">No targets set</p>
                    <button onClick={openCreate} className="text-indigo-600 font-bold hover:underline">Set your first target</button>
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showForm}
                onClose={() => setShowForm(false)}
                title={editId ? 'Edit Target' : 'Set Target'}
                maxWidth="max-w-md"
                footer={
                    <>
                        <button onClick={() => setShowForm(false)} className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button onClick={handleSave} className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/25">Save</button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">User *</label>
                        <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} disabled={!!editId}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm disabled:bg-slate-50">
                            <option value="">Select User</option>
                            {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Period</label>
                            <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} disabled={!!editId}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm capitalize disabled:bg-slate-50">
                                {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Label</label>
                            <input type="text" value={form.periodLabel} onChange={e => setForm({ ...form, periodLabel: e.target.value })} disabled={!!editId}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm disabled:bg-slate-50" placeholder="Jun-2026" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Amount (₹) *</label>
                        <input type="number" value={form.targetAmount} onChange={e => setForm({ ...form, targetAmount: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SalesTargets;
