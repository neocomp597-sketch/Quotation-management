import React, { useCallback, useEffect, useRef, useState } from 'react';
import { csmService } from '../services/api';
import { formatDateTime } from '../utils/helpers';
import {
    ResponsiveContainer, PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, Tooltip
} from 'recharts';
import {
    MdAssignment, MdTimer, MdTrendingUp, MdFlashOn,
    MdLocationOn, MdPerson, MdTune, MdInsights
} from 'react-icons/md';
import { toast } from 'react-toastify';
import CSMDashboardFilter, { CSMDashboardHeader } from '../components/csm/CSMDashboardFilter';
import { useCSMDashboardFilters } from '../hooks/useCSMDashboardFilters';

const COLORS = ['#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#f43f5e', '#64748b'];

const STATUS_COLORS = {
    'Open': '#10b981',       // Emerald
    'Assigned': '#3b82f6',   // Blue
    'In Progress': '#8b5cf6',// Purple
    'Pending Customer': '#f59e0b', // Amber
    'Resolved': '#0d9488',   // Teal
    'Closed': '#64748b',     // Slate
    'Cancelled': '#ef4444'   // Red
};

const getVisitStatusBadge = (status) => {
    switch (status) {
        case 'Completed':
            return <span className="px-2.5 py-0.5 text-[10px] font-black tracking-widest uppercase rounded-full bg-teal-50 text-teal-600 border border-teal-200">Completed</span>;
        case 'Started':
            return <span className="px-2.5 py-0.5 text-[10px] font-black tracking-widest uppercase rounded-full bg-amber-50 text-amber-600 border border-amber-200 animate-pulse">In Progress</span>;
        case 'Scheduled':
            return <span className="px-2.5 py-0.5 text-[10px] font-black tracking-widest uppercase rounded-full bg-slate-100 text-slate-600 border border-slate-200">Scheduled</span>;
        default:
            return <span className="px-2.5 py-0.5 text-[10px] font-black tracking-widest uppercase rounded-full bg-slate-100 text-slate-600 border border-slate-200">{status}</span>;
    }
};

const formatVisitDate = (dateString) => {
    try {
        return formatDateTime(dateString, dateString);
    } catch {
        return dateString;
    }
};

