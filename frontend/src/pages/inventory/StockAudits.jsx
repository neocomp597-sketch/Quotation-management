import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    MdFactCheck,
    MdAdd,
    MdCheckCircle,
    MdEdit
} from 'react-icons/md';

const API_BASE = '/inventory';

const StockAudits = () => {
    const navigate = useNavigate();
    const [counts, setCounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    const fetchCounts = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${API_BASE}/counts`, {
                params: { status: statusFilter }
            });
            setCounts(res.data?.counts || []);
        } catch (error) {
            console.error('Error fetching stock counts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCounts();
    }, [statusFilter]);

    const handleReconcile = async (id) => {
        if (!window.confirm('Reconcile physical audit session? Discrepancies will be automatically adjusted in Stock Ledger.')) return;
        try {
            const res = await api.post(`${API_BASE}/counts/${id}/reconcile`);
            alert(res.data?.message || 'Physical count reconciled!');
            fetchCounts();
        } catch (error) {
            alert(error.response?.data?.message || 'Error reconciling audit');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'In_Progress':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">In Progress</span>;
            case 'Pending_Review':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Pending Review</span>;
            case 'Completed':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Completed</span>;
            default:
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">{status}</span>;
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MdFactCheck className="text-teal-600 dark:text-teal-400" /> Physical Audit Counts
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Conduct periodic inventory audits, record physical quantities, and auto-reconcile stock variances.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/inventory/counts/new')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-md text-sm"
                >
                    <MdAdd className="text-lg" /> Start Physical Audit
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-4">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Audit Statuses</option>
                    <option value="In_Progress">In Progress</option>
                    <option value="Pending_Review">Pending Review</option>
                    <option value="Completed">Completed</option>
                </select>
            </div>

            {/* Directory Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">Loading audit sessions...</div>
                ) : counts.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">No physical count sessions found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">Audit Session #</th>
                                    <th className="px-5 py-3.5 font-semibold">Warehouse</th>
                                    <th className="px-5 py-3.5 font-semibold">Items Counted</th>
                                    <th className="px-5 py-3.5 font-semibold">Status</th>
                                    <th className="px-5 py-3.5 font-semibold">Scheduled Date</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {counts.map(cnt => (
                                    <tr key={cnt._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-5 py-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                            {cnt.countNumber}
                                        </td>
                                        <td className="px-5 py-4 text-xs font-medium text-slate-800 dark:text-slate-200">
                                            {cnt.warehouseId?.warehouseName || 'Main Warehouse'}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300">
                                            {cnt.items?.length || 0} product(s)
                                        </td>
                                        <td className="px-5 py-4">
                                            {getStatusBadge(cnt.status)}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-slate-400">
                                            {new Date(cnt.scheduledDate).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="px-5 py-4 text-right space-x-2">
                                            {['In_Progress', 'Pending_Review'].includes(cnt.status) && (
                                                <button
                                                    onClick={() => navigate(`/inventory/counts/record/${cnt._id}`)}
                                                    className="px-3 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                                                >
                                                    <MdEdit /> Record Count Page
                                                </button>
                                            )}

                                            {cnt.status === 'Pending_Review' && (
                                                <button
                                                    onClick={() => handleReconcile(cnt._id)}
                                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                                                >
                                                    <MdCheckCircle /> Reconcile
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockAudits;
