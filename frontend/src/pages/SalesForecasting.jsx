import React, { useState, useEffect } from 'react';
import { salesService } from '../services/api';
import { toast } from 'react-toastify';
import { MdTrendingUp, MdFilterList } from 'react-icons/md';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const FORECAST_CATS = ['Pipeline', 'Best Case', 'Commit', 'Closed', 'Omitted'];

const formatCurrency = (val) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
};

const SalesForecasting = () => {
    const [data, setData] = useState(null);
    const [accuracy, setAccuracy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('');

    useEffect(() => { loadData(); }, [filterCategory]);

    const loadData = async () => {
        try {
            setLoading(true);
            const params = {};
            if (filterCategory) params.forecastCategory = filterCategory;
            const [forecastRes, accuracyRes] = await Promise.all([
                salesService.getRevenueForecast(params),
                salesService.getForecastAccuracy()
            ]);
            setData(forecastRes.data);
            setAccuracy(accuracyRes.data);
        } catch (err) {
            toast.error('Failed to load forecast');
        } finally {
            setLoading(false);
        }
    };

    const handleSnapshot = async () => {
        try {
            await salesService.takeSnapshot();
            toast.success('Forecast snapshot saved');
            loadData();
        } catch (err) {
            toast.error('Failed to take snapshot');
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
                        <MdTrendingUp size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Sales Forecasting</h1>
                        <p className="text-xs text-slate-500">Revenue predictions & accuracy</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white">
                        <option value="">All Categories</option>
                        {FORECAST_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={handleSnapshot} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/25">
                        Take Snapshot
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-100 p-5">
                        <p className="text-xs font-bold text-slate-400 uppercase">Expected Revenue</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(data.expectedRevenue)}</p>
                        <p className="text-xs text-slate-400 mt-1">Total open deal value</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5">
                        <p className="text-xs font-bold text-slate-400 uppercase">Weighted Revenue</p>
                        <p className="text-2xl font-black text-indigo-600 mt-1">{formatCurrency(data.weightedRevenue)}</p>
                        <p className="text-xs text-slate-400 mt-1">Value × Probability</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5">
                        <p className="text-xs font-bold text-slate-400 uppercase">Best Case</p>
                        <p className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(data.bestCase)}</p>
                        <p className="text-xs text-slate-400 mt-1">Commit + Best Case deals</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5">
                        <p className="text-xs font-bold text-slate-400 uppercase">Worst Case</p>
                        <p className="text-2xl font-black text-amber-600 mt-1">{formatCurrency(data.worstCase)}</p>
                        <p className="text-xs text-slate-400 mt-1">Commit deals only</p>
                    </div>
                </div>
            )}

            {/* Forecast Table */}
            {data?.deals?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-lg font-black text-slate-900 mb-4">Forecast Breakdown</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">Deal</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">Customer</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">Category</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">Value</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">Prob.</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">Forecast</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.deals.map((deal, i) => (
                                    <tr key={deal._id || i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                        <td className="py-3 px-4 font-bold text-slate-900">{deal.title}</td>
                                        <td className="py-3 px-4 text-slate-600">{deal.customerId?.companyName || deal.customerId?.customerName || '—'}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                                                deal.forecastCategory === 'Commit' ? 'bg-emerald-50 text-emerald-700' :
                                                deal.forecastCategory === 'Best Case' ? 'bg-blue-50 text-blue-700' :
                                                deal.forecastCategory === 'Closed' ? 'bg-green-50 text-green-700' :
                                                deal.forecastCategory === 'Omitted' ? 'bg-red-50 text-red-700' :
                                                'bg-slate-50 text-slate-700'
                                            }`}>{deal.forecastCategory}</span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(deal.value)}</td>
                                        <td className="py-3 px-4 text-right text-indigo-600 font-bold">{deal.probability}%</td>
                                        <td className="py-3 px-4 text-right font-black text-emerald-600">{formatCurrency(deal.weightedValue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 font-black">
                                    <td colSpan={3} className="py-3 px-4 text-slate-900">Total</td>
                                    <td className="py-3 px-4 text-right text-slate-900">{formatCurrency(data.expectedRevenue)}</td>
                                    <td className="py-3 px-4"></td>
                                    <td className="py-3 px-4 text-right text-emerald-600">{formatCurrency(data.weightedRevenue)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Accuracy */}
            {accuracy?.userAccuracy?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-lg font-black text-slate-900 mb-4">Forecast Accuracy by User</h3>
                    <div className="space-y-3">
                        {accuracy.userAccuracy.map((u, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <span className="text-sm font-bold text-slate-700 w-32 truncate">{u.userName || 'Unknown'}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                                        style={{ width: `${Math.min(u.accuracy, 100)}%` }} />
                                </div>
                                <span className="text-sm font-black text-slate-900 w-16 text-right">{u.accuracy}%</span>
                                <span className="text-xs text-slate-400 w-32 text-right">{formatCurrency(u.totalAchieved)} / {formatCurrency(u.totalTarget)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Historical Snapshots */}
            {accuracy?.snapshots?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-lg font-black text-slate-900 mb-4">Historical Forecast vs Actual</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={accuracy.snapshots}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={formatCurrency} />
                            <Tooltip formatter={(val) => formatCurrency(val)} />
                            <Legend />
                            <Bar dataKey="weightedForecast" name="Forecast" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="actualRevenue" name="Actual" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default SalesForecasting;