// Detailed service analytics that used to sit under the ticket cards on the CSM Dashboard.
const CSMDetailDashboard = () => {
    const filters = useCSMDashboardFilters();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [visits, setVisits] = useState([]);
    const [seeding, setSeeding] = useState(false);
    const latestRequest = useRef(0);

    const loadStats = useCallback(async () => {
        // Ignore responses that arrive after a newer filter change
        const requestId = ++latestRequest.current;
        setLoading(true);
        try {
            const [statsRes, visitsRes] = await Promise.all([
                csmService.getStats(filters.params),
                csmService.getVisits(filters.params)
            ]);
            if (requestId !== latestRequest.current) return;
            setStats(statsRes.data);
            setVisits(visitsRes.data || []);
        } catch (error) {
            console.error('Fetch dashboard stats error:', error);
            if (requestId === latestRequest.current) toast.error('Failed to load dashboard statistics');
        } finally {
            if (requestId === latestRequest.current) setLoading(false);
        }
    }, [filters.params]);

    const handleSeedMhData = async () => {
        setSeeding(true);
        const toastId = toast.loading("Seeding Maharashtra electrical utility installations & active tickets...");
        try {
            await csmService.seedMhData();
            toast.update(toastId, {
                render: "Maharashtra utility data seeded successfully!",
                type: "success",
                isLoading: false,
                autoClose: 3000
            });
            await loadStats();
        } catch (error) {
            console.error('Seed MH Data error:', error);
            toast.update(toastId, {
                render: error.response?.data?.message || 'Error seeding Maharashtra utility data',
                type: "error",
                isLoading: false,
                autoClose: 4000
            });
        } finally {
            setSeeding(false);
        }
    };

    useEffect(() => {
        loadStats();
        window.addEventListener('onCsmDataSeeded', loadStats);
        return () => {
            window.removeEventListener('onCsmDataSeeded', loadStats);
        };
    }, [loadStats]);

    const statusData = stats?.statusBreakdown || [];
    const categoryData = stats?.categoryBreakdown || [];
    const complianceData = stats?.slaCompliance || [];
    const engineers = stats?.engineerPerformance || [];

    const totalTickets = statusData.reduce((acc, curr) => acc + curr.value, 0);
    const isDashboardEmpty = totalTickets === 0 && visits.length === 0;

    // Compute SLA compliance percentage
    const totalSlaTickets = (complianceData.find(d => d.name === 'Compliant')?.value || 0) +
                            (complianceData.find(d => d.name === 'Breached')?.value || 0);
    const compliantCount = complianceData.find(d => d.name === 'Compliant')?.value || 0;
    const complianceRate = totalSlaTickets > 0 ? ((compliantCount / totalSlaTickets) * 100).toFixed(1) : '100.0';

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            <CSMDashboardHeader
                title="CSM Detail Dashboard"
                icon={<MdInsights className="text-teal-600" />}
                onRefresh={loadStats}
                refreshing={loading}
            />

            <CSMDashboardFilter filters={filters} />

            {loading && !stats ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">Loading Analytics Dashboard...</p>
                </div>
            ) : isDashboardEmpty ? (
                /* Empty State Call to Action */
                <div className="bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950 text-white rounded-[2.5rem] p-12 shadow-xl text-center space-y-6 max-w-2xl mx-auto my-12 border border-teal-950 animate-scale-in">
                    <div className="w-20 h-20 bg-teal-800/50 rounded-3xl flex items-center justify-center mx-auto text-teal-300">
                        <MdFlashOn size={48} className="animate-float" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black font-outfit">No Service Data Registered</h3>
                        <p className="text-teal-200/80 text-sm max-w-md mx-auto leading-relaxed font-medium">
                            No tickets or service logs matched the selected filters.
                        </p>
                    </div>
                    <div className="pt-2">
                        <button
                            onClick={handleSeedMhData}
                            disabled={seeding}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-400 to-emerald-400 text-teal-950 font-black px-8 py-4 rounded-2xl hover:from-teal-300 hover:to-emerald-300 transition-all shadow-lg text-sm uppercase tracking-wider"
                        >
                            {seeding ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-teal-950 border-t-transparent rounded-full animate-spin"></div>
                                    Populating Utility Data...
                                </>
                            ) : "Populate Maharashtra Utility Data"}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* SLA & Time Metrics Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Avg Resolution Card */}
                        <div className="shadow-premium rounded-[2rem] p-6 bg-gradient-to-br from-teal-800 via-teal-900 to-slate-950 text-white flex flex-col justify-between border border-teal-900 h-[300px]">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">Resolution Speed</span>
                                <div className="p-2 bg-teal-500/20 rounded-xl text-teal-300">
                                    <MdTimer size={22} />
                                </div>
                            </div>
                            <div className="py-2">
                                <h2 className="text-5xl font-black font-outfit leading-none mb-2 text-white drop-shadow-sm">
                                    {stats?.avgResolutionHours || 0} hrs
                                </h2>
                                <p className="text-xs font-bold text-teal-200/90">Average resolution cycle time per ticket</p>
                            </div>
                            <div className="border-t border-teal-800/60 pt-4 flex items-center gap-2 text-xs font-bold text-teal-300/90">
                                <MdTrendingUp size={16} className="text-teal-400" />
                                Calculated from all closed cases this period
                            </div>
                        </div>

                        {/* SLA Compliance Donut */}
                        <div className="shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between h-[300px]">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">SLA Resolution Compliance</h3>
                            </div>
                            <div className="flex items-center gap-4 flex-1 min-h-0 relative">
                                <div className="w-1/2 h-[180px] relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={complianceData.some(d => d.value > 0) ? complianceData : [{ name: 'No Data', value: 1 }]}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={70}
                                                paddingAngle={4}
                                                dataKey="value"
                                            >
                                                {complianceData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={entry.name === 'Compliant' ? '#0d9488' : '#f43f5e'}
                                                    />
                                                ))}
                                                {!complianceData.some(d => d.value > 0) && (
                                                    <Cell key="cell-empty" fill="#e2e8f0" />
                                                )}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-outfit leading-none">{complianceRate}%</span>
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">SLA Met</span>
                                    </div>
                                </div>
                                <div className="w-1/2 space-y-2 font-semibold text-xs text-slate-500 dark:text-slate-400">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Milestone Review</p>
                                    <p className="leading-relaxed text-[11px]">SLA breaches represent tickets where engineers exceeded priority-defined fix durations.</p>
                                    <div className="pt-1">
                                        <span className="font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/50 rounded-xl px-3 py-1.5 inline-block text-[11px]">Target: 95.0%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Service Visits Timeline */}
                        <div className="shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col h-[300px]">
                            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-3">Field Service Log</h3>
                            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                                {visits.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-bold py-8">
                                        No service visits recorded.
                                    </div>
                                ) : (
                                    visits.slice(0, 5).map((visit, idx) => (
                                        <div key={visit._id || idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-700/60 flex flex-col space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="font-black text-slate-800 dark:text-slate-100 text-xs tracking-tight">{visit.visitNo}</span>
                                                {getVisitStatusBadge(visit.status)}
                                            </div>
                                            <div className="text-xs text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1">
                                                <MdLocationOn className="text-teal-600 dark:text-teal-400 shrink-0" size={13} />
                                                <span className="truncate">{visit.ticketId?.customerId?.customerName || 'Unknown Location'}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
                                                <span className="flex items-center gap-0.5">
                                                    <MdPerson size={12} /> {visit.engineerId?.name || 'Unassigned'}
                                                </span>
                                                <span>{formatVisitDate(visit.scheduledDate)}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Tickets by Status */}
                        <div className="shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 h-[360px] flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Tickets by Status</h3>
                                <span className="text-xs font-bold text-slate-400">{totalTickets} Total</span>
                            </div>
                            <div className="flex-1 w-full min-h-[260px] relative flex items-center justify-center">
                                {statusData.length === 0 || !statusData.some(d => d.value > 0) ? (
                                    <div className="flex flex-col items-center justify-center text-slate-400 text-xs font-semibold space-y-2">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                            <MdAssignment size={24} />
                                        </div>
                                        <p>No status data for selected period</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={statusData}
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={90}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                                dataKey="value"
                                                tick={{ fontSize: 11, fontWeight: 'bold' }}
                                            >
                                                {statusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Tickets by Category */}
                        <div className="shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 h-[360px] flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Tickets by Category</h3>
                                <span className="text-xs font-bold text-slate-400">{categoryData.reduce((acc, curr) => acc + curr.value, 0)} Categorized</span>
                            </div>
                            <div className="flex-1 w-full min-h-[260px] relative flex items-center justify-center">
                                {categoryData.length === 0 || !categoryData.some(d => d.value > 0) ? (
                                    <div className="flex flex-col items-center justify-center text-slate-400 text-xs font-semibold space-y-2">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                            <MdTune size={24} />
                                        </div>
                                        <p>No category breakdown for selected period</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fontWeight: '600', fill: '#64748b' }} />
                                            <Tooltip />
                                            <Bar dataKey="value" fill="#0d9488" radius={[0, 8, 8, 0]} barSize={18} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Engineer Performance Leaderboard */}
                    <div className="shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-4">Top Performing Engineers</h3>
                        {engineers.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm font-bold">
                                No closed tickets resolved by engineers yet for selected filters.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 dark:border-slate-800">
                                            <th className="pb-3 pl-4">Engineer</th>
                                            <th className="pb-3">Tickets Resolved</th>
                                            <th className="pb-3">Average CSAT Score</th>
                                            <th className="pb-3 text-right pr-4">Performance Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        {engineers.map((eng, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="py-4 pl-4 font-black text-slate-900 dark:text-slate-100">{eng.name}</td>
                                                <td className="py-4 font-black text-teal-600 dark:text-teal-400">{eng.resolvedCount} cases</td>
                                                <td className="py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-amber-500 text-lg leading-none">★</span>
                                                        <span className="font-bold">{eng.avgRating ? eng.avgRating.toFixed(1) : 'N/A'}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right pr-4">
                                                    <span className="px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-full bg-teal-50 text-teal-600 border border-teal-200">
                                                        Excellent
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default CSMDetailDashboard;
