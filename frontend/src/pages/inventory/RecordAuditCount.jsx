import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import {
    MdFactCheck,
    MdArrowBack,
    MdSave,
    MdInventory
} from 'react-icons/md';

const API_BASE = '/inventory';

const RecordAuditCount = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    const [auditSession, setAuditSession] = useState(null);
    const [countsMap, setCountsMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get(`${API_BASE}/counts/${id}`)
            .then(res => {
                const session = res.data?.session || res.data;
                setAuditSession(session);
                const initialMap = {};
                (session.items || []).forEach(item => {
                    initialMap[item.productId] = item.countedQty !== undefined ? item.countedQty : item.expectedQty;
                });
                setCountsMap(initialMap);
            })
            .catch(err => {
                console.error('Error fetching audit session:', err);
                setError('Failed to load audit session details.');
            })
            .finally(() => setLoading(false));
    }, [id]);

    const handleQtyChange = (productId, val) => {
        setCountsMap(prev => ({
            ...prev,
            [productId]: Number(val)
        }));
    };

    const handleSubmitCounts = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const itemsPayload = Object.keys(countsMap).map(pId => ({
            productId: pId,
            countedQty: countsMap[pId]
        }));

        try {
            await api.put(`${API_BASE}/counts/${id}/record`, { items: itemsPayload });
            alert('Physical audit counts recorded successfully!');
            navigate('/inventory/counts');
        } catch (err) {
            console.error('Error saving counts:', err);
            setError(err.response?.data?.message || 'Error recording physical counts');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-12 text-center text-slate-400">Loading audit session...</div>;
    }

    if (error || !auditSession) {
        return (
            <div className="p-6 max-w-4xl mx-auto space-y-4">
                <button onClick={() => navigate('/inventory/counts')} className="flex items-center gap-2 text-sm text-teal-600 font-semibold">
                    <MdArrowBack /> Back to Audits
                </button>
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">{error || 'Session not found'}</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/inventory/counts')}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
                    >
                        <MdArrowBack className="text-xl" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MdFactCheck className="text-teal-600 dark:text-teal-400" /> Record Audit — {auditSession.countNumber}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Warehouse: <span className="font-bold text-slate-700 dark:text-slate-200">{auditSession.warehouseId?.warehouseName || 'Main Depot'}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/inventory/counts')}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmitCounts}
                        disabled={submitting || auditSession.status === 'RECONCILED'}
                        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-md text-sm disabled:opacity-50"
                    >
                        <MdSave className="text-lg" /> {submitting ? 'Saving...' : 'Save Physical Counts'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Product Physical Counts Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <MdInventory className="text-teal-600" /> Count Verification Sheet ({auditSession.items?.length || 0} Items)
                    </span>
                    {auditSession.status === 'RECONCILED' && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full">
                            RECONCILED & LOCKED
                        </span>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 uppercase text-xs">
                            <tr>
                                <th className="px-5 py-3 font-semibold">SKU / Code</th>
                                <th className="px-5 py-3 font-semibold">Product Name</th>
                                <th className="px-5 py-3 font-semibold text-right">System Expected</th>
                                <th className="px-5 py-3 font-semibold text-right w-44">Physical Counted</th>
                                <th className="px-5 py-3 font-semibold text-right">Variance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {auditSession.items?.map((item, idx) => {
                                const prod = item.productId;
                                const prodId = prod?._id || item.productId;
                                const counted = countsMap[prodId] !== undefined ? countsMap[prodId] : item.expectedQty;
                                const variance = counted - item.expectedQty;

                                return (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-5 py-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                            {prod?.productCode || 'PROD-00'}
                                        </td>
                                        <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">
                                            {prod?.productName || 'Inventory Product'}
                                        </td>
                                        <td className="px-5 py-4 text-right font-semibold text-slate-600 dark:text-slate-300">
                                            {item.expectedQty}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <input
                                                type="number"
                                                disabled={auditSession.status === 'RECONCILED'}
                                                value={counted}
                                                onChange={(e) => handleQtyChange(prodId, e.target.value)}
                                                className="w-full text-right px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-teal-600 focus:outline-none focus:border-teal-500"
                                            />
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <span className={`font-bold px-2.5 py-1 rounded-lg text-xs ${variance === 0 ? 'bg-emerald-50 text-emerald-700' : variance > 0 ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>
                                                {variance > 0 ? `+${variance}` : variance}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default RecordAuditCount;
