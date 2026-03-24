import React, { useState, useEffect } from 'react';
import { 
    MdTrendingUp, 
    MdDescription, 
    MdAttachMoney, 
    MdDownload, 
    MdFilterList,
    MdSearch,
    MdBarChart,
    MdAnalytics
} from 'react-icons/md';
import { quotationService } from '../services/api';
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
    Cell
} from 'recharts';

const Reports = () => {
    const [reportData, setReportData] = useState(null);
    const [allQuotations, setAllQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [reportRes, qtnRes] = await Promise.all([
                quotationService.getReports(),
                quotationService.getAll()
            ]);
            setReportData(reportRes.data);
            setAllQuotations(qtnRes.data);
        } catch (err) {
            console.error("Error fetching report data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        const dataToExport = allQuotations.map(q => ({
            'Quotation No': q.quotationNo,
            'Date': new Date(q.createdAt).toLocaleDateString(),
            'Customer Name': q.customerId?.customerName || q.customerName,
            'Company': q.customerId?.companyName || 'N/A',
            'Subtotal': q.subtotal,
            'GST Amount': q.grandTotal - q.subtotal,
            'Grand Total': q.grandTotal,
            'Status': q.status,
            'Created By': q.createdBy?.name || 'Admin'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        XLSX.utils.book_append_sheet(wb, ws, 'Quotations Report');
        XLSX.writeFile(wb, `Quotation_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filteredQuotations = allQuotations.filter(q => {
        const matchesSearch = (q.quotationNo + q.customerName + (q.customerId?.customerName || '')).toLowerCase().includes(searchTerm.toLowerCase());
        const qDate = new Date(q.createdAt);
        const matchesStart = !dateFilter.start || qDate >= new Date(dateFilter.start);
        const matchesEnd = !dateFilter.end || qDate <= new Date(dateFilter.end);
        return matchesSearch && matchesStart && matchesEnd;
    });

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit uppercase">Reports & Analytics</h1>
                    <p className="text-slate-500 font-semibold mt-1">Detailed business performance insights</p>
                </div>
                <button 
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-slate-900/20 uppercase text-xs tracking-widest active:scale-95"
                >
                    <MdDownload size={20} />
                    Export Detailed Excel
                </button>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
                    <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600 mb-6">
                        <MdDescription size={28} />
                    </div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Quotations</h3>
                    <p className="text-3xl font-black text-slate-900 font-outfit tracking-tighter">{reportData?.summary.totalQuotations}</p>
                </div>
                <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                        <MdAttachMoney size={28} />
                    </div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Revenue (Ordered)</h3>
                    <p className="text-3xl font-black text-slate-900 font-outfit tracking-tighter">₹{reportData?.summary.totalValue.toLocaleString()}</p>
                </div>
                <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6">
                        <MdTrendingUp size={28} />
                    </div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Conversion Rate</h3>
                    <p className="text-3xl font-black text-slate-900 font-outfit tracking-tighter">
                        {reportData && reportData.summary.totalQuotations > 0 
                            ? ((reportData.summary.statusBreakdown.ordered / reportData.summary.totalQuotations) * 100).toFixed(1) 
                            : 0}%
                    </p>
                </div>
                <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                        <MdBarChart size={28} />
                    </div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Draft Count</h3>
                    <p className="text-3xl font-black text-slate-900 font-outfit tracking-tighter">{reportData?.summary.statusBreakdown.draft || 0} items</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-10">
                        <h2 className="text-xl font-black text-slate-900 uppercase">Revenue Growth Trend</h2>
                        <div className="flex items-center gap-2">
                             <span className="w-3 h-3 bg-primary-600 rounded-full"></span>
                             <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Monthly Sales</span>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData?.monthlyTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <YAxis hide />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc', radius: 12 }}
                                    contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="total" radius={[8, 8, 8, 8]} barSize={40}>
                                    {reportData?.monthlyTrend.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 5 ? '#0d9488' : '#e2e8f0'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h2 className="text-xl font-black text-slate-900 uppercase mb-10">Quotation Funnel</h2>
                    <div className="space-y-6">
                        {Object.entries(reportData?.summary.statusBreakdown || {}).map(([status, count]) => (
                            <div key={status} className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{status}</span>
                                    <span className="text-lg font-black text-slate-900">{count}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${status === 'ordered' ? 'bg-emerald-500' : status === 'final' ? 'bg-primary-600' : 'bg-amber-400'}`}
                                        style={{ width: `${(count / (reportData?.summary.totalQuotations || 1)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Detailed Table Section */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-50 space-y-6 bg-slate-50/30">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-black text-slate-900">Detailed Transaction Log</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Transaction history for external audit</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative group">
                                <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-600 transition-colors" />
                                <input 
                                    type="text" 
                                    placeholder="Search details..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-11 pr-6 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary-600/10 focus:border-primary-600 font-bold text-sm w-full md:w-64 transition-all"
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                                <span className="text-[10px] font-black text-slate-400 uppercase">From</span>
                                <input type="date" value={dateFilter.start} onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})} className="bg-transparent border-none outline-none text-xs font-bold" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white">
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quote #</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Company</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Value</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredQuotations.map(q => (
                                <tr key={q._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-5 text-sm font-black text-slate-900">#{q.quotationNo}</td>
                                    <td className="px-8 py-5 text-sm font-bold text-slate-900">{q.customerId?.customerName || q.customerName}</td>
                                    <td className="px-8 py-5 text-sm font-bold text-slate-500">{q.customerId?.companyName || 'N/A'}</td>
                                    <td className="px-8 py-5 text-sm font-medium text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</td>
                                    <td className="px-8 py-5 text-sm font-black text-slate-900">{formatCurrency(q.grandTotal)}</td>
                                    <td className="px-8 py-5">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                            q.status === 'ordered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                            q.status === 'final' ? 'bg-primary-50 text-primary-600 border border-primary-100' :
                                            'bg-amber-50 text-amber-600 border border-amber-100'
                                        }`}>
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

export default Reports;
