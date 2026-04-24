import React, { useState, useEffect } from 'react';
import {
    MdTrendingUp,
    MdDescription,
    MdAttachMoney,
    MdDownload,
    MdSearch,
    MdBarChart,
    MdPeople,
    MdStorefront,
    MdInventory,
    MdAssignment,
    MdCalendarMonth,
    MdNotifications,
    MdRefresh
} from 'react-icons/md';
import { quotationService, analyticsService, planningService } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import * as XLSX from 'xlsx';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    AreaChart,
    Area
} from 'recharts';

const TABS = [
    { key: 'quotations', label: 'Quotations', icon: <MdDescription size={18} /> },
    { key: 'enquiries', label: 'Enquiries', icon: <MdAssignment size={18} /> },
    { key: 'vendors', label: 'Vendors', icon: <MdStorefront size={18} /> },
    { key: 'products', label: 'Products', icon: <MdInventory size={18} /> },
    { key: 'planning', label: 'Planning', icon: <MdCalendarMonth size={18} /> },
    { key: 'followups', label: 'Follow-ups', icon: <MdNotifications size={18} /> },
];

const COLORS = ['#6366f1', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const STATUS_COLORS = {
    'New': '#6366f1', 'Follow-up': '#f59e0b', 'Quotation Pending': '#06b6d4',
    'Quotation Received': '#8b5cf6', 'Negotiation': '#ec4899', 'PO Received': '#10b981',
    'Lost': '#ef4444', 'Finalized': '#059669',
};

const StatCard = ({ icon, label, value, color = 'primary' }) => {
    const colorMap = {
        primary: 'bg-primary-50 text-primary-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600',
        rose: 'bg-rose-50 text-rose-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        violet: 'bg-violet-50 text-violet-600',
    };
    return (
        <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
            <div className={`w-12 h-12 ${colorMap[color]} rounded-2xl flex items-center justify-center mb-4`}>
                {icon}
            </div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</h3>
            <p className="text-2xl font-black text-slate-900 font-outfit tracking-tighter">{value}</p>
        </div>
    );
};

const Reports = () => {
    const [activeTab, setActiveTab] = useState('quotations');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter] = useState({ start: '', end: '' });

    // Quotation data
    const [reportData, setReportData] = useState(null);
    const [allQuotations, setAllQuotations] = useState([]);

    // Enquiry data
    const [enquirySummary, setEnquirySummary] = useState(null);
    const [enquiryStages, setEnquiryStages] = useState([]);
    const [enquiryTrends, setEnquiryTrends] = useState([]);

    // Vendor data
    const [vendorData, setVendorData] = useState([]);

    // Product data
    const [productData, setProductData] = useState([]);

    // Planning data
    const [planningReport, setPlanningReport] = useState(null);
    const [planningFY, setPlanningFY] = useState('');

    // Follow-up data
    const [followUpData, setFollowUpData] = useState(null);

    useEffect(() => {
        // Set default FY
        const now = new Date();
        const fy = now.getMonth() >= 3 ? `${now.getFullYear()}-${now.getFullYear() + 1}` : `${now.getFullYear() - 1}-${now.getFullYear()}`;
        setPlanningFY(fy);
    }, []);

    useEffect(() => {
        fetchTabData(activeTab);
    }, [activeTab]);

    const fetchTabData = async (tab) => {
        setLoading(true);
        try {
            const params = {};
            if (dateFilter.start) params.from = dateFilter.start;
            if (dateFilter.end) params.to = dateFilter.end;

            switch (tab) {
                case 'quotations': {
                    const [reportRes, qtnRes] = await Promise.all([
                        quotationService.getReports(),
                        quotationService.getAll()
                    ]);
                    setReportData(reportRes.data);
                    setAllQuotations(qtnRes.data);
                    break;
                }
                case 'enquiries': {
                    const [summaryRes, stagesRes, trendsRes] = await Promise.all([
                        analyticsService.getSummary(params),
                        analyticsService.getStages(params),
                        analyticsService.getTrends('monthly', params)
                    ]);
                    setEnquirySummary(summaryRes.data);
                    setEnquiryStages(stagesRes.data);
                    setEnquiryTrends(trendsRes.data);
                    break;
                }
                case 'vendors': {
                    const res = await analyticsService.getVendors(params);
                    setVendorData(res.data);
                    break;
                }
                case 'products': {
                    const res = await analyticsService.getProducts(params);
                    setProductData(res.data);
                    break;
                }
                case 'planning': {
                    if (planningFY) {
                        const res = await planningService.getMGRReport(planningFY);
                        setPlanningReport(res.data);
                    }
                    break;
                }
                case 'followups': {
                    const res = await analyticsService.getFollowUps(params);
                    setFollowUpData(res.data);
                    break;
                }
            }
        } catch (err) {
            console.error(`Error fetching ${tab} data:`, err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => fetchTabData(activeTab);

    // Excel exports per tab
    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        let ws, fileName;

        switch (activeTab) {
            case 'quotations': {
                const data = allQuotations.map(q => ({
                    'Quotation No': q.quotationNo,
                    'Date': new Date(q.createdAt).toLocaleDateString(),
                    'Customer': q.customerId?.customerName || q.customerName,
                    'Company': q.customerId?.companyName || 'N/A',
                    'Subtotal': q.subtotal,
                    'GST': q.grandTotal - q.subtotal,
                    'Grand Total': q.grandTotal,
                    'Status': q.status,
                    'Created By': q.createdBy?.name || 'Admin'
                }));
                ws = XLSX.utils.json_to_sheet(data);
                fileName = 'Quotation_Report';
                break;
            }
            case 'enquiries': {
                const stageData = (enquiryStages || []).map(s => ({ Stage: s._id || s.status, Count: s.count }));
                ws = XLSX.utils.json_to_sheet(stageData);
                fileName = 'Enquiry_Report';
                break;
            }
            case 'vendors': {
                const data = (vendorData || []).map(v => ({
                    'Vendor': v._id || v.vendorName,
                    'Quotes': v.quoteCount || 0,
                    'Wins': v.winCount || 0,
                    'Losses': v.lossCount || 0,
                    'Win %': v.winCount && v.quoteCount ? ((v.winCount / v.quoteCount) * 100).toFixed(1) + '%' : '0%',
                    'Avg Price': v.avgPrice ? Math.round(v.avgPrice) : 0
                }));
                ws = XLSX.utils.json_to_sheet(data);
                fileName = 'Vendor_Report';
                break;
            }
            case 'products': {
                const data = (productData || []).map(p => ({
                    'Product': p._id || p.productName,
                    'Enquiries': p.enquiryCount || 0,
                    'Conversion %': p.conversionRate ? p.conversionRate.toFixed(1) + '%' : '0%',
                    'Vendors': p.vendorCount || 0,
                    'Lost': p.lostCount || 0
                }));
                ws = XLSX.utils.json_to_sheet(data);
                fileName = 'Product_Report';
                break;
            }
            case 'planning': {
                if (planningReport?.rows) {
                    const data = planningReport.rows.map(r => {
                        const row = { Month: r.month };
                        if (r.mgrType) {
                            row['MGR Type'] = r.mgrType;
                        }
                        (planningReport.mgrColumns || []).forEach(col => {
                            row[col] = r[col] || 0;
                        });
                        row['Total'] = r.total || 0;
                        return row;
                    });
                    ws = XLSX.utils.json_to_sheet(data);
                } else {
                    ws = XLSX.utils.json_to_sheet([{ Message: 'No planning data' }]);
                }
                fileName = 'Planning_Report';
                break;
            }
            case 'followups': {
                const all = [
                    ...(followUpData?.overdue || []).map(f => ({ ...f, Category: 'Overdue' })),
                    ...(followUpData?.today || []).map(f => ({ ...f, Category: 'Today' })),
                    ...(followUpData?.upcoming || []).map(f => ({ ...f, Category: 'Upcoming' })),
                ];
                const data = all.map(f => ({
                    'Category': f.Category,
                    'Enquiry No': f.enquiryNo,
                    'Customer': f.customerName,
                    'Follow-up Date': f.followUpDate ? new Date(f.followUpDate).toLocaleDateString() : '',
                    'Status': f.status,
                    'Probability': f.probability ? f.probability + '%' : ''
                }));
                ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Message: 'No follow-up data' }]);
                fileName = 'FollowUp_Report';
                break;
            }
        }

        XLSX.utils.book_append_sheet(wb, ws, activeTab);
        XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filteredQuotations = allQuotations.filter(q => {
        const matchesSearch = (q.quotationNo + q.customerName + (q.customerId?.customerName || '')).toLowerCase().includes(searchTerm.toLowerCase());
        const qDate = new Date(q.createdAt);
        const matchesStart = !dateFilter.start || qDate >= new Date(dateFilter.start);
        const matchesEnd = !dateFilter.end || qDate <= new Date(dateFilter.end);
        return matchesSearch && matchesStart && matchesEnd;
    });

    // ——— Tab Content Renderers ———

    const renderQuotations = () => {
        if (!reportData) return null;
        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon={<MdDescription size={24} />} label="Total Quotations" value={reportData.summary.totalQuotations} color="primary" />
                    <StatCard icon={<MdAttachMoney size={24} />} label="Total Revenue (Ordered)" value={`₹${reportData.summary.totalValue?.toLocaleString()}`} color="emerald" />
                    <StatCard icon={<MdTrendingUp size={24} />} label="Conversion Rate" value={`${reportData.summary.totalQuotations > 0 ? ((reportData.summary.statusBreakdown.ordered / reportData.summary.totalQuotations) * 100).toFixed(1) : 0}%`} color="amber" />
                    <StatCard icon={<MdBarChart size={24} />} label="Draft Count" value={`${reportData.summary.statusBreakdown.draft || 0}`} color="indigo" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-lg font-black text-slate-900 uppercase">Revenue Growth Trend</h2>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 bg-primary-600 rounded-full"></span>
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Monthly Sales</span>
                            </div>
                        </div>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={reportData.monthlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                    <YAxis hide />
                                    <Tooltip cursor={{ fill: '#f8fafc', radius: 12 }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="total" radius={[8, 8, 8, 8]} barSize={40}>
                                        {reportData.monthlyTrend.map((_, i) => (
                                            <Cell key={i} fill={i === reportData.monthlyTrend.length - 1 ? '#0d9488' : '#e2e8f0'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-black text-slate-900 uppercase mb-8">Quotation Funnel</h2>
                        <div className="space-y-4">
                            {Object.entries(reportData.summary.statusBreakdown || {}).map(([status, count]) => (
                                <div key={status} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{status}</span>
                                        <span className="text-lg font-black text-slate-900">{count}</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div className={`h-full ${status === 'ordered' ? 'bg-emerald-500' : status === 'final' ? 'bg-primary-600' : 'bg-amber-400'}`}
                                            style={{ width: `${(count / (reportData.summary.totalQuotations || 1)) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quotation table */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Transaction Log</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Detailed quotation history</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 font-bold text-sm w-56 transition-all" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quote #</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Company</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Value</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredQuotations.map(q => (
                                    <tr key={q._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-black text-slate-900">#{q.quotationNo}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{q.customerId?.customerName || q.customerName}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-500">{q.customerId?.companyName || 'N/A'}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm font-black text-slate-900">{formatCurrency(q.grandTotal)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${q.status === 'ordered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : q.status === 'final' ? 'bg-primary-50 text-primary-600 border border-primary-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                                {q.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderEnquiries = () => {
        if (!enquirySummary) return null;
        const stageChartData = (enquiryStages || []).map(s => ({ name: s._id || s.status, value: s.count }));

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon={<MdAssignment size={24} />} label="Total Enquiries" value={enquirySummary.total || 0} color="primary" />
                    <StatCard icon={<MdTrendingUp size={24} />} label="Conversion Rate" value={`${(enquirySummary.conversionRate || 0).toFixed(1)}%`} color="emerald" />
                    <StatCard icon={<MdNotifications size={24} />} label="Overdue Follow-ups" value={enquirySummary.overdueCount || 0} color="rose" />
                    <StatCard icon={<MdDescription size={24} />} label="Avg Probability" value={`${(enquirySummary.avgProbability || 0).toFixed(0)}%`} color="amber" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Stage distribution */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-black text-slate-900 uppercase mb-6">Stage Distribution</h2>
                        {stageChartData.length > 0 ? (
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stageChartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                        <YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                                        <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                                            {stageChartData.map((entry, i) => (
                                                <Cell key={i} fill={STATUS_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm font-semibold text-center py-12">No stage data available</p>
                        )}
                    </div>

                    {/* Trends */}
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                        <h2 className="text-lg font-black text-slate-900 uppercase mb-6">Monthly Trends</h2>
                        {enquiryTrends.length > 0 ? (
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={enquiryTrends}>
                                        <defs>
                                            <linearGradient id="colorEnquiries" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                        <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#colorEnquiries)" name="Enquiries" />
                                        <Area type="monotone" dataKey="wonCount" stroke="#10b981" strokeWidth={2} fill="url(#colorWon)" name="Won" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm font-semibold text-center py-12">No trend data available</p>
                        )}
                    </div>
                </div>

                {/* Stage breakdown table */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <h2 className="text-lg font-black text-slate-900">Stage Breakdown</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stage</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Count</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">% of Total</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {stageChartData.map(s => {
                                    const pct = enquirySummary.total > 0 ? ((s.value / enquirySummary.total) * 100).toFixed(1) : 0;
                                    return (
                                        <tr key={s.name} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{s.name}</td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-900">{s.value}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-slate-500">{pct}%</td>
                                            <td className="px-6 py-4 w-48">
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s.name] || '#6366f1' }}></div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderVendors = () => {
        if (!vendorData || vendorData.length === 0) {
            return <div className="text-center py-20 text-slate-400 font-semibold">No vendor data available</div>;
        }

        const topVendors = [...vendorData].sort((a, b) => (b.quoteCount || 0) - (a.quoteCount || 0)).slice(0, 8);
        const chartData = topVendors.map(v => ({
            name: v._id || v.vendorName || 'Unknown',
            quotes: v.quoteCount || 0,
            wins: v.winCount || 0
        }));

        const bestWinRatio = [...vendorData].sort((a, b) => {
            const ratioA = a.quoteCount ? (a.winCount || 0) / a.quoteCount : 0;
            const ratioB = b.quoteCount ? (b.winCount || 0) / b.quoteCount : 0;
            return ratioB - ratioA;
        })[0];

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon={<MdStorefront size={24} />} label="Total Vendors" value={vendorData.length} color="primary" />
                    <StatCard icon={<MdTrendingUp size={24} />} label="Most Active" value={topVendors[0]?._id || topVendors[0]?.vendorName || '-'} color="emerald" />
                    <StatCard icon={<MdBarChart size={24} />} label="Best Win Ratio" value={bestWinRatio?._id || bestWinRatio?.vendorName || '-'} color="violet" />
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900 uppercase mb-6">Top Vendors — Quotes vs Wins</h2>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="quotes" fill="#e2e8f0" radius={[8, 8, 0, 0]} barSize={32} name="Quotes" />
                                <Bar dataKey="wins" fill="#10b981" radius={[8, 8, 0, 0]} barSize={32} name="Wins" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <h2 className="text-lg font-black text-slate-900">Vendor Performance Table</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quotes</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Wins</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Losses</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Win %</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {vendorData.map((v, i) => {
                                    const winPct = v.quoteCount ? ((v.winCount || 0) / v.quoteCount * 100).toFixed(1) : '0.0';
                                    return (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900">{v._id || v.vendorName}</td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-900">{v.quoteCount || 0}</td>
                                            <td className="px-6 py-4 text-sm font-black text-emerald-600">{v.winCount || 0}</td>
                                            <td className="px-6 py-4 text-sm font-black text-rose-500">{v.lossCount || 0}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${parseFloat(winPct) >= 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    {winPct}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-500">{v.avgPrice ? formatCurrency(Math.round(v.avgPrice)) : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderProducts = () => {
        if (!productData || productData.length === 0) {
            return <div className="text-center py-20 text-slate-400 font-semibold">No product data available</div>;
        }

        const topProducts = [...productData].sort((a, b) => (b.enquiryCount || 0) - (a.enquiryCount || 0)).slice(0, 10);
        const chartData = topProducts.map(p => ({
            name: (p._id || p.productName || 'Unknown').substring(0, 20),
            enquiries: p.enquiryCount || 0,
            converted: p.convertedCount || 0
        }));

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon={<MdInventory size={24} />} label="Products Tracked" value={productData.length} color="primary" />
                    <StatCard icon={<MdTrendingUp size={24} />} label="Most Enquired" value={(topProducts[0]?._id || topProducts[0]?.productName || '-').substring(0, 25)} color="emerald" />
                    <StatCard icon={<MdBarChart size={24} />} label="Total Enquiries" value={productData.reduce((s, p) => s + (p.enquiryCount || 0), 0)} color="violet" />
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h2 className="text-lg font-black text-slate-900 uppercase mb-6">Top Products by Demand</h2>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} />
                                <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="enquiries" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={22} name="Enquiries" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                        <h2 className="text-lg font-black text-slate-900">Product Demand Table</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enquiries</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Conversion %</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendors</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {productData.map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{p._id || p.productName}</td>
                                        <td className="px-6 py-4 text-sm font-black text-slate-900">{p.enquiryCount || 0}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${(p.conversionRate || 0) >= 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {(p.conversionRate || 0).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-500">{p.vendorCount || 0}</td>
                                        <td className="px-6 py-4 text-sm font-black text-rose-500">{p.lostCount || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderPlanning = () => {
        const currentYear = new Date().getFullYear();
        const fyOptions = [];
        for (let y = currentYear - 2; y <= currentYear + 1; y++) {
            fyOptions.push(`${y}-${y + 1}`);
        }

        return (
            <div className="space-y-8">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-black text-slate-600 uppercase tracking-widest">Financial Year</label>
                    <select value={planningFY} onChange={(e) => setPlanningFY(e.target.value)}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 outline-none">
                        {fyOptions.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                    <button onClick={() => fetchTabData('planning')} className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary-700 transition-colors">
                        Load Report
                    </button>
                </div>

                {planningReport ? (
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                            <h2 className="text-lg font-black text-slate-900">MGR Planning Report — FY {planningFY}</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Date-first breakdown, paired MGR 1 then MGR 2</p>
                        </div>
                        <div className="overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white">
                                        <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Month</th>
                                        <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Type</th>
                                        {(planningReport.mgrColumns || []).map(col => (
                                            <th key={col} className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{col}</th>
                                        ))}
                                        <th className="px-4 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {(planningReport.rows || []).map((row, i) => {
                                        const isQuarter = row.month?.startsWith('Q');
                                        const isGrand = row.month === 'Grand Total' || row.month === 'Percentage';
                                        return (
                                            <tr key={i} className={`${isQuarter ? 'bg-primary-50/50 font-black' : isGrand ? 'bg-slate-100 font-black' : 'hover:bg-slate-50'}`}>
                                                <td className={`px-4 py-3 text-sm font-bold ${isQuarter ? 'text-primary-700 bg-primary-50/50' : isGrand ? 'text-slate-900 bg-slate-100' : 'text-slate-700 bg-white'}`}>{row.month}</td>
                                                <td className={`px-4 py-3 text-xs font-black uppercase tracking-widest ${row.mgrType === 'MGR 2' ? 'text-indigo-700' : 'text-blue-700'}`}>{row.mgrType || '-'}</td>
                                                {(planningReport.mgrColumns || []).map(col => (
                                                    <td key={col} className="px-4 py-3 text-sm font-semibold text-slate-600 text-right">
                                                        {row.month === 'Percentage' ? `${row[col] || 0}%` : (row[col] || 0).toLocaleString()}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3 text-sm font-black text-slate-900 text-right">
                                                    {row.month === 'Percentage' ? `${row.total || 0}%` : (row.total || 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20 text-slate-400 font-semibold">Select a financial year and click Load Report</div>
                )}
            </div>
        );
    };

    const renderFollowUps = () => {
        if (!followUpData) return <div className="text-center py-20 text-slate-400 font-semibold">No follow-up data available</div>;

        const sections = [
            { key: 'overdue', label: 'Overdue', color: 'rose', data: followUpData.overdue || [] },
            { key: 'today', label: 'Due Today', color: 'amber', data: followUpData.today || [] },
            { key: 'upcoming', label: 'Upcoming (7 days)', color: 'blue', data: followUpData.upcoming || [] },
        ];

        const colorMap = {
            rose: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-700' },
            amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
            blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
        };

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon={<MdNotifications size={24} />} label="Overdue" value={sections[0].data.length} color="rose" />
                    <StatCard icon={<MdNotifications size={24} />} label="Due Today" value={sections[1].data.length} color="amber" />
                    <StatCard icon={<MdNotifications size={24} />} label="Upcoming 7 Days" value={sections[2].data.length} color="primary" />
                </div>

                {sections.map(section => {
                    const colors = colorMap[section.color];
                    return (
                        <div key={section.key} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className={`p-6 border-b ${colors.border} ${colors.bg}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${colors.badge}`}>
                                        {section.label}
                                    </span>
                                    <span className="text-sm font-black text-slate-600">{section.data.length} enquiries</span>
                                </div>
                            </div>
                            {section.data.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-white">
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enquiry #</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Follow-up Date</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Probability</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {section.data.map((f, i) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="px-6 py-3 text-sm font-black text-slate-900">{f.enquiryNo}</td>
                                                    <td className="px-6 py-3 text-sm font-bold text-slate-700">{f.customerName}</td>
                                                    <td className="px-6 py-3 text-sm font-semibold text-slate-500">{f.followUpDate ? formatDate(f.followUpDate) : '-'}</td>
                                                    <td className="px-6 py-3">
                                                        <span className="inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                                                            {f.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-black text-slate-900">{f.probability ? `${f.probability}%` : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm font-semibold">No {section.label.toLowerCase()} follow-ups</div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderTabContent = () => {
        if (loading) {
            return (
                <div className="flex h-72 items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
                </div>
            );
        }
        switch (activeTab) {
            case 'quotations': return renderQuotations();
            case 'enquiries': return renderEnquiries();
            case 'vendors': return renderVendors();
            case 'products': return renderProducts();
            case 'planning': return renderPlanning();
            case 'followups': return renderFollowUps();
            default: return null;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">Reports</h1>
                    <p className="text-slate-500 font-semibold mt-1">Business performance across all modules</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleRefresh}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
                        <MdRefresh size={18} />
                        Refresh
                    </button>
                    <button onClick={handleExport}
                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-slate-900/20 uppercase text-xs tracking-widest active:scale-95">
                        <MdDownload size={18} />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 flex flex-wrap gap-1">
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                            activeTab === tab.key
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-primary-600'
                        }`}>
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {renderTabContent()}
        </div>
    );
};

export default Reports;
