import React, { useState, useEffect } from 'react';
import { csmService, userService } from '../services/api';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, 
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
    LineChart, Line, AreaChart, Area, CartesianGrid
} from 'recharts';
import { 
    MdAssignment, MdHourglassEmpty, MdWarning, 
    MdCheckCircle, MdTimer, MdTrendingUp, MdRefresh,
    MdFlashOn, MdPerson, MdBuild, MdFeedback, MdAnalytics,
    MdDownload, MdClear, MdStar
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
    'Cancelled': '#ef4444',  // Red
    'Escalated': '#f43f5e'   // Rose
};

const TABS = [
    { key: 'overview', label: 'Overview', icon: <MdAnalytics size={18} /> },
    { key: 'closed_tickets', label: 'Closed Tickets', icon: <MdCheckCircle size={18} /> },
    { key: 'sla_compliance', label: 'SLA Compliance', icon: <MdTimer size={18} /> },
    { key: 'resolution_time', label: 'Resolution Time', icon: <MdTrendingUp size={18} /> },
    { key: 'escalations', label: 'Escalations', icon: <MdWarning size={18} /> },
    { key: 'complaints', label: 'Tickets', icon: <MdFeedback size={18} /> },
    { key: 'service_requests', label: 'Service Requests', icon: <MdBuild size={18} /> },
    { key: 'fcr', label: 'First Call Resolution', icon: <MdFlashOn size={18} /> },
    { key: 'productivity', label: 'Engineer Productivity', icon: <MdPerson size={18} /> },
    { key: 'csat', label: 'CSAT & Feedback', icon: <MdStar size={18} /> }
];

