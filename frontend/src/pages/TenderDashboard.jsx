import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenderService, customerService, userService, payrollService } from '../services/api';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, 
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
    LineChart, Line, CartesianGrid
} from 'recharts';
import { 
    MdAssignment, MdTrendingUp, MdRefresh,
    MdPeople, MdCalendarMonth, MdFolderSpecial,
    MdCheckCircle, MdCancel, MdSearch, MdFilterList
} from 'react-icons/md';
import { toast } from 'react-toastify';

const COLORS = ['#0d9488', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
const STATUS_COLORS = {
    'Active': '#0ea5e9', // Sky blue for Active
    'Submitted': '#f59e0b',
    'Won': '#10b981',
    'Lost': '#ef4444',
    'Pending Approval': '#8b5cf6'
};

const formatCurrency = (val) => {
    if (!val && val !== 0) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
};

const TenderDashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    
    // Filters State
    const [customerId, setCustomerId] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Dropdown Data
    const [customers, setCustomers] = useState([]);
    const [owners, setOwners] = useState([]);
    const [departments, setDepartments] = useState([]);

    // Stats and Chart Data
    const [dashboardData, setDashboardData] = useState(null);

    const loadFiltersData = async () => {
        try {
            const [custRes, ownerRes, deptRes] = await Promise.all([
                customerService.getAll({ limit: 1000 }),
                userService.getAll({ limit: 1000 }),
                payrollService.getDepartments().catch(() => ({ data: [] }))
            ]);
            setCustomers(custRes.data?.data || custRes.data?.docs || custRes.data || []);
            setOwners(ownerRes.data?.data || ownerRes.data?.docs || ownerRes.data || []);
            setDepartments(deptRes.data?.data || deptRes.data?.docs || deptRes.data || []);
        } catch (err) {
            console.error('Failed to load filter options:', err);
        }
    };

    const loadDashboardData = async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            const params = {
                customerId: customerId || undefined,
                ownerId: ownerId || undefined,
                departmentId: departmentId || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            };
            const res = await tenderService.getDashboard(params);
            setDashboardData(res.data);
        } catch (error) {
            console.error('Fetch tender dashboard data error:', error);
            toast.error('Failed to load dashboard statistics');
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    useEffect(() => {
        loadFiltersData();
    }, []);

    useEffect(() => {
        loadDashboardData(true);
    }, [customerId, ownerId, departmentId, startDate, endDate]);

    const handleResetFilters = () => {
        setCustomerId('');
        setOwnerId('');
        setDepartmentId('');
        setStartDate('');
        setEndDate('');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">Loading Tender Analytics...</p>
            </div>
        );
    }

    const kpis = dashboardData?.kpis || {
        totalCount: 0, activeCount: 0, submittedCount: 0, wonCount: 0, lostCount: 0, pendingCount: 0, totalValue: 0, winRate: 0, upcomingCount: 0
    };
    const charts = dashboardData?.charts || {
        statusDistribution: [], monthlyTrend: [], wonVsLost: [], topClients: []
    };
    const upcomingDeadlines = dashboardData?.upcomingDeadlines || [];

    // Chart Click Handler for Drill down
    const handleStatusChartClick = (state) => {
        if (state && state.name) {
            navigate(`/tender/register?status=${state.name}`);
        }
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-md">
                        <MdAssignment size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tender Dashboard</h1>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Zoho CRM Style Tender Analytics & Performance</p>
                    </div>
                </div>
                <button
                    onClick={() => loadDashboardData(false)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-all"
                >
                    <MdRefresh size={18} />
                    Refresh
                </button>
            </div>

            {/* Filter Header */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                        <MdFilterList size={20} className="text-teal-600" />
                        <span>Filter Dashboard</span>
                    </div>
                    <button 
                        onClick={handleResetFilters} 
                        className="text-xs font-bold text-teal-600 hover:text-teal-800 transition"
                    >
                        Reset All
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Client</label>
                        <select
                            value={customerId}
                            onChange={e => setCustomerId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                        >
                            <option value="">All Clients</option>
                            {customers.map(c => (
                                <option key={c._id} value={c._id}>{c.companyName || c.customerName}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Owner / Salesperson</label>
                        <select
                            value={ownerId}
                            onChange={e => setOwnerId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                        >
                            <option value="">All Owners</option>
                            {owners.map(u => (
                                <option key={u._id} value={u._id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Department</label>
                        <select
                            value={departmentId}
                            onChange={e => setDepartmentId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                        >
                            <option value="">All Departments</option>
                            {departments.map(d => (
                                <option key={d._id} value={d._id}>{d.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Start Deadline</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">End Deadline</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                        />
                    </div>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div 
                    onClick={() => navigate('/tender/register')}
                    className="cursor-pointer bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition duration-300 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 -mt-4 -mr-4 bg-teal-50/50 rounded-full group-hover:scale-110 transition duration-300"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Tenders</p>
                            <h3 className="text-3xl font-black text-slate-900">{kpis.totalCount}</h3>
                        </div>
                        <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shadow-inner border border-teal-100/50">
                            <MdAssignment size={24} />
                        </div>
                    </div>
                </div>

                <div 
                    onClick={() => navigate('/tender/register?status=Won')}
                    className="cursor-pointer bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition duration-300 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 -mt-4 -mr-4 bg-emerald-50 rounded-full group-hover:scale-110 transition duration-300"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Win Rate %</p>
                            <h3 className="text-3xl font-black text-emerald-600">{kpis.winRate}%</h3>
                        </div>
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shadow-inner">
                            <MdTrendingUp size={24} />
                        </div>
                    </div>
                </div>

                <div 
                    onClick={() => navigate('/tender/register')}
                    className="cursor-pointer bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition duration-300 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 -mt-4 -mr-4 bg-teal-50/50 rounded-full group-hover:scale-110 transition duration-300"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tender Portfolio Value</p>
                            <h3 className="text-3xl font-black text-teal-600">{formatCurrency(kpis.totalValue)}</h3>
                        </div>
                        <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-xl flex items-center justify-center shadow-inner border border-teal-200/50">
                            <MdFolderSpecial size={24} />
                        </div>
                    </div>
                </div>

                <div 
                    onClick={() => navigate('/tender/register?status=Submitted')}
                    className="cursor-pointer bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition duration-300 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 -mt-4 -mr-4 bg-amber-50 rounded-full group-hover:scale-110 transition duration-300"></div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Submitted / Active</p>
                            <h3 className="text-3xl font-black text-amber-600">{kpis.submittedCount} / {kpis.activeCount}</h3>
                        </div>
                        <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shadow-inner">
                            <MdCalendarMonth size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tender Status Donut Chart */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
                    <h3 className="text-lg font-black text-slate-900 mb-4 border-b border-slate-50 pb-2">Tender Status</h3>
                    {charts.statusDistribution.length > 0 ? (
                        <div className="relative h-64 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={charts.statusDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={4}
                                        dataKey="value"
                                        onClick={handleStatusChartClick}
                                    >
                                        {charts.statusDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} className="cursor-pointer" />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value) => [`${value} Tenders`, 'Count']}
                                        contentStyle={{ borderRadius: '1rem', border: '1px solid #f1f5f9' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute text-center">
                                <span className="block text-3xl font-black text-slate-800">{kpis.totalCount}</span>
                                <span className="text-xxs font-bold text-slate-400 uppercase tracking-wider">Total Tenders</span>
                            </div>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-400 font-bold">No Data Available</div>
                    )}
                    <div className="flex flex-wrap justify-center gap-4 mt-2">
                        {charts.statusDistribution.map((entry, index) => (
                            <div key={index} className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.name] }}></span>
                                <span>{entry.name} ({entry.value})</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Won vs Lost Bar Chart */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm lg:col-span-2">
                    <h3 className="text-lg font-black text-slate-900 mb-4 border-b border-slate-50 pb-2">Won vs Lost Analysis</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart data={charts.wonVsLost} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                                <YAxis yAxisId="left" orientation="left" stroke="#0ea5e9" tickLine={false} label={{ value: 'Tenders Count', angle: -90, position: 'insideLeft', offset: 0, style: { fontSize: '10px', fill: '#94a3b8', fontWeight: 'bold' } }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#10b981" tickLine={false} label={{ value: 'Tender Value (₹)', angle: 90, position: 'insideRight', offset: 0, style: { fontSize: '10px', fill: '#94a3b8', fontWeight: 'bold' } }} />
                                <Tooltip 
                                    formatter={(value, name) => name === 'value' ? [formatCurrency(value), 'Total Value'] : [`${value} Tenders`, 'Count']}
                                    contentStyle={{ borderRadius: '1rem', border: '1px solid #f1f5f9' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                <Bar yAxisId="left" dataKey="count" fill="#0d9488" name="Tenders Count" radius={[6, 6, 0, 0]} barSize={40} />
                                <Bar yAxisId="right" dataKey="value" fill="#10b981" name="Tenders Value" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Row Charts & List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Monthly Trend (Column/Line) */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm lg:col-span-2">
                    <h3 className="text-lg font-black text-slate-900 mb-4 border-b border-slate-50 pb-2">Monthly Tender Trend</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <LineChart data={charts.monthlyTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                <YAxis yAxisId="left" stroke="#0d9488" tickLine={false} label={{ value: 'Tenders Added', angle: -90, position: 'insideLeft', style: { fontSize: '10px', fill: '#94a3b8', fontWeight: 'bold' } }} />
                                <YAxis yAxisId="right" orientation="right" stroke="#10b981" tickLine={false} label={{ value: 'Tender Value (₹)', angle: 90, position: 'insideRight', style: { fontSize: '10px', fill: '#94a3b8', fontWeight: 'bold' } }} />
                                <Tooltip 
                                    formatter={(value, name) => name === 'value' ? [formatCurrency(value), 'Portfolio Value'] : name === 'wonValue' ? [formatCurrency(value), 'Won Value'] : [`${value} Tenders`, 'Count']}
                                    contentStyle={{ borderRadius: '1rem', border: '1px solid #f1f5f9' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                <Line yAxisId="left" type="monotone" dataKey="count" stroke="#0d9488" strokeWidth={3} dot={{ r: 4 }} name="Tenders Count" />
                                <Line yAxisId="right" type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Portfolio Value" />
                                <Line yAxisId="right" type="monotone" dataKey="wonValue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Won Value" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Clients by Value */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
                    <h3 className="text-lg font-black text-slate-900 mb-4 border-b border-slate-50 pb-2">Top Clients</h3>
                    {charts.topClients.length > 0 ? (
                        <div className="h-64 mt-2">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <BarChart data={charts.topClients} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                    <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={formatCurrency} />
                                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={80} tickLine={false} />
                                    <Tooltip 
                                        formatter={(value) => [formatCurrency(value), 'Tender Value']}
                                        contentStyle={{ borderRadius: '1rem', border: '1px solid #f1f5f9' }}
                                    />
                                    <Bar dataKey="value" fill="#8b5cf6" name="Value" radius={[0, 6, 6, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-400 font-bold">No Client Data Available</div>
                    )}
                </div>
            </div>

            {/* Upcoming Deadlines Table */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
                    <h3 className="text-lg font-black text-slate-900">Upcoming Submission Deadlines</h3>
                    <button 
                        onClick={() => navigate('/tender/register')} 
                        className="text-xs font-bold text-teal-600 hover:text-teal-800 transition"
                    >
                        View All Tenders
                    </button>
                </div>
                {upcomingDeadlines.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                                    <th className="py-3 px-4">Tender No</th>
                                    <th className="py-3 px-4">Tender Title</th>
                                    <th className="py-3 px-4">Deadline</th>
                                    <th className="py-3 px-4 text-right">Tender Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {upcomingDeadlines.map((t, idx) => (
                                    <tr 
                                        key={idx} 
                                        className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 cursor-pointer transition text-sm font-semibold text-slate-700"
                                        onClick={() => navigate(`/tender/register?search=${t.tenderNo}`)}
                                    >
                                        <td className="py-3 px-4 text-teal-600 font-bold">{t.tenderNo}</td>
                                        <td className="py-3 px-4 truncate max-w-xs">{t.title}</td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold">
                                                {new Date(t.deadlineDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right text-slate-900 font-bold">{formatCurrency(t.value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-6 text-center text-slate-400 font-bold text-sm">No upcoming active submission deadlines found.</div>
                )}
            </div>
        </div>
    );
};

export default TenderDashboard;
