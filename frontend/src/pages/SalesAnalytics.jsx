import React, { useState, useEffect } from 'react';
import { salesService } from '../services/api';
import { toast } from 'react-toastify';
import { MdAnalytics, MdWarning, MdSpeed, MdPerson } from 'react-icons/md';

const formatCurrency = (val) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
};

const daysSince = (date) => {
    if (!date) return '—';
    const days = Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24));
    return `${days}d`;
};

const SalesAnalytics = () => {
    const [velocity, setVelocity] = useState(null);
    const [stuck, setStuck] = useState(null);
    const [performers, setPerformers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [velRes, stuckRes, perfRes] = await Promise.all([
                salesService.getPipelineVelocity(),
                salesService.getStuckDeals(),
                salesService.getSalespersonAnalytics()
            ]);
            setVelocity(velRes.data);
            setStuck(stuckRes.data);
            setPerformers(perfRes.data || []);
        } catch (err) {
            toast.error('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center text-white shadow-lg">
                    <MdAnalytics size={22} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Sales Analytics</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Pipeline velocity, stuck deals & salesperson performance</p>
                </div>
            </div>

            {/* Pipeline Velocity */}
            {velocity && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: 'Avg Sales Cycle', value: `${velocity.avgCycleDays} days`, color: 'from-indigo-500 to-blue-600' },
                        { label: 'Min Cycle', value: `${velocity.minCycleDays} days`, color: 'from-emerald-500 to-green-600' },
                        { label: 'Max Cycle', value: `${velocity.maxCycleDays} days`, color: 'from-red-500 to-pink-600' },
                        { label: 'Win Rate', value: `${velocity.winRate}%`, color: 'from-amber-500 to-orange-600' },
                        { label: 'Velocity', value: formatCurrency(velocity.pipelineVelocity), color: 'from-violet-500 to-purple-600' },
                        { label: 'Won Deals', value: velocity.totalWonDeals, color: 'from-teal-500 to-cyan-600' },
                    ].map((card, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 hover:shadow-lg transition-all">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center text-white mb-2`}>
                                <MdSpeed size={16} />
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{card.label}</p>
                            <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">{card.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Stuck Deals */}
            {stuck && stuck.totalStuck > 0 && (
                <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <MdWarning className="text-amber-500" size={22} />
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Stuck Deals</h3>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">{stuck.totalStuck} total</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 30+ days */}
                        {stuck.thirtyDays?.length > 0 && (
                            <div>
                                <h4 className="text-xs font-black text-red-600 dark:text-red-400 uppercase mb-2 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    30+ Days ({stuck.thirtyDays.length})
                                </h4>
                                <div className="space-y-2">
                                    {stuck.thirtyDays.slice(0, 5).map((d, i) => (
                                        <div key={i} className="p-3 bg-red-50/50 dark:bg-rose-950/30 rounded-xl border border-red-100 dark:border-rose-900/40">
                                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{d.title}</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">{d.ownerId?.name || '—'}</span>
                                                <span className="text-xs font-bold text-red-600 dark:text-red-400">{daysSince(d.updatedAt)} inactive</span>
                                            </div>
                                            <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(d.value)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 15+ days */}
                        {stuck.fifteenDays?.length > 0 && (
                            <div>
                                <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase mb-2 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    15+ Days ({stuck.fifteenDays.length})
                                </h4>
                                <div className="space-y-2">
                                    {stuck.fifteenDays.slice(0, 5).map((d, i) => (
                                        <div key={i} className="p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900/40">
                                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{d.title}</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">{d.ownerId?.name || '—'}</span>
                                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{daysSince(d.updatedAt)} inactive</span>
                                            </div>
                                            <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(d.value)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 7+ days */}
                        {stuck.sevenDays?.length > 0 && (
                            <div>
                                <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase mb-2 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    7+ Days ({stuck.sevenDays.length})
                                </h4>
                                <div className="space-y-2">
                                    {stuck.sevenDays.slice(0, 5).map((d, i) => (
                                        <div key={i} className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40">
                                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{d.title}</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">{d.ownerId?.name || '—'}</span>
                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{daysSince(d.updatedAt)} inactive</span>
                                            </div>
                                            <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(d.value)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {stuck && stuck.totalStuck === 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 p-6 text-center">
                    <p className="text-emerald-700 dark:text-emerald-300 font-bold">✓ No stuck deals! All deals are moving through the pipeline.</p>
                </div>
            )}

            {/* Salesperson Performance */}
            {performers.length > 0 && (
                <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <MdPerson className="text-indigo-500" size={22} />
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Salesperson Performance</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Salesperson</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Total</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Open</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Won</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Lost</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Revenue</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Pipeline</th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Win Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {performers.map((p, i) => (
                                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{p.userName || 'Unknown'}</td>
                                        <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{p.totalDeals}</td>
                                        <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400 font-semibold">{p.openDeals}</td>
                                        <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-bold">{p.wonDeals}</td>
                                        <td className="py-3 px-4 text-right text-red-500 dark:text-red-400">{p.lostDeals}</td>
                                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-slate-100">{formatCurrency(p.totalRevenue)}</td>
                                        <td className="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400 font-bold">{formatCurrency(p.pipelineValue)}</td>
                                        <td className="py-3 px-4 text-right">
                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
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
                </div>
            )}
        </div>
    );
};

export default SalesAnalytics;