const CSMReports = () => {
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState(null);
    
    // Dropdown list data
    const [priorities, setPriorities] = useState([]);
    const [categories, setCategories] = useState([]);
    const [engineers, setEngineers] = useState([]);

    // Filters state
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        priorityId: '',
        categoryId: '',
        assignedEngineerId: ''
    });

    const [activeTab, setActiveTab] = useState('overview');

    // Fetch report data
    const loadReportData = async (filterParams = filters) => {
        setLoading(true);
        try {
            // Clean empty strings
            const cleanParams = {};
            Object.keys(filterParams).forEach(k => {
                if (filterParams[k]) cleanParams[k] = filterParams[k];
            });

            const res = await csmService.getReportData(cleanParams);
            setReportData(res.data);
        } catch (error) {
            console.error('Fetch reports error:', error);
            toast.error('Failed to load report analytics');
        } finally {
            setLoading(false);
        }
    };

    // Load filter options
    const loadFilterDropdowns = async () => {
        try {
            const [priRes, catRes, engRes] = await Promise.all([
                csmService.getPriorities(),
                csmService.getCategories(),
                csmService.getEngineers()
            ]);
            setPriorities(priRes.data || []);
            setCategories(catRes.data || []);
            setEngineers(engRes.data || []);
        } catch (error) {
            console.error('Error loading report dropdown options:', error);
        }
    };

    useEffect(() => {
        loadFilterDropdowns();
        loadReportData();
    }, []);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => {
        loadReportData(filters);
    };

    const handleResetFilters = () => {
        const resetVal = {
            startDate: '',
            endDate: '',
            priorityId: '',
            categoryId: '',
            assignedEngineerId: ''
        };
        setFilters(resetVal);
        loadReportData(resetVal);
    };

    // CSV Exporter helper
    const handleExportCSV = (dataset, headersMap, filename) => {
        if (!dataset || !dataset.length) {
            toast.warning("No data available for export");
            return;
        }

        const headers = Object.keys(headersMap);
        const headerLabels = Object.values(headersMap);

        const csvRows = [
            headerLabels.join(','),
            ...dataset.map(row => 
                headers.map(headerKey => {
                    // Navigate nested fields if needed (e.g. customerId.customerName)
                    const val = headerKey.split('.').reduce((acc, part) => acc && acc[part], row);
                    const cleanVal = val === null || val === undefined ? '' : String(val).replace(/"/g, '""');
                    return `"${cleanVal}"`;
                }).join(',')
            )
        ];

        const csvContent = csvRows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Report downloaded successfully");
        }
    };

    if (loading && !reportData) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">Generating Custom Service Reports...</p>
            </div>
        );
    }

    const {
        tickets = [],
        slaCompliance = { total: 0, compliant: 0, breached: 0, byPriority: {}, byCategory: {} },
        resolutionTimeTrend = [],
        escalatedTickets = [],
        complaintsTickets = [],
        serviceRequestAnalysis = [],
        fcrStats = { totalResolved: 0, fcrResolvedCount: 0, overallFcrRate: 0, trend: [] },
        engineerProductivity = [],
        csatBreakdown = { distribution: [], feedback: [] }
    } = reportData || {};

    // Compute basic HUD metrics
    const totalCount = tickets.length;
    const openCount = tickets.filter(t => ['Open', 'Assigned', 'In Progress', 'Pending Customer'].includes(t.status)).length;
    const closedCount = tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length;
    const breachedCount = tickets.filter(t => t.isSlaBreached?.response || t.isSlaBreached?.resolution).length;
    const overallFcrRate = fcrStats.overallFcrRate || 0;

    // Calculate overall average resolution time
    let totalResolvedHours = 0;
    let resolvedCount = 0;
    tickets.forEach(t => {
        if (['Resolved', 'Closed'].includes(t.status) && t.resolvedAt && t.createdAt) {
            const diffMs = new Date(t.resolvedAt) - new Date(t.createdAt);
            totalResolvedHours += diffMs / (1000 * 60 * 60);
            resolvedCount++;
        }
    });
    const avgResolutionHours = resolvedCount > 0 ? parseFloat((totalResolvedHours / resolvedCount).toFixed(1)) : 0;

    // Overall CSAT Rating
    let totalFeedbackRating = 0;
    let feedbackCount = 0;
    tickets.forEach(t => {
        if (t.feedback && typeof t.feedback.rating === 'number') {
            totalFeedbackRating += t.feedback.rating;
            feedbackCount++;
        }
    });
    const avgCsatRating = feedbackCount > 0 ? parseFloat((totalFeedbackRating / feedbackCount).toFixed(1)) : '0.0';

    const hudCards = [
        { label: 'Total Tickets', value: totalCount, icon: <MdAssignment size={24} />, color: 'text-teal-600 bg-teal-50 border-teal-100' },
        { label: 'Open cases', value: openCount, icon: <MdHourglassEmpty size={24} />, color: 'text-blue-600 bg-blue-50 border-blue-100' },
        { label: 'Closed Cases', value: closedCount, icon: <MdCheckCircle size={24} />, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
        { label: 'SLA Breaches', value: breachedCount, icon: <MdWarning size={24} />, color: 'text-rose-600 bg-rose-50 border-rose-100' },
        { label: 'FCR Rate', value: `${overallFcrRate}%`, icon: <MdFlashOn size={24} />, color: 'text-amber-600 bg-amber-50 border-amber-100' },
        { label: 'Avg Resolution', value: `${avgResolutionHours} hrs`, icon: <MdTimer size={24} />, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
        { label: 'CSAT score', value: `${avgCsatRating} ★`, icon: <MdFeedback size={24} />, color: 'text-violet-600 bg-violet-50 border-violet-100' }
    ];

    // Chart Formatters
    const formatPercent = (tick) => `${tick}%`;

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase flex items-center gap-2">
                        <MdAnalytics className="text-teal-600 animate-pulse" /> Service Reports Portal
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Comprehensive Customer Service Management (CSM) reports, SLA targets, agent performance, and satisfaction surveys.
                    </p>
                </div>
                <button
                    onClick={() => loadReportData()}
                    className="p-3 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all self-start md:self-auto"
                >
                    <MdRefresh size={20} />
                </button>
            </div>

            {/* Filters Bar */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100/80 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                    <span className="text-xs font-black uppercase text-teal-600 tracking-wider">Report Parameters</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleFilterChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleFilterChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
                        <select
                            name="categoryId"
                            value={filters.categoryId}
                            onChange={handleFilterChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="">All Categories</option>
                            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Priority</label>
                        <select
                            name="priorityId"
                            value={filters.priorityId}
                            onChange={handleFilterChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="">All Priorities</option>
                            {priorities.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Assigned Agent</label>
                        <select
                            name="assignedEngineerId"
                            value={filters.assignedEngineerId}
                            onChange={handleFilterChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="">All Engineers</option>
                            {engineers.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={handleResetFilters}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                    >
                        <MdClear size={16} /> Reset
                    </button>
                    <button
                        onClick={handleApplyFilters}
                        className="flex items-center gap-1.5 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>

            {/* HUD Analytics Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {hudCards.map((card, i) => (
                    <div 
                        key={i}
                        className={`glass rounded-[1.5rem] p-4 border flex flex-col justify-between hover-lift bg-white ${card.color}`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">{card.label}</span>
                            <div className="opacity-75">{card.icon}</div>
                        </div>
                        <h2 className="text-xl font-black font-outfit mt-3 leading-none">{card.value}</h2>
                    </div>
                ))}
            </div>

            {/* Tab System */}
            <div className="flex flex-col lg:flex-row gap-6">
                
                {/* Vertical Tab Navigation */}
                <div className="lg:w-64 shrink-0 flex flex-col bg-white border border-slate-100 rounded-[2rem] p-4 shadow-sm h-fit gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Reports List</span>
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left ${
                                activeTab === tab.key
                                    ? 'bg-teal-600 text-white shadow-md font-black'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <span className={activeTab === tab.key ? 'text-white' : 'text-slate-400'}>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content Area */}
                <div className="flex-1 glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 min-h-[500px]">
                    
                    {/* Tab 0: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">CSM Reports Overview</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* SLA Compliance status bar */}
                                <div className="p-6 border border-slate-100 rounded-3xl bg-slate-50/50 flex flex-col justify-between">
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">SLA Compliance Ratio</h4>
                                        <p className="text-3xl font-black text-slate-900 font-outfit">
                                            {slaCompliance.total > 0 ? ((slaCompliance.compliant / slaCompliance.total) * 100).toFixed(1) : 100}%
                                        </p>
                                        <p className="text-xs text-slate-500 font-semibold mt-1">Resolution targets successfully met.</p>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-teal-600" 
                                                style={{ width: `${slaCompliance.total > 0 ? (slaCompliance.compliant / slaCompliance.total) * 100 : 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                                            <span>{slaCompliance.compliant} Compliant</span>
                                            <span>{slaCompliance.breached} Breached</span>
                                        </div>
                                    </div>
                                </div>

                                {/* FCR breakdown summary */}
                                <div className="p-6 border border-slate-100 rounded-3xl bg-slate-50/50 flex flex-col justify-between">
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">First Call Resolution (FCR)</h4>
                                        <p className="text-3xl font-black text-slate-900 font-outfit">{overallFcrRate}%</p>
                                        <p className="text-xs text-slate-500 font-semibold mt-1">Resolved on first customer contact.</p>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-amber-500" 
                                                style={{ width: `${overallFcrRate}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                                            <span>{fcrStats.fcrResolvedCount} FCR Tickets</span>
                                            <span>{fcrStats.totalResolved - fcrStats.fcrResolvedCount} Follow-up cases</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Ticket status breakdown Chart */}
                                <div className="p-6 border border-slate-100 rounded-3xl bg-white h-[320px] flex flex-col">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Ticket Status Distribution</h4>
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={Object.entries(STATUS_COLORS).map(([status, color]) => ({
                                                name: status,
                                                count: tickets.filter(t => t.status === status).length,
                                                color
                                            })).filter(d => d.count > 0)}>
                                                <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis tick={{ fontSize: 9 }} />
                                                <Tooltip />
                                                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                                    {Object.entries(STATUS_COLORS).map(([status, color], idx) => (
                                                        <Cell key={idx} fill={color} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Ticket Priority Distribution Chart */}
                                <div className="p-6 border border-slate-100 rounded-3xl bg-white h-[320px] flex flex-col">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Ticket Priorities Breakdown</h4>
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={priorities.map(p => ({
                                                        name: p.name,
                                                        value: tickets.filter(t => t.priorityId?._id === p._id).length,
                                                        color: p.color
                                                    })).filter(d => d.value > 0)}
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    label={({ name, value }) => `${name}: ${value}`}
                                                    dataKey="value"
                                                >
                                                    {priorities.map((p, idx) => (
                                                        <Cell key={idx} fill={p.color || COLORS[idx % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 1: CLOSED TICKET REPORT */}
                    {activeTab === 'closed_tickets' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">Closed Ticket Report</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Listing all resolved and closed support cases ({closedCount} total)</p>
                                </div>
                                <button
                                    onClick={() => handleExportCSV(
                                        tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)),
                                        {
                                            ticketNo: 'Ticket No',
                                            'customerId.customerName': 'Customer',
                                            'categoryId.name': 'Category',
                                            'priorityId.name': 'Priority',
                                            status: 'Status',
                                            isFirstCallResolved: 'FCR Flag',
                                            'feedback.rating': 'CSAT Rating',
                                            'feedback.comment': 'CSAT Comment',
                                            createdAt: 'Created At',
                                            resolvedAt: 'Resolved At'
                                        },
                                        'Closed_Tickets_Report.csv'
                                    )}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    <MdDownload size={16} /> Export CSV
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                                            <th className="pb-3 pl-4">Ticket</th>
                                            <th className="pb-3">Customer</th>
                                            <th className="pb-3">Priority</th>
                                            <th className="pb-3">SLA Status</th>
                                            <th className="pb-3">FCR</th>
                                            <th className="pb-3">CSAT</th>
                                            <th className="pb-3 text-right pr-4">Closed Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                                        {tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="text-center py-12 text-slate-400 text-xs font-bold">
                                                    No closed tickets matching the filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).map((t, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 pl-4 font-black text-slate-900">{t.ticketNo}</td>
                                                    <td className="py-4">
                                                        <span className="block font-bold">{t.customerId?.customerName || 'Unknown'}</span>
                                                        <span className="text-[10px] text-slate-400 block">{t.categoryId?.name}</span>
                                                    </td>
                                                    <td className="py-4">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: t.priorityId?.color }}>
                                                            {t.priorityId?.name}
                                                        </span>
                                                    </td>
                                                    <td className="py-4">
                                                        {t.isSlaBreached?.resolution ? (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">Breached</span>
                                                        ) : (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-600 border border-teal-200">Met SLA</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 font-black">
                                                        {t.isFirstCallResolved ? (
                                                            <span className="text-teal-600 flex items-center gap-0.5"><MdFlashOn /> Yes</span>
                                                        ) : (
                                                            <span className="text-slate-400 font-bold">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4">
                                                        {t.feedback?.rating ? (
                                                            <span className="text-amber-500 font-bold flex items-center gap-0.5">★ {t.feedback.rating}</span>
                                                        ) : (
                                                            <span className="text-slate-400 font-bold">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 text-right pr-4 text-xs font-bold text-slate-400">
                                                        {new Date(t.resolvedAt || t.closedAt || t.updatedAt).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: SLA COMPLIANCE REPORT */}
                    {activeTab === 'sla_compliance' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">SLA Compliance Report</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Ratios of resolved cases within contract SLA parameters</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-1 p-6 border border-slate-100 rounded-3xl bg-slate-50/50 flex flex-col justify-center items-center text-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total SLA Tickets</span>
                                    <h2 className="text-4xl font-black font-outfit text-slate-900 mt-2">{slaCompliance.total}</h2>
                                    <div className="mt-4 space-y-1.5 w-full">
                                        <div className="flex justify-between text-xs font-semibold text-slate-500 px-1">
                                            <span>Met Target</span>
                                            <span className="font-black text-teal-600">{slaCompliance.compliant}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-semibold text-slate-500 px-1">
                                            <span>Breached Target</span>
                                            <span className="font-black text-rose-600">{slaCompliance.breached}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 p-6 border border-slate-100 rounded-3xl bg-white h-[260px] flex flex-col">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Compliance Pie</h4>
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Compliant', value: slaCompliance.compliant },
                                                        { name: 'Breached', value: slaCompliance.breached }
                                                    ].filter(d => d.value > 0)}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={50}
                                                    outerRadius={75}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    <Cell fill="#0d9488" />
                                                    <Cell fill="#f43f5e" />
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Breach Breakdowns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 border border-slate-100 rounded-3xl bg-white">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Breaches by Priority</h4>
                                    <div className="space-y-3">
                                        {Object.entries(slaCompliance.byPriority).map(([priName, stats]) => {
                                            const totalPri = stats.compliant + stats.breached;
                                            const compliancePct = totalPri > 0 ? ((stats.compliant / totalPri) * 100).toFixed(1) : 100;
                                            return (
                                                <div key={priName} className="flex items-center justify-between text-xs font-semibold p-2.5 rounded-xl bg-slate-50">
                                                    <span className="font-black text-slate-800">{priName}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-400">{stats.breached} Breaches / {totalPri} Total</span>
                                                        <span className={`px-2 py-0.5 rounded-lg font-bold ${Number(compliancePct) > 90 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>{compliancePct}% Met</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="p-6 border border-slate-100 rounded-3xl bg-white">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Breaches by Category</h4>
                                    <div className="space-y-3">
                                        {Object.entries(slaCompliance.byCategory).map(([catName, stats]) => {
                                            const totalCat = stats.compliant + stats.breached;
                                            const compliancePct = totalCat > 0 ? ((stats.compliant / totalCat) * 100).toFixed(1) : 100;
                                            return (
                                                <div key={catName} className="flex items-center justify-between text-xs font-semibold p-2.5 rounded-xl bg-slate-50">
                                                    <span className="font-black text-slate-800">{catName}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-400">{stats.breached} Breaches / {totalCat} Total</span>
                                                        <span className={`px-2 py-0.5 rounded-lg font-bold ${Number(compliancePct) > 90 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>{compliancePct}% Met</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: AVERAGE RESOLUTION TIME REPORT */}
                    {activeTab === 'resolution_time' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">Average Resolution Time Report</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Trend line tracking average hours required to resolve tickets over time</p>
                                </div>
                            </div>

                            <div className="p-6 border border-slate-100 rounded-3xl bg-white h-[350px] flex flex-col">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Resolution Cycle Duration (Hours)</h4>
                                <div className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={resolutionTimeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorResolution" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2}/>
                                                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                                            <YAxis tick={{ fontSize: 9 }} />
                                            <Tooltip />
                                            <Area type="monotone" dataKey="avgHours" stroke="#0d9488" fillOpacity={1} fill="url(#colorResolution)" strokeWidth={2.5} name="Average Hours" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 4: ESCALATIONS */}
                    {activeTab === 'escalations' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">Escalated Cases Report</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Active tickets in 'Escalated' status or triggered past tier boundaries ({escalatedTickets.length} cases)</p>
                                </div>
                                <button
                                    onClick={() => handleExportCSV(
                                        escalatedTickets,
                                        {
                                            ticketNo: 'Ticket No',
                                            'customerId.customerName': 'Customer',
                                            issueTitle: 'Issue Title',
                                            'priorityId.name': 'Priority',
                                            status: 'Status',
                                            escalationLevel: 'Escalation Level',
                                            'assignedTeamId.name': 'Assigned Team',
                                            'assignedEngineerId.name': 'Assigned Engineer',
                                            createdAt: 'Created At'
                                        },
                                        'Escalated_Cases_Report.csv'
                                    )}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    <MdDownload size={16} /> Export CSV
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                                            <th className="pb-3 pl-4">Ticket</th>
                                            <th className="pb-3">Customer</th>
                                            <th className="pb-3">Priority</th>
                                            <th className="pb-3">Escalation</th>
                                            <th className="pb-3">Team Assigned</th>
                                            <th className="pb-3 text-right pr-4">Created Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                                        {escalatedTickets.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center py-12 text-slate-400 text-xs font-bold">
                                                    No escalated cases matching the current filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            escalatedTickets.map((t, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 pl-4 font-black text-slate-900">
                                                        <span className="block">{t.ticketNo}</span>
                                                        <span className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg inline-block mt-1">{t.status}</span>
                                                    </td>
                                                    <td className="py-4">
                                                        <span className="block font-bold">{t.customerId?.customerName || 'Unknown'}</span>
                                                        <p className="text-xs text-slate-400 truncate max-w-xs">{t.issueTitle}</p>
                                                    </td>
                                                    <td className="py-4">
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: t.priorityId?.color }}>
                                                            {t.priorityId?.name}
                                                        </span>
                                                    </td>
                                                    <td className="py-4">
                                                        <span className="font-black text-rose-600">Level {t.escalationLevel}</span>
                                                    </td>
                                                    <td className="py-4">
                                                        <span className="block font-bold">{t.assignedTeamId?.name || 'Unassigned Team'}</span>
                                                        <span className="text-[10px] text-slate-400 block">{t.assignedEngineerId?.name || 'Unassigned Agent'}</span>
                                                    </td>
                                                    <td className="py-4 text-right pr-4 text-xs font-bold text-slate-400">
                                                        {new Date(t.createdAt).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tab 5: COMPLAINTS / TICKETS */}
                    {activeTab === 'complaints' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">Customer Tickets Report</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Cases registered under customer support tickets ({complaintsTickets.length} cases)</p>
                                </div>
                                <button
                                    onClick={() => handleExportCSV(
                                        complaintsTickets,
                                        {
                                            ticketNo: 'Ticket No',
                                            'customerId.customerName': 'Customer',
                                            issueTitle: 'Ticket Title',
                                            description: 'Ticket details',
                                            'priorityId.name': 'Priority',
                                            status: 'Status',
                                            'assignedEngineerId.name': 'Engineer',
                                            createdAt: 'Created At'
                                        },
                                        'Customer_Tickets_Report.csv'
                                    )}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    <MdDownload size={16} /> Export CSV
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                                            <th className="pb-3 pl-4">Ticket</th>
                                            <th className="pb-3">Customer</th>
                                            <th className="pb-3">Ticket Details</th>
                                            <th className="pb-3">Status</th>
                                            <th className="pb-3">Assigned Executive</th>
                                            <th className="pb-3 text-right pr-4">Created Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                                        {complaintsTickets.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center py-12 text-slate-400 text-xs font-bold">
                                                    No tickets logged in this period.
                                                </td>
                                            </tr>
                                        ) : (
                                            complaintsTickets.map((t, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 pl-4 font-black text-slate-900">{t.ticketNo}</td>
                                                    <td className="py-4 font-black">{t.customerId?.customerName || 'Unknown'}</td>
                                                    <td className="py-4">
                                                        <span className="block font-bold">{t.issueTitle}</span>
                                                        <p className="text-xs text-slate-400 truncate max-w-sm">{t.description}</p>
                                                    </td>
                                                    <td className="py-4">
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: STATUS_COLORS[t.status] || '#64748b' }}>
                                                            {t.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 font-bold">{t.assignedEngineerId?.name || 'Unassigned'}</td>
                                                    <td className="py-4 text-right pr-4 text-xs font-bold text-slate-400">
                                                        {new Date(t.createdAt).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tab 6: SERVICE REQUEST ANALYSIS */}
                    {activeTab === 'service_requests' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">Service Request Analysis</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Breakdown of support tickets by categories</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 border border-slate-100 rounded-3xl bg-white h-[320px] flex flex-col">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Requests by Category</h4>
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={serviceRequestAnalysis} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="category" dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                <YAxis type="number" tick={{ fontSize: 9 }} />
                                                <Tooltip />
                                                <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="p-6 border border-slate-100 rounded-3xl bg-white">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Distribution Table</h4>
                                    <div className="space-y-2">
                                        {serviceRequestAnalysis.map((item, index) => {
                                            const share = totalCount > 0 ? ((item.value / totalCount) * 100).toFixed(1) : 0;
                                            return (
                                                <div key={index} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 text-xs font-semibold">
                                                    <span className="font-black text-slate-800">{item.name}</span>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-slate-500">{item.value} tickets</span>
                                                        <span className="font-bold text-teal-600 bg-teal-50 border border-teal-100 rounded-lg px-2 py-0.5">{share}% Share</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 7: FIRST CALL RESOLUTION REPORT */}
                    {activeTab === 'fcr' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">First Call Resolution (FCR) Report</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Volume of support calls solved on the initial contact session</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-6 border border-slate-100 rounded-3xl bg-slate-50/50 flex flex-col justify-center items-center text-center">
                                    <div className="w-24 h-24 rounded-full border-[8px] border-slate-200 flex items-center justify-center relative">
                                        <div 
                                            className="absolute inset-0 rounded-full border-[8px] border-amber-500 border-t-transparent border-r-transparent rotate-[45deg]"
                                            style={{ transform: `rotate(${overallFcrRate * 3.6}deg)` }}
                                        ></div>
                                        <span className="text-2xl font-black text-slate-900 font-outfit">{overallFcrRate}%</span>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4 block">FCR Rate</span>
                                    <p className="text-xs text-slate-500 font-semibold mt-1">Target is &gt; 70.0% FCR</p>
                                </div>

                                <div className="md:col-span-2 p-6 border border-slate-100 rounded-3xl bg-white h-[260px] flex flex-col">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">FCR Timeline Trend</h4>
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={fcrStats.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                                                <YAxis tick={{ fontSize: 9 }} tickFormatter={formatPercent} />
                                                <Tooltip />
                                                <Line type="monotone" dataKey="fcrRate" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', r: 4 }} name="FCR %" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 8: SERVICE ENGINEER PRODUCTIVITY */}
                    {activeTab === 'productivity' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">Service Engineer Productivity</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Metrics comparing assigned, active, resolved counts, and customer feedback rating scores</p>
                                </div>
                                <button
                                    onClick={() => handleExportCSV(
                                        engineerProductivity,
                                        {
                                            name: 'Engineer Name',
                                            email: 'Email',
                                            assigned: 'Total Assigned',
                                            resolved: 'Total Resolved',
                                            open: 'Active Pending',
                                            avgRating: 'Average CSAT'
                                        },
                                        'Engineer_Productivity_Report.csv'
                                    )}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    <MdDownload size={16} /> Export CSV
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                                            <th className="pb-3 pl-4">Engineer</th>
                                            <th className="pb-3">Assigned Cases</th>
                                            <th className="pb-3">Cases Resolved</th>
                                            <th className="pb-3">Active Pending</th>
                                            <th className="pb-3">Average CSAT Rating</th>
                                            <th className="pb-3 text-right pr-4">Efficiency Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                                        {engineerProductivity.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center py-12 text-slate-400 text-xs font-bold">
                                                    No engineer assignment stats logged yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            engineerProductivity.map((eng, idx) => {
                                                const efficiency = eng.assigned > 0 ? ((eng.resolved / eng.assigned) * 100).toFixed(0) : 0;
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="py-4 pl-4">
                                                            <span className="font-black text-slate-900 block">{eng.name}</span>
                                                            <span className="text-[10px] text-slate-400 block">{eng.email}</span>
                                                        </td>
                                                        <td className="py-4 font-black">{eng.assigned} cases</td>
                                                        <td className="py-4 text-teal-600 font-black">{eng.resolved} resolved</td>
                                                        <td className="py-4 text-amber-600 font-black">{eng.open} pending</td>
                                                        <td className="py-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-amber-500 text-lg leading-none">★</span>
                                                                <span className="font-bold">{eng.avgRating ? eng.avgRating.toFixed(1) : 'N/A'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 text-right pr-4">
                                                            <span className={`px-2.5 py-1 text-[10px] font-black tracking-widest uppercase rounded-full ${
                                                                Number(efficiency) > 80 
                                                                    ? 'bg-teal-50 text-teal-600 border border-teal-200' 
                                                                    : Number(efficiency) > 50 
                                                                        ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                                                                        : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                                {efficiency}% resolved
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tab 9: CSAT & FEEDBACK SURVEYS */}
                    {activeTab === 'csat' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="font-outfit font-black text-lg text-slate-900 uppercase">Customer Satisfaction (CSAT) Dashboard</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Distribution of customer ratings and recent feedback reviews</p>
                                </div>
                                <button
                                    onClick={() => handleExportCSV(
                                        csatBreakdown.feedback,
                                        {
                                            ticketNo: 'Ticket No',
                                            customerName: 'Customer',
                                            rating: 'CSAT Rating',
                                            comment: 'Comments',
                                            submittedAt: 'Date Submitted'
                                        },
                                        'CSAT_Feedback_Logs.csv'
                                    )}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    <MdDownload size={16} /> Export CSV
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Ratings Score Distribution */}
                                <div className="p-6 border border-slate-100 rounded-3xl bg-white h-[280px] flex flex-col md:col-span-1">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">CSAT Stars Distribution</h4>
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={csatBreakdown.distribution} margin={{ left: -30, right: 10, top: 10, bottom: 0 }}>
                                                <XAxis dataKey="rating" tickFormatter={(t) => `${t} ★`} tick={{ fontSize: 9 }} />
                                                <YAxis tick={{ fontSize: 9 }} />
                                                <Tooltip />
                                                <Bar dataKey="count" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Customer Comments Log */}
                                <div className="p-6 border border-slate-100 rounded-3xl bg-slate-50/50 md:col-span-2 flex flex-col h-[280px]">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Recent Customer Feedback Logs</h4>
                                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                        {csatBreakdown.feedback.length === 0 ? (
                                            <p className="text-slate-400 font-semibold text-xs text-center py-12">
                                                No customer comments registered yet.
                                            </p>
                                        ) : (
                                            csatBreakdown.feedback.map((f, i) => (
                                                <div key={i} className="p-3.5 rounded-2xl bg-white border border-slate-100 flex flex-col space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-black text-slate-800 text-xs">{f.customerName} ({f.ticketNo})</span>
                                                        <span className="text-amber-500 font-black text-xs">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                                                    </div>
                                                    <p className="text-xs font-medium text-slate-500">"{f.comment || 'No comment provided.'}"</p>
                                                    <span className="text-[9px] text-slate-400 self-end mt-1">{new Date(f.submittedAt).toLocaleDateString()}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CSMReports;
