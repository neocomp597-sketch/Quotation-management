import React, { useState, useEffect } from 'react';
import {
    MdAnalytics, MdDashboard, MdPhone, MdPeople, MdPieChart, MdTrendingUp, MdCheckCircle,
    MdDownload, MdFilterList, MdClose, MdEdit, MdArrowForward, MdLocalOffer, MdPerson,
    MdCalendarToday, MdWarning, MdThumbUp
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { analyticsService, enquiryService } from '../services/api';
import { formatDate } from '../utils/helpers';
import * as XLSX from 'xlsx';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

// Health Score Badge Component
const HealthScoreBadge = ({ score }) => {
    let color = 'bg-red-100 text-red-700';
    let label = 'At Risk';
    if (score >= 80) {
        color = 'bg-green-100 text-green-700';
        label = 'Healthy';
    } else if (score >= 50) {
        color = 'bg-amber-100 text-amber-700';
        label = 'Needs Attention';
    }
    return (
        <div className="flex items-center gap-2">
            <div className={`w-12 h-2 rounded-full bg-gradient-to-r ${score >= 80 ? 'from-green-400 to-green-600' : score >= 50 ? 'from-amber-400 to-amber-600' : 'from-red-400 to-red-600'}`}></div>
            <span className={`text-xs font-bold px-2 py-1 rounded ${color}`}>{score}</span>
            <span className="text-xs font-bold text-slate-500">{label}</span>
        </div>
    );
};

// Recommended Action Badge Component
const ActionBadge = ({ action }) => {
    const colors = {
        'Follow Up Now': 'bg-blue-100 text-blue-700',
        'Re-negotiate': 'bg-purple-100 text-purple-700',
        'Request Revised Quote': 'bg-amber-100 text-amber-700',
        'Finalize Vendor': 'bg-emerald-100 text-emerald-700',
        'Close as Lost': 'bg-rose-100 text-rose-700',
        'None': 'bg-slate-100 text-slate-600'
    };
    return (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors[action] || colors['None']}`}>
            {action}
        </span>
    );
};

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, bg }) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
                <p className={`text-2xl font-black ${color} mt-2`}>{value}</p>
            </div>
            <div className={`h-12 w-12 rounded-lg ${bg} ${color} flex items-center justify-center`}>
                <Icon size={24} />
            </div>
        </div>
    </div>
);

const EnquiryAnalytics = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Data state
    const [summary, setSummary] = useState(null);
    const [stages, setStages] = useState([]);
    const [trends, setTrends] = useState([]);
    const [followUps, setFollowUps] = useState(null);
    const [vendors, setVendors] = useState([]);
    const [products, setProducts] = useState([]);
    const [users, setUsers] = useState([]);
    const [probability, setProbability] = useState(null);
    const [health, setHealth] = useState([]);

    // Filter state
    const [filters, setFilters] = useState({
        from: '',
        to: '',
        status: '',
        customerId: '',
        productName: '',
        vendorId: ''
    });
    const [trendPeriod, setTrendPeriod] = useState('monthly');

    // Fetch all analytics data
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

            const [summaryRes, stagesRes, trendsRes, followUpsRes, vendorsRes, productsRes, usersRes, probRes, healthRes] = await Promise.all([
                analyticsService.getSummary(params),
                analyticsService.getStages(params),
                analyticsService.getTrends(trendPeriod, params),
                analyticsService.getFollowUps(params),
                analyticsService.getVendors(params),
                analyticsService.getProducts(params),
                analyticsService.getUsers(params),
                analyticsService.getProbability(params),
                analyticsService.getHealth(params)
            ]);

            setSummary(summaryRes.data);
            setStages(stagesRes.data);
            setTrends(trendsRes.data);
            setFollowUps(followUpsRes.data);
            setVendors(vendorsRes.data);
            setProducts(productsRes.data);
            setUsers(usersRes.data);
            setProbability(probRes.data);
            setHealth(healthRes.data);
        } catch (err) {
            toast.error('Failed to load analytics');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [filters, trendPeriod]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const clearFilters = () => {
        setFilters({
            from: '',
            to: '',
            status: '',
            customerId: '',
            productName: '',
            vendorId: ''
        });
    };

    const exportToExcel = () => {
        if (!summary) return;

        const reportName = `Analytics-${new Date().toISOString().split('T')[0]}.xlsx`;
        const sheets = {};

        // Summary sheet
        sheets['Summary'] = [
            ['Metric', 'Value'],
            ['Total Enquiries', summary.totalEnquiries],
            ['Active Enquiries', summary.activeCount],
            ['Won', summary.wonCount],
            ['Lost', summary.lostCount],
            ['Conversion Rate (%)', summary.conversionRate],
            ['Avg Probability (%)', summary.avgProbability],
            ['Overdue Follow-ups', summary.overdueFU],
            ['Pending Quotations', summary.pendingQuotations]
        ];

        // Stages sheet
        sheets['Stages'] = [['Status', 'Count'], ...stages.map(s => [s.stage, s.count])];

        // Vendors sheet
        sheets['Vendors'] = [
            ['Vendor', 'Quotes', 'Wins', 'Win Ratio (%)'],
            ...vendors.map(v => [v._id || 'Unknown', v.quoteCount, v.winCount, v.winRatio || 0])
        ];

        // Products sheet
        sheets['Products'] = [
            ['Product', 'Enquiries', 'Won', 'Conversion (%)'],
            ...products.map(p => [p._id, p.enquiryCount, p.wonCount, p.conversionRate || 0])
        ];

        // Create workbook
        const wb = XLSX.utils.book_new();
        Object.keys(sheets).forEach(name => {
            wb.SheetNames.push(name);
            wb.Sheets[name] = XLSX.utils.aoa_to_sheet(sheets[name]);
        });

        XLSX.writeFile(wb, reportName);
        toast.success('Excel report downloaded');
    };

    // Tab: Dashboard
    const renderDashboard = () => (
        <div className="space-y-8">
            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard title="Total Enquiries" value={summary.totalEnquiries} icon={MdAnalytics} color="text-primary-600" bg="bg-primary-50" />
                    <StatCard title="Active" value={summary.activeCount} icon={MdTrendingUp} color="text-amber-600" bg="bg-amber-50" />
                    <StatCard title="Won" value={summary.wonCount} icon={MdCheckCircle} color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard title="Lost" value={summary.lostCount} icon={MdWarning} color="text-rose-600" bg="bg-rose-50" />
                    <StatCard title="Overdue Follow-ups" value={summary.overdueFU} icon={MdCalendarToday} color="text-orange-600" bg="bg-orange-50" />
                    <StatCard title="Pending Quotes" value={summary.pendingQuotations} icon={MdLocalOffer} color="text-indigo-600" bg="bg-indigo-50" />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Conversion Metrics */}
                {summary && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-black text-slate-900 mb-6">Key Metrics</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-600">Conversion Rate</span>
                                    <span className="text-lg font-black text-primary-600">{summary.conversionRate}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary-500" style={{ width: `${summary.conversionRate}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-600">Avg Probability</span>
                                    <span className="text-lg font-black text-emerald-600">{summary.avgProbability}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${summary.avgProbability}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stage Distribution */}
                {stages.length > 0 && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-black text-slate-900 mb-4">Stage Distribution</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={stages} dataKey="count" nameKey="stage" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                                    {stages.map((_, idx) => (
                                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Trends */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-slate-900">Enquiry Trends</h3>
                    <div className="flex gap-2">
                        {['daily', 'weekly', 'monthly'].map(period => (
                            <button
                                key={period}
                                onClick={() => setTrendPeriod(period)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    trendPeriod === period
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {period.charAt(0).toUpperCase() + period.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
                {trends.length > 0 && (
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="_id" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            <Legend />
                            <Area type="monotone" dataKey="totalEnquiries" stroke="#3B82F6" fillOpacity={1} fill="url(#colorTotal)" name="Total" />
                            <Area type="monotone" dataKey="wonEnquiries" stroke="#10B981" fillOpacity={1} fill="url(#colorWon)" name="Won" />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );

    // Tab: Follow-ups
    const renderFollowups = () => (
        <div className="space-y-6">
            {followUps && (
                <>
                    {/* Today's Follow-ups */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                            Today's Follow-ups ({followUps.today.length})
                        </h3>
                        <div className="space-y-3">
                            {followUps.today.length > 0 ? (
                                followUps.today.map(e => (
                                    <div key={e._id} className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-lg hover:shadow-md transition-shadow">
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-900">{e.enquiryNo}</p>
                                            <p className="text-xs text-slate-600">{e.customerId?.companyName}</p>
                                            <div className="flex gap-2 mt-2">
                                                {e.items?.slice(0, 2).map((item, i) => (
                                                    <span key={i} className="text-[10px] bg-white px-2 py-1 rounded text-slate-600">
                                                        {item.productName}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-500">Follow-up</p>
                                            <p className="font-bold text-slate-900">{formatDate(e.followUpDate)}</p>
                                            <span className={`text-xs font-black px-2 py-1 rounded mt-1 inline-block ${
                                                e.probability >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                                {e.probability}%
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-sm">No follow-ups scheduled for today</p>
                            )}
                        </div>
                    </div>

                    {/* Overdue Follow-ups */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                            Overdue Follow-ups ({followUps.overdue.length})
                        </h3>
                        <div className="space-y-3">
                            {followUps.overdue.length > 0 ? (
                                followUps.overdue.map(e => (
                                    <div key={e._id} className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-lg hover:shadow-md transition-shadow">
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-900">{e.enquiryNo}</p>
                                            <p className="text-xs text-slate-600">{e.customerId?.companyName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-500">Overdue Since</p>
                                            <p className="font-bold text-rose-600">{formatDate(e.followUpDate)}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-sm">No overdue follow-ups</p>
                            )}
                        </div>
                    </div>

                    {/* Upcoming Follow-ups */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            Upcoming (7 days) ({followUps.upcoming.length})
                        </h3>
                        <div className="space-y-3">
                            {followUps.upcoming.length > 0 ? (
                                followUps.upcoming.map(e => (
                                    <div key={e._id} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg hover:shadow-md transition-shadow">
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-900">{e.enquiryNo}</p>
                                            <p className="text-xs text-slate-600">{e.customerId?.companyName}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-500">Scheduled</p>
                                            <p className="font-bold text-blue-600">{formatDate(e.followUpDate)}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-sm">No upcoming follow-ups</p>
                            )}
                        </div>
                    </div>

                    {/* High Risk Enquiries */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                            <MdWarning className="text-orange-600" />
                            High Risk Enquiries ({followUps.highRisk.length})
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="py-2 px-3 font-bold text-slate-600">Enquiry No</th>
                                        <th className="py-2 px-3 font-bold text-slate-600">Customer</th>
                                        <th className="py-2 px-3 font-bold text-slate-600">Probability</th>
                                        <th className="py-2 px-3 font-bold text-slate-600">Status</th>
                                        <th className="py-2 px-3 font-bold text-slate-600">Last Activity</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {followUps.highRisk.map(e => (
                                        <tr key={e._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-3 font-bold text-slate-900">{e.enquiryNo}</td>
                                            <td className="py-3 px-3 text-slate-700">{e.customerId?.companyName}</td>
                                            <td className="py-3 px-3">
                                                <span className="text-xs font-black px-2 py-1 rounded bg-rose-100 text-rose-700">{e.probability}%</span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-700">{e.status}</span>
                                            </td>
                                            <td className="py-3 px-3 text-slate-600">{formatDate(e.lastActivityDate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    // Tab: Vendors
    const renderVendors = () => (
        <div className="space-y-6">
            {vendors.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
                    <h3 className="text-sm font-black text-slate-900 mb-4">Vendor Performance</h3>
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="py-3 px-4 font-black text-slate-600">Vendor</th>
                                <th className="py-3 px-4 font-black text-slate-600 text-right">Quotes</th>
                                <th className="py-3 px-4 font-black text-slate-600 text-right">Wins</th>
                                <th className="py-3 px-4 font-black text-slate-600 text-right">Win Ratio</th>
                                <th className="py-3 px-4 font-black text-slate-600 text-right">Avg Price</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {vendors.map(v => (
                                <tr key={v._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-4 font-bold text-slate-900">{v._id || 'Unknown'}</td>
                                    <td className="py-3 px-4 text-right text-slate-700">{v.quoteCount}</td>
                                    <td className="py-3 px-4 text-right font-bold text-emerald-600">{v.winCount}</td>
                                    <td className="py-3 px-4 text-right">
                                        <span className="text-xs font-black px-2 py-1 rounded bg-blue-100 text-blue-700">
                                            {v.winRatio}%
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-slate-700">₹{Math.round(v.avgPrice || 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    // Tab: Products
    const renderProducts = () => (
        <div className="space-y-6">
            {products.length > 0 && (
                <>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-black text-slate-900 mb-4">Most Enquired Products</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={products.slice(0, 10)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="_id" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                                <Tooltip />
                                <Bar dataKey="enquiryCount" fill="#3B82F6" name="Enquiries" radius={[8, 8, 0, 0]} />
                                <Bar dataKey="wonCount" fill="#10B981" name="Won" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
                        <h3 className="text-sm font-black text-slate-900 mb-4">Product Intelligence</h3>
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                    <th className="py-3 px-4 font-black text-slate-600">Product</th>
                                    <th className="py-3 px-4 font-black text-slate-600 text-right">Enquiries</th>
                                    <th className="py-3 px-4 font-black text-slate-600 text-right">Won</th>
                                    <th className="py-3 px-4 font-black text-slate-600 text-right">Conversion %</th>
                                    <th className="py-3 px-4 font-black text-slate-600 text-right">Lost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {products.map(p => (
                                    <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-4 font-bold text-slate-900">{p._id}</td>
                                        <td className="py-3 px-4 text-right text-slate-700">{p.enquiryCount}</td>
                                        <td className="py-3 px-4 text-right font-bold text-emerald-600">{p.wonCount}</td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="text-xs font-black px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                                                {p.conversionRate}%
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right text-rose-600 font-bold">{p.lostCount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );

    // Tab: Users
    const renderUsers = () => (
        <div className="space-y-6">
            {users.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
                    <h3 className="text-sm font-black text-slate-900 mb-4">Salesperson Performance</h3>
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="py-3 px-4 font-black text-slate-600">Salesperson</th>
                                <th className="py-3 px-4 font-black text-slate-600 text-right">Handled</th>
                                <th className="py-3 px-4 font-black text-slate-600 text-right">Won</th>
                                <th className="py-3 px-4 font-black text-slate-600 text-right">Lost</th>
                                <th className="py-3 px-4 font-black text-slate-600 text-right">Pending</th>
                                <th className="py-3 px-4 font-black text-slate-600 text-right">Conversion %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {users.map((u, idx) => (
                                <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-4 font-bold text-slate-900">
                                        {u._id}
                                        {idx === 0 && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold">Top</span>}
                                    </td>
                                    <td className="py-3 px-4 text-right text-slate-700">{u.handledCount}</td>
                                    <td className="py-3 px-4 text-right font-bold text-emerald-600">{u.wonCount}</td>
                                    <td className="py-3 px-4 text-right text-rose-600">{u.lostCount}</td>
                                    <td className="py-3 px-4 text-right text-slate-700">{u.pendingCount}</td>
                                    <td className="py-3 px-4 text-right">
                                        <span className="text-xs font-black px-2 py-1 rounded bg-blue-100 text-blue-700">
                                            {u.conversionRate}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    // Tab: Probability
    const renderProbability = () => (
        <div className="space-y-6">
            {probability && (
                <>
                    {probability.byStage.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-sm font-black text-slate-900 mb-4">Avg Probability by Stage</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={probability.byStage}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="_id" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                                    <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                                    <Tooltip />
                                    <Bar dataKey="avgProbability" fill="#10B981" radius={[8, 8, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {probability.highProbNotClosed.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                                <MdThumbUp className="text-emerald-600" />
                                High Probability (&gt;70%) Not Closed
                            </h3>
                            <div className="space-y-2">
                                {probability.highProbNotClosed.map(e => (
                                    <div key={e._id} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                                        <div>
                                            <p className="font-bold text-slate-900">{e.enquiryNo}</p>
                                            <p className="text-xs text-slate-600">{e.customerId?.companyName}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-black px-2 py-1 rounded bg-emerald-100 text-emerald-700">{e.probability}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {probability.lowProbWon.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-sm font-black text-slate-900 mb-4">Low Probability (&lt;30%) That Won (Insights)</h3>
                            <div className="space-y-2">
                                {probability.lowProbWon.map(e => (
                                    <div key={e._id} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-100 rounded-lg">
                                        <div>
                                            <p className="font-bold text-slate-900">{e.enquiryNo}</p>
                                            <p className="text-xs text-slate-600">{e.customerId?.companyName}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-black px-2 py-1 rounded bg-purple-100 text-purple-700">{e.probability}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    // Tab: Health & Actions
    const renderHealth = () => (
        <div className="space-y-6">
            {health.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
                    <h3 className="text-sm font-black text-slate-900 mb-4">Enquiry Health & Recommended Actions</h3>
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="py-3 px-3 font-black text-slate-600">Enquiry</th>
                                <th className="py-3 px-3 font-black text-slate-600">Customer</th>
                                <th className="py-3 px-3 font-black text-slate-600">Status</th>
                                <th className="py-3 px-3 font-black text-slate-600">Probability</th>
                                <th className="py-3 px-3 font-black text-slate-600">Health Score</th>
                                <th className="py-3 px-3 font-black text-slate-600">Recommended Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {health.map(h => (
                                <tr key={h._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-3 font-bold text-slate-900">{h.enquiryNo}</td>
                                    <td className="py-3 px-3 text-slate-700">{h.customerId?.companyName || 'Unknown'}</td>
                                    <td className="py-3 px-3">
                                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-700">{h.status}</span>
                                    </td>
                                    <td className="py-3 px-3">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded ${
                                            h.probability >= 70 ? 'bg-emerald-100 text-emerald-700' : h.probability >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                            {h.probability}%
                                        </span>
                                    </td>
                                    <td className="py-3 px-3">
                                        <HealthScoreBadge score={h.healthScore} />
                                    </td>
                                    <td className="py-3 px-3">
                                        <ActionBadge action={h.recommendedAction} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <MdAnalytics className="text-primary-600" />
                        Enquiry Analytics
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Comprehensive insights and intelligence across enquiries</p>
                </div>
                <button
                    onClick={exportToExcel}
                    className="px-6 py-3 bg-primary-600 text-white rounded-lg font-black text-xs uppercase tracking-widest hover:bg-primary-700 transition-all flex items-center gap-2 shadow-lg"
                >
                    <MdDownload size={18} />
                    Export Excel
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-sm font-black text-slate-900 mb-4"
                >
                    <MdFilterList size={20} />
                    Filters
                </button>

                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">From Date</label>
                            <input
                                type="date"
                                value={filters.from}
                                onChange={(e) => handleFilterChange('from', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">To Date</label>
                            <input
                                type="date"
                                value={filters.to}
                                onChange={(e) => handleFilterChange('to', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-primary-500"
                            >
                                <option value="">All Statuses</option>
                                {['Open', 'Assigned', 'In Progress', 'Pending Customer', 'Resolved', 'Closed', 'Cancelled'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-3 flex justify-end">
                            <button
                                onClick={clearFilters}
                                className="text-xs font-bold text-slate-500 hover:text-slate-900"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: MdDashboard },
                    { id: 'followups', label: 'Follow-ups', icon: MdPhone },
                    { id: 'vendors', label: 'Vendors', icon: MdPieChart },
                    { id: 'products', label: 'Products', icon: MdLocalOffer },
                    { id: 'users', label: 'Salespersons', icon: MdPerson },
                    { id: 'probability', label: 'Probability', icon: MdTrendingUp },
                    { id: 'health', label: 'Health & Actions', icon: MdAnalytics }
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest rounded-t-lg border-b-2 whitespace-nowrap transition-all ${
                                activeTab === tab.id
                                    ? 'bg-primary-50 text-primary-600 border-primary-600'
                                    : 'text-slate-600 border-transparent hover:text-slate-900'
                            }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-12 w-12"></div>
                    </div>
                )}
                {!loading && (
                    <>
                        {activeTab === 'dashboard' && renderDashboard()}
                        {activeTab === 'followups' && renderFollowups()}
                        {activeTab === 'vendors' && renderVendors()}
                        {activeTab === 'products' && renderProducts()}
                        {activeTab === 'users' && renderUsers()}
                        {activeTab === 'probability' && renderProbability()}
                        {activeTab === 'health' && renderHealth()}
                    </>
                )}
            </div>
        </div>
    );
};

export default EnquiryAnalytics;
