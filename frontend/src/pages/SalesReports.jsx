import React, { useState, useEffect } from 'react';
import { salesService } from '../services/api';
import { toast } from 'react-toastify';
import { MdBarChart, MdFilterList } from 'react-icons/md';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    PieChart, Pie, Cell, FunnelChart, Funnel, LabelList
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316', '#14b8a6'];

const formatCurrency = (val) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
};

const SalesReports = () => {
    const [pipelines, setPipelines] = useState([]);
    const [selectedPipeline, setSelectedPipeline] = useState('');
    const [funnel, setFunnel] = useState(null);
    const [dropoff, setDropoff] = useState(null);
    const [sourceData, setSourceData] = useState([]);
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPipelines();
        loadGeneral();
    }, []);

    useEffect(() => {
        if (selectedPipeline) loadFunnel();
    }, [selectedPipeline]);

    const loadPipelines = async () => {
        try {
            const res = await salesService.getPipelines();
            setPipelines(res.data || []);
            if (res.data?.length > 0) {
                const def = res.data.find(p => p.isDefault) || res.data[0];
                setSelectedPipeline(def._id);
            }
        } catch (err) {
            console.error('Failed to load pipelines');
        }
    };

    const loadGeneral = async () => {
        try {
            setLoading(true);
            const [dropoffRes, sourceRes, trendRes] = await Promise.all([
                salesService.getStageDropoff(),
                salesService.getSourceAnalytics(),
                salesService.getRevenueTrends()
            ]);
            setDropoff(dropoffRes.data);
            setSourceData(sourceRes.data || []);
            setTrends(trendRes.data || []);
        } catch (err) {
            toast.error('Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    const loadFunnel = async () => {
        try {
            const res = await salesService.getPipelineFunnel(selectedPipeline);
            setFunnel(res.data);
        } catch (err) {
            console.error('Failed to load funnel');
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                        <MdBarChart size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Sales Reports</h1>
                        <p className="text-xs text-slate-500">Pipeline funnel, win/loss & revenue reports</p>
                    </div>
                </div>
                <select value={selectedPipeline} onChange={e => setSelectedPipeline(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white">
                    {pipelines.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pipeline Funnel */}
                {funnel && (
                    <div className="bg-white rounded-2xl border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-slate-900">Pipeline Funnel</h3>
                            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700">
                                Conversion: {funnel.conversionRate}%
                            </span>
                        </div>
                        <div className="space-y-2">
                            {funnel.funnel.map((stage, i) => {
                                const maxCount = Math.max(...funnel.funnel.map(s => s.count), 1);
                                const width = Math.max((stage.count / maxCount) * 100, 8);
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-slate-500 w-28 truncate">{stage.name}</span>
                                        <div className="flex-1 relative">
                                            <div className="bg-slate-100 rounded-full h-8 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full flex items-center px-3 transition-all duration-500"
                                                    style={{ width: `${width}%`, backgroundColor: stage.color }}
                                                >
                                                    <span className="text-xs font-black text-white drop-shadow">{stage.count}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 w-20 text-right">{formatCurrency(stage.value)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Win/Loss Analysis */}
                {dropoff?.lossReasons?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 p-6">
                        <h3 className="text-lg font-black text-slate-900 mb-4">Loss Reasons</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={dropoff.lossReasons}
                                    dataKey="count"
                                    nameKey="_id"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    innerRadius={45}
                                    label={({ _id, count }) => `${_id}: ${count}`}
                                >
                                    {dropoff.lossReasons.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Revenue by Source */}
                {sourceData.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 p-6">
                        <h3 className="text-lg font-black text-slate-900 mb-4">Revenue by Source</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={sourceData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={formatCurrency} />
                                <YAxis type="category" dataKey="_id" tick={{ fontSize: 11 }} stroke="#94a3b8" width={100} />
                                <Tooltip formatter={(val) => formatCurrency(val)} />
                                <Bar dataKey="totalRevenue" fill="#6366f1" radius={[0, 8, 8, 0]} name="Revenue" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Revenue by Month */}
                {trends.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 p-6">
                        <h3 className="text-lg font-black text-slate-900 mb-4">Revenue by Month</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="_id" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={formatCurrency} />
                                <Tooltip formatter={(val) => formatCurrency(val)} />
                                <Legend />
                                <Bar dataKey="revenue" name="Won Revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
                                <Bar dataKey="count" name="Deals" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Stage Drop-off Table */}
            {dropoff?.dropoff?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="text-lg font-black text-slate-900 mb-4">Stage Drop-off Analysis</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">Stage</th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase">Pipeline</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">Lost Deals</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase">Lost Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dropoff.dropoff.map((d, i) => (
                                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.stageColor }} />
                                            {d.stageName}
                                        </td>
                                        <td className="py-3 px-4 text-slate-600">{d.pipelineName}</td>
                                        <td className="py-3 px-4 text-right text-red-600 font-bold">{d.lostCount}</td>
                                        <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(d.lostValue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesReports;
