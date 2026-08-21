import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    MdTune,
    MdAdd,
    MdSearch,
    MdCheckCircle,
    MdCancel
} from 'react-icons/md';

const API_BASE = '/inventory';

const StockAdjustments = () => {
    const navigate = useNavigate();
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    const fetchAdjustments = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${API_BASE}/adjustments`, {
                params: { status: statusFilter, adjustmentType: typeFilter }
            });
            setAdjustments(res.data?.adjustments || []);
        } catch (error) {
            console.error('Error fetching adjustments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdjustments();
    }, [statusFilter, typeFilter]);

    const handleApprove = async (id) => {
        if (!window.confirm('Approve this stock adjustment? This will immediately modify stock balance in Stock Ledger!')) return;
        try {
            await api.post(`${API_BASE}/adjustments/${id}/approve`);
            fetchAdjustments();
            alert('Stock adjustment approved and ledger updated!');
        } catch (error) {
            alert(error.response?.data?.message || 'Error approving adjustment');
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt('Enter rejection reason:');
        if (!reason) return;
        try {
            await api.post(`${API_BASE}/adjustments/${id}/reject`, { rejectionReason: reason });
            fetchAdjustments();
            alert('Stock adjustment rejected.');
        } catch (error) {
            alert(error.response?.data?.message || 'Error rejecting adjustment');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING_APPROVAL':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Pending Approval</span>;
            case 'APPROVED':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Approved</span>;
            case 'REJECTED':
                return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Rejected</span>;
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
                        <MdTune className="text-teal-600 dark:text-teal-400" /> Stock Adjustments
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Record stock write-offs for damaged goods, inventory loss, expiry, or audit physical variances.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/inventory/adjustments/new')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-md text-sm"
                >
                    <MdAdd className="text-lg" /> New Adjustment
                </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Statuses</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                </select>

                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                >
                    <option value="">All Adjustment Types</option>
                    <option value="Damage">Damage</option>
                    <option value="Loss">Loss</option>
                    <option value="Expiry">Expiry</option>
                    <option value="Physical_Variance">Physical Variance</option>
                </select>
            </div>

            {/* Directory Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">Loading adjustments...</div>
                ) : adjustments.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">No stock adjustment records found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase text-xs">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">Adjustment #</th>
                                    <th className="px-5 py-3.5 font-semibold">Warehouse</th>
                                    <th className="px-5 py-3.5 font-semibold">Reason / Type</th>
                                    <th className="px-5 py-3.5 font-semibold">Status</th>
                                    <th className="px-5 py-3.5 font-semibold">Requested By</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {adjustments.map(adj => (
                                    <tr key={adj._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-5 py-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                            {adj.adjustmentNumber}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-slate-700 dark:text-slate-300">
                                            {adj.warehouseId?.warehouseName || 'Main Warehouse'}
                                        </td>
                                        <td className="px-5 py-4 text-xs font-medium">
                                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full">
                                                {adj.adjustmentType}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {getStatusBadge(adj.status)}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-slate-500">
                                            {adj.requestedBy?.name || 'Manager'}
                                        </td>
                                        <td className="px-5 py-4 text-right space-x-2">
                                            {adj.status === 'PENDING_APPROVAL' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(adj._id)}
                                                        className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(adj._id)}
                                                        className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-lg"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
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

export default StockAdjustments;
