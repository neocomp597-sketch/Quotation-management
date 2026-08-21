import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    MdNotificationsActive,
    MdWarning,
    MdError,
    MdCheckCircle,
    MdRefresh
} from 'react-icons/md';

const API_BASE = '/inventory';

const StockAlertsPage = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isResolved, setIsResolved] = useState('false');

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${API_BASE}/alerts`, {
                params: { isResolved }
            });
            setAlerts(res.data?.alerts || []);
        } catch (error) {
            console.error('Error loading stock alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, [isResolved]);

    const handleResolve = async (id) => {
        try {
            await api.post(`${API_BASE}/alerts/${id}/resolve`);
            fetchAlerts();
        } catch (error) {
            alert('Error resolving alert');
        }
    };

    const getSeverityBadge = (severity) => {
        switch (severity) {
            case 'Critical':
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1"><MdError /> Critical</span>;
            case 'Warning':
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1"><MdWarning /> Warning</span>;
            default:
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">Info</span>;
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MdNotificationsActive className="text-amber-500" /> Stock Alerts
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Active system notifications for items exceeding minimum reorder thresholds or out of stock.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={isResolved}
                        onChange={(e) => setIsResolved(e.target.value)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium"
                    >
                        <option value="false">Active Alerts Only</option>
                        <option value="true">Resolved History</option>
                    </select>
                    <button
                        onClick={fetchAlerts}
                        className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200"
                    >
                        <MdRefresh className="text-lg" />
                    </button>
                </div>
            </div>

            {/* Alert Cards List */}
            {loading ? (
                <div className="p-12 text-center text-slate-400">Loading alerts...</div>
            ) : alerts.length === 0 ? (
                <div className="p-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center text-slate-400">
                    No active stock alerts found. All inventory levels are healthy!
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {alerts.map(alert => (
                        <div key={alert._id} className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-4">
                            <div>
                                <div className="flex items-center justify-between">
                                    {getSeverityBadge(alert.severity)}
                                    <span className="text-xs text-slate-400 font-mono">
                                        {new Date(alert.createdAt).toLocaleDateString('en-IN')}
                                    </span>
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3">
                                    {alert.productId?.productName || 'Inventory Product'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {alert.message}
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700 text-xs">
                                <span className="text-slate-600 dark:text-slate-300 font-medium">
                                    Current Stock: <strong className="text-slate-900 dark:text-white">{alert.currentStock}</strong> (Min: {alert.minStock})
                                </span>
                                {!alert.isResolved && (
                                    <button
                                        onClick={() => handleResolve(alert._id)}
                                        className="px-3 py-1.5 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-semibold rounded-lg hover:bg-teal-100 flex items-center gap-1"
                                    >
                                        <MdCheckCircle /> Mark Resolved
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StockAlertsPage;
