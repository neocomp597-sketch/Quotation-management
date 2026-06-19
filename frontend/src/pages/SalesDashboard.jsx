import React, { useState, useEffect } from 'react';
import { salesService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    MdTrendingUp, MdAccountBalance, MdBarChart, MdSpeed,
    MdTimer, MdEmojiEvents, MdShowChart, MdTrackChanges
} from 'react-icons/md';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316', '#14b8a6'];

const formatCurrency = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)} K`;
    return `₹${val}`;
};

const SalesDashboard = () => {
    const navigate = useNavigate();
    const [kpis, setKpis] = useState(null);
    const [trends, setTrends] = useState([]);
    const [performers, setPerformers] = useState([]);
    const [sourceData, setSourceData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            setLoading(true);
            const [kpiRes, trendRes, performerRes, sourceRes] = await Promise.all([
                salesService.getForecastDashboard(),
                salesService.getRevenueTrends(),
                salesService.getSalespersonAnalytics(),
                salesService.getSourceAnalytics()
            ]);
            setKpis(kpiRes.data);
            setTrends(trendRes.data);
            setPerformers(performerRes.data);
            setSourceData(sourceRes.data);
        } catch (err) {
            toast.error('Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    const kpiCards = kpis ? [
        { label: 'Revenue Forecast', value: formatCurrency(kpis.revenueForecast), icon: <MdTrendingUp />, color: 'from-indigo-500 to-purple-600', sub: 'Weighted pipeline' },
        { label: 'Pipeline Value', value: formatCurrency(kpis.pipelineValue), icon: <MdAccountBalance />, color: 'from-blue-500 to-cyan-500', sub: `${kpis.dealCount} open deals` },
        { label: 'Weighted Forecast', value: formatCurrency(kpis.weightedForecast), icon: <MdBarChart />, color: 'from-violet-500 to-fuchsia-500', sub: 'Probability adjusted' },
        { label: 'Closed Revenue', value: formatCurrency(kpis.closedRevenue), icon: <MdEmojiEvents />, color: 'from-emerald-500 to-green-600', sub: `${kpis.closedCount} deals this month` },
        { label: 'Win Rate', value: `${kpis.winRate}%`, icon: <MdTrackChanges />, color: 'from-amber-500 to-orange-500', sub: 'Last 90 days' },
        { label: 'Avg Deal Size', value: formatCurrency(kpis.avgDealSize), icon: <MdShowChart />, color: 'from-pink-500 to-rose-500', sub: 'Across open deals' },
        { label: 'Sales Cycle', value: `${kpis.salesCycleDays} Days`, icon: <MdTimer />, color: 'from-teal-500 to-emerald-500', sub: 'Avg time to win' },
        { label: 'Forecast Accuracy', value: `${kpis.forecastAccuracy}%`, icon: <MdSpeed />, color: 'from-sky-500 to-blue-600', sub: 'Last month snapshot' },
    ] : [];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Sales Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-1">Pipeline overview & revenue insights</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/sales/deals')}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/25"
                    >
                        View Deals
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {kpiCards.map((card, i) => (
                    <div
                        key={i}
                        className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 group"
                    >
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${card.color} opacity-10 rounded-bl-[3rem] group-hover:opacity-20 transition-opacity`} />
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white text-lg mb-3 shadow-lg`}>
                            {card.icon}
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{card.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Trend */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-lg font-black text-slate-900 mb-4">Revenue Trend</h3>
                    {trends.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="_id" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={formatCurrency} />
                                <Tooltip formatter={(val) => formatCurrency(val)} />
                                <Bar dataKey="revenue" fill="#6366f1" radius={[8, 8, 0, 0]} name="Revenue" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-60 text-slate-400 text-sm">No revenue data yet</div>
                    )}
                </div>

                {/* Deal Sources */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-lg font-black text-slate-900 mb-4">Deal Sources</h3>
                    {sourceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={sourceData}
                                    dataKey="totalDeals"
                                    nameKey="_id"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    innerRadius={50}
                                    label={({ _id, totalDeals }) => `${_id}: ${totalDeals}`}
                                >
                                    {sourceData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-60 text-slate-400 text-sm">No source data yet</div>
                    )}
                </div>
            </div>

            {/* Top Performers */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h3 className="text-lg font-black text-slate-900 mb-4">Top Sales Performers</h3>
                {performers.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">Rank</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">Salesperson</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">Total Deals</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">Won</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">Lost</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">Revenue</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">Win Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {performers.slice(0, 10).map((p, i) => (
                                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                        <td className="py-3 px-4">
                                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white ${
                                                i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-amber-700' : 'bg-slate-200 text-slate-600'
                                            }`}>{i + 1}</span>
                                        </td>
                                        <td className="py-3 px-4 font-bold text-slate-900">{p.userName || 'Unknown'}</td>
                                        <td className="py-3 px-4 text-right text-slate-600">{p.totalDeals}</td>
                                        <td className="py-3 px-4 text-right text-emerald-600 font-bold">{p.wonDeals}</td>
                                        <td className="py-3 px-4 text-right text-red-500">{p.lostDeals}</td>
                                        <td className="py-3 px-4 text-right font-black text-slate-900">{formatCurrency(p.totalRevenue)}</td>
                                        <td className="py-3 px-4 text-right">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                                p.conversionRate >= 50 ? 'bg-emerald-50 text-emerald-700' :
                                                p.conversionRate >= 25 ? 'bg-amber-50 text-amber-700' :
                                                'bg-red-50 text-red-700'
                                            }`}>{p.conversionRate}%</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400 text-sm">No performance data yet</div>
                )}
            </div>
        </div>
    );
};

export default SalesDashboard;
