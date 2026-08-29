import React, { useEffect, useState } from 'react';
import { csmService, branchService } from '../services/api';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, 
    BarChart, Bar, XAxis, YAxis, Tooltip
} from 'recharts';
import { 
    MdAssignment, MdHourglassEmpty, MdWarning, 
    MdCheckCircle, MdTimer, MdTrendingUp, MdRefresh,
    MdFlashOn, MdLocationOn, MdPerson, MdFilterList,
    MdAssignmentInd, MdCalendarToday, MdBusiness
} from 'react-icons/md';
import { toast } from 'react-toastify';

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

const CSMDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [visits, setVisits] = useState([]);
    const [branches, setBranches] = useState([]);
    const [seeding, setSeeding] = useState(false);

    // Filter states
    const [selectedBranch, setSelectedBranch] = useState('');
    const [quickRange, setQuickRange] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [startDay, setStartDay] = useState('');
    const [endDay, setEndDay] = useState('');
    const [customMode, setCustomMode] = useState(false);

    const loadBranches = async () => {
        try {
            const res = await branchService.getAll();
            const branchList = res.data?.data || res.data || [];
            setBranches(Array.isArray(branchList) ? branchList : []);
        } catch (err) {
            console.error('Failed to load branches for filter:', err);
        }
    };

    const buildFilterParams = () => {
        const params = {};
        if (selectedBranch) params.branchId = selectedBranch;
        
        if (quickRange) {
            params.quickRange = quickRange;
        } else if (customMode) {
            params.month = selectedMonth;
            params.year = selectedYear;
            if (startDay) params.startDay = startDay;
            if (endDay) params.endDay = endDay;
        }
        return params;
    };

    const loadStats = async (showLoadingSpinner = true) => {
        if (showLoadingSpinner) setLoading(true);
        try {
            const params = buildFilterParams();
            const [statsRes, visitsRes] = await Promise.all([
                csmService.getStats(params),
                csmService.getVisits(params)
            ]);
            setStats(statsRes.data);
            setVisits(visitsRes.data || []);
        } catch (error) {
            console.error('Fetch dashboard stats error:', error);
            toast.error('Failed to load dashboard statistics');
        } finally {
            if (showLoadingSpinner) setLoading(false);
        }
    };

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
            await loadStats(false);
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
        loadBranches();
        loadStats();

        const handleSeeded = () => loadStats(false);
        window.addEventListener('onCsmDataSeeded', handleSeeded);
        return () => {
            window.removeEventListener('onCsmDataSeeded', handleSeeded);
        };
    }, []);

    useEffect(() => {
        loadStats(false);
    }, [selectedBranch, quickRange, selectedMonth, selectedYear, startDay, endDay, customMode]);

    if (loading && !stats) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">Loading Analytics Dashboard...</p>
            </div>
        );
    }

    const metrics = stats?.metrics || { open: 0, unassigned: 0, pending: 0, overdue: 0, resolvedToday: 0 };
    const statusData = stats?.statusBreakdown || [];
    const categoryData = stats?.categoryBreakdown || [];
    const complianceData = stats?.slaCompliance || [];
    const engineers = stats?.engineerPerformance || [];

    const isDashboardEmpty = 
        metrics.open === 0 && 
        metrics.unassigned === 0 &&
        metrics.pending === 0 && 
        metrics.overdue === 0 && 
        metrics.resolvedToday === 0 && 
        visits.length === 0;

    // Requirement 3: Unassigned Tickets block added
    const metricCards = [
        { label: 'Active Tickets', value: metrics.open, icon: <MdAssignment size={24} />, color: 'from-teal-500 to-emerald-600' },
        { label: 'Unassigned Tickets', value: metrics.unassigned || 0, icon: <MdAssignmentInd size={24} />, color: 'from-purple-500 to-indigo-600' },
        { label: 'Pending Customer', value: metrics.pending, icon: <MdHourglassEmpty size={24} />, color: 'from-amber-400 to-orange-500' },
        { label: 'Overdue SLA', value: metrics.overdue, icon: <MdWarning size={24} />, color: 'from-rose-500 to-red-600' },
        { label: 'Resolved Today', value: metrics.resolvedToday, icon: <MdCheckCircle size={24} />, color: 'from-sky-500 to-cyan-600' }
    ];

    // Compute SLA compliance percentage
    const totalSlaTickets = (complianceData.find(d => d.name === 'Compliant')?.value || 0) + 
                            (complianceData.find(d => d.name === 'Breached')?.value || 0);
    const compliantCount = complianceData.find(d => d.name === 'Compliant')?.value || 0;
    const complianceRate = totalSlaTickets > 0 ? ((compliantCount / totalSlaTickets) * 100).toFixed(1) : '100.0';

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
            const d = new Date(dateString);
            return d.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase flex items-center gap-2">
                        <MdFlashOn className="text-teal-600 animate-pulse" /> Customer Service Analytics
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Live insights into support load, SLA compliance targets, and engineer performance.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadStats(true)}
                        className="p-3 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-1 font-bold text-xs"
                        title="Refresh Stats"
                    >
                        <MdRefresh size={18} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filter Toolbar (Requirements 6, 7 & 8) */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-black text-xs uppercase text-slate-500 tracking-wider">
                        <MdFilterList size={18} className="text-teal-600" /> Filter View:
                    </div>

                    {/* Quick Range Selector */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            onClick={() => { setQuickRange(''); setCustomMode(false); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                !quickRange && !customMode
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            All Time
                        </button>
                        <button
                            onClick={() => { setQuickRange('today'); setCustomMode(false); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                quickRange === 'today'
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => { setQuickRange('yesterday'); setCustomMode(false); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                quickRange === 'yesterday'
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Yesterday
                        </button>
                        <button
                            onClick={() => { setQuickRange('thisMonth'); setCustomMode(false); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                quickRange === 'thisMonth'
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            This Month
                        </button>
                        <button
                            onClick={() => { setQuickRange('lastMonth'); setCustomMode(false); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                quickRange === 'lastMonth'
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Last Month
                        </button>
                        <button
                            onClick={() => { setQuickRange(''); setCustomMode(true); }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1 ${
                                customMode
                                    ? 'bg-teal-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <MdCalendarToday size={14} /> Month / Day Range
                        </button>
                    </div>

                    {/* Branch Filter Dropdown */}
                    {branches.length > 0 && (
                        <div className="flex items-center gap-2">
                            <MdBusiness className="text-slate-400" size={16} />
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                <option value="">All Branches</option>
                                {branches.map((b) => (
                                    <option key={b._id} value={b._id}>
                                        {b.name || b.code}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Custom Month-wise & Day Range Selection (Requirement 7) */}
                {customMode && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600">Month:</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-semibold outline-none"
                            >
                                {monthNames.map((m, idx) => (
                                    <option key={idx} value={idx + 1}>{m}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600">Year:</span>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-semibold outline-none"
                            >
                                {[2024, 2025, 2026, 2027].map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600">Day Range (1-31):</span>
                            <input
                                type="number"
                                min="1"
                                max="31"
                                placeholder="From Day"
                                value={startDay}
                                onChange={(e) => setStartDay(e.target.value)}
                                className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold outline-none text-center"
                            />
                            <span>to</span>
                            <input
                                type="number"
                                min="1"
                                max="31"
                                placeholder="To Day"
                                value={endDay}
                                onChange={(e) => setEndDay(e.target.value)}
                                className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold outline-none text-center"
                            />
                        </div>
                    </div>
                )}
            </div>

            {isDashboardEmpty ? (
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
                    {/* Requirement 3: Metrics Row with Unassigned Tickets block */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {metricCards.map((card, i) => (
                            <div 
                                key={i}
                                className="glass shadow-sm rounded-2xl p-4 border border-slate-100/80 bg-white dark:bg-slate-900/60 dark:border-slate-800 flex items-center justify-between"
                            >
                                <div className="space-y-0.5">
                                    <span className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">{card.label}</span>
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 font-outfit">{card.value}</h2>
                                </div>
                                <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center text-white shadow-sm`}>
                                    {card.icon}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* SLA & Time Metrics Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Avg Resolution Card */}
                        <div className="glass shadow-premium rounded-[2rem] p-6 bg-gradient-to-br from-teal-900 to-slate-900 text-white flex flex-col justify-between border border-teal-950 h-[300px]">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">Resolution Speed</span>
                                <MdTimer size={24} className="text-teal-400" />
                            </div>
                            <div className="py-4">
                                <h2 className="text-5xl font-black font-outfit leading-none mb-2">
                                    {stats?.avgResolutionHours || 0} hrs
                                </h2>
                                <p className="text-xs font-bold text-teal-200">Average resolution cycle time per ticket</p>
                            </div>
                            <div className="border-t border-teal-850 pt-4 flex items-center gap-2 text-xs font-bold text-teal-300">
                                <MdTrendingUp size={16} />
                                Calculated from all closed cases this period
                            </div>
                        </div>

                        {/* SLA Compliance Donut */}
                        <div className="glass shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900/60 dark:border-slate-800 border border-slate-100 flex flex-col justify-between h-[300px]">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">SLA Resolution Compliance</h3>
                            </div>
                            <div className="flex items-center gap-6 flex-1 min-h-0">
                                <div className="w-1/2 h-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={complianceData.some(d => d.value > 0) ? complianceData : [{ name: 'No Data', value: 1 }]}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={55}
                                                outerRadius={75}
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
                                <div className="w-1/2 space-y-2.5 font-semibold text-xs text-slate-500 dark:text-slate-400">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Milestone Review</p>
                                    <p className="leading-relaxed">SLA breaches represent tickets where engineers exceeded priority-defined fix durations.</p>
                                    <p className="font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/50 rounded-xl px-3 py-1.5 inline-block">Target: 95.0%</p>
                                </div>
                            </div>
                        </div>

                        {/* Recent Service Visits Timeline */}
                        <div className="glass shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900/60 dark:border-slate-800 border border-slate-100 flex flex-col h-[300px]">
                            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-3">Field Service Log</h3>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                                {visits.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-bold py-8">
                                        No service visits recorded.
                                    </div>
                                ) : (
                                    visits.slice(0, 5).map((visit, idx) => (
                                        <div key={visit._id || idx} className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-100/50 dark:border-slate-700/50 flex flex-col space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="font-black text-slate-800 dark:text-slate-100 text-xs tracking-tight">{visit.visitNo}</span>
                                                {getVisitStatusBadge(visit.status)}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                                                <MdLocationOn className="text-slate-400 shrink-0" size={13} />
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
                        <div className="glass shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900/60 dark:border-slate-800 border border-slate-100 h-[340px] flex flex-col">
                            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-4">Tickets by Status</h3>
                            <div className="flex-1 min-h-0">
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
                            </div>
                        </div>

                        {/* Tickets by Category */}
                        <div className="glass shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900/60 dark:border-slate-800 border border-slate-100 h-[340px] flex flex-col">
                            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-4">Tickets by Category</h3>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={categoryData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#0d9488" radius={[0, 8, 8, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Engineer Performance Leaderboard */}
                    <div className="glass shadow-premium rounded-[2rem] p-6 bg-white dark:bg-slate-900/60 dark:border-slate-800 border border-slate-100">
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

export default CSMDashboard;
