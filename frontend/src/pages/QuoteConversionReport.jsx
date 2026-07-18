import React, { useState, useEffect } from 'react';
import { MdTrendingUp, MdAttachMoney, MdAssignment, MdAccessTime, MdRefresh, MdPeople, MdSearch, MdCalendarMonth, MdDownload } from 'react-icons/md';
import { quotationService } from '../services/api';
import { toast } from 'react-toastify';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell, Legend, PieChart, Pie } from 'recharts';
import { formatCurrency, formatDate } from '../utils/helpers';
import * as XLSX from 'xlsx-js-style';

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

const StatCard = ({ icon, label, value, color, description }) => {
    const colorClasses = {
        primary: 'bg-primary-50 text-primary-600 border-primary-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    };

    return (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-start gap-4">
            <div className={`p-4 rounded-2xl border ${colorClasses[color] || colorClasses.primary}`}>
                {icon}
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{label}</span>
                <span className="text-2xl font-black text-slate-900 block">{value}</span>
                {description && <span className="text-xs text-slate-400 font-medium block">{description}</span>}
            </div>
        </div>
    );
};

const QuoteConversionReport = () => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(10);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const res = await quotationService.getConversionReport();
            setReportData(res.data);
        } catch (err) {
            console.error('Error fetching conversion report:', err);
            toast.error('Failed to load conversion report metrics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReportData();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">Generating Conversion Analytics...</p>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="text-center p-12 bg-white rounded-[2rem] border border-slate-100">
                <p className="text-slate-400 font-bold">No report data generated.</p>
                <button onClick={fetchReportData} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl">Retry</button>
            </div>
        );
    }

    const { summary, monthlyTrend, salespersonPerformance, conversionDetails } = reportData;

    // Filter details log
    const filteredLog = conversionDetails.filter(log => {
        const query = searchTerm.toLowerCase();
        return (
            log.quotationNo.toLowerCase().includes(query) ||
            log.customerName.toLowerCase().includes(query) ||
            log.salespersonName.toLowerCase().includes(query)
        );
    });

    // Pagination
    const totalPages = Math.ceil(filteredLog.length / pageSize);
    const paginatedLog = filteredLog.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Salesperson Pie Chart Data
    const salespersonPieData = salespersonPerformance.map(sp => ({
        name: sp.salespersonName,
        value: sp.convertedQuotes
    })).filter(item => item.value > 0);

    const handleExportToExcel = () => {
        try {
            const wb = XLSX.utils.book_new();

            // 1. Summary Sheet
            const summaryData = [
                { Metric: 'Total Quotations', Value: summary.totalQuotations },
                { Metric: 'Total Converted', Value: summary.totalConverted },
                { Metric: 'Overall Conversion Rate (%)', Value: summary.overallConversionRate },
                { Metric: 'Approved Conversion Rate (%)', Value: summary.approvedConversionRate },
                { Metric: 'Average Time to Convert (Days)', Value: summary.avgConversionTimeDays }
            ];
            const wsSummary = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

            // 2. Sales Performance Sheet
            const salesData = salespersonPerformance.map(sp => ({
                'Salesperson': sp.salespersonName,
                'Total Quotes': sp.totalQuotes,
                'Converted Quotes': sp.convertedQuotes,
                'Conversion Rate (%)': sp.conversionRate,
                'Total Quote Value (INR)': sp.totalValue,
                'Converted Value (INR)': sp.convertedValue
            }));
            const wsSales = XLSX.utils.json_to_sheet(salesData);
            XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Performance');

            // 3. Conversion Details Sheet
            const conversionData = conversionDetails.map(log => ({
                'Quote Ref': log.quotationNo,
                'Customer': log.customerName,
                'Salesperson': log.salespersonName,
                'Quote Value (INR)': log.grandTotal,
                'Created Date': formatDate(log.quotationDate),
                'Converted Date': formatDate(log.convertedDate),
                'Conversion Time (Days)': log.conversionTimeDays
            }));
            const wsConversions = XLSX.utils.json_to_sheet(conversionData);
            XLSX.utils.book_append_sheet(wb, wsConversions, 'Conversion Log');

            // Save File
            XLSX.writeFile(wb, `Quote_Conversion_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success('Excel report exported successfully!');
        } catch (err) {
            console.error('Excel export error:', err);
            toast.error('Failed to export to Excel');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Quote Conversion Report</h1>
                    <p className="text-slate-500 font-medium">Track your quotation performance and conversion rates into sales orders.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportToExcel}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-bold transition-all shadow-md active:scale-95 text-xs uppercase tracking-wider"
                    >
                        <MdDownload size={18} />
                        Export to Excel
                    </button>
                    <button
                        onClick={fetchReportData}
                        className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-2xl font-bold transition-all shadow-sm active:scale-95 text-xs uppercase tracking-wider"
                    >
                        <MdRefresh size={18} />
                        Refresh Report
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={<MdAssignment size={24} />}
                    label="Total Quotes"
                    value={summary.totalQuotations}
                    color="primary"
                    description="Total generated quotations"
                />
                <StatCard
                    icon={<MdTrendingUp size={24} />}
                    label="Converted Quotes"
                    value={summary.totalConverted}
                    color="emerald"
                    description="Successfully converted to orders"
                />
                <StatCard
                    icon={<MdTrendingUp size={24} />}
                    label="Conversion Rate"
                    value={`${summary.overallConversionRate}%`}
                    color="amber"
                    description={`Approved rate: ${summary.approvedConversionRate}%`}
                />
                <StatCard
                    icon={<MdAccessTime size={24} />}
                    label="Avg. Time to Convert"
                    value={`${summary.avgConversionTimeDays} Days`}
                    color="indigo"
                    description="Duration from quote to order"
                />
            </div>

            {/* Trend & Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Monthly Trend Chart */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-slate-900 uppercase">Conversion Trend</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Created vs Converted Quotes</p>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc', radius: 12 }}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                                <Bar name="Quotes Created" dataKey="created" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={20} />
                                <Bar name="Quotes Converted" dataKey="converted" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Salesperson Performance */}
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 uppercase">Sales Performance</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conversion leaderboard</p>
                    </div>
                    <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                        {salespersonPerformance.map((sp, idx) => (
                            <div key={sp.salespersonName} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:shadow-md transition-all">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-400">#{idx + 1}</span>
                                        <span className="font-extrabold text-slate-800 text-sm">{sp.salespersonName}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold block uppercase">{sp.convertedQuotes} of {sp.totalQuotes} Converted</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-black text-slate-900 block">{sp.conversionRate}%</span>
                                    <span className="text-[10px] text-emerald-600 font-black block uppercase">₹{formatCurrency(sp.convertedValue)}</span>
                                </div>
                            </div>
                        ))}
                        {salespersonPerformance.length === 0 && (
                            <div className="text-center p-8 text-slate-400 text-xs font-bold uppercase tracking-widest">No representative logs</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pie Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Pie Chart 1: Conversion Breakdown */}
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 flex flex-col items-center">
                    <div className="w-full text-left">
                        <h2 className="text-lg font-black text-slate-900 uppercase">Conversion Breakdown</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Share of converted vs pending/draft quotes</p>
                    </div>
                    <div className="h-64 w-full flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Converted', value: summary.totalConverted },
                                        { name: 'Unconverted', value: Math.max(0, summary.totalQuotations - summary.totalConverted) }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#10b981" />
                                    <Cell fill="#cbd5e1" />
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Chart 2: Converted Quotes by Representative */}
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 flex flex-col items-center">
                    <div className="w-full text-left">
                        <h2 className="text-lg font-black text-slate-900 uppercase">Conversion by Representative</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distribution of converted quotes among sales reps</p>
                    </div>
                    <div className="h-64 w-full flex justify-center items-center">
                        {salespersonPieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={salespersonPieData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        dataKey="value"
                                    >
                                        {salespersonPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-slate-400 font-bold uppercase tracking-wider text-xs">No conversions recorded yet</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detailed Transaction Log */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Conversion Audit Log</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Detailed list of converted quotations</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search quote or customer..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 font-bold text-sm w-64 transition-all"
                            />
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                <th className="px-8 py-5">Quote Ref</th>
                                <th className="px-8 py-5">Customer</th>
                                <th className="px-8 py-5">Salesperson</th>
                                <th className="px-8 py-5 text-right">Quote Value</th>
                                <th className="px-8 py-5">Created Date</th>
                                <th className="px-8 py-5">Converted Date</th>
                                <th className="px-8 py-5 text-center">Duration</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm font-semibold">
                            {paginatedLog.map(log => (
                                <tr key={log.quotationNo} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-5 font-black text-slate-900">{log.quotationNo}</td>
                                    <td className="px-8 py-5 text-slate-700">{log.customerName}</td>
                                    <td className="px-8 py-5 text-slate-500">{log.salespersonName}</td>
                                    <td className="px-8 py-5 text-right font-extrabold text-slate-900">₹ {Number(log.grandTotal).toLocaleString()}</td>
                                    <td className="px-8 py-5 text-slate-400">{formatDate(log.quotationDate)}</td>
                                    <td className="px-8 py-5 text-slate-500">{formatDate(log.convertedDate)}</td>
                                    <td className="px-8 py-5 text-center">
                                        <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase ${
                                            log.conversionTimeDays <= 3 ? 'bg-emerald-50 text-emerald-600' :
                                            log.conversionTimeDays <= 10 ? 'bg-amber-50 text-amber-600' :
                                            'bg-rose-50 text-rose-600'
                                        }`}>
                                            {log.conversionTimeDays} Days
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {paginatedLog.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">No converted quotes found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-6 border-t border-slate-50 bg-slate-50/20 flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                            Page {currentPage} of {totalPages} ({filteredLog.length} items)
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuoteConversionReport;
