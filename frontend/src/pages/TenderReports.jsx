import React, { useEffect, useState } from 'react';
import { tenderService, customerService } from '../services/api';
import { 
    MdTrendingUp, MdDescription, MdAttachMoney, MdDownload,
    MdSearch, MdBarChart, MdPeople, MdCalendarMonth,
    MdAssignment, MdWarning, MdCheckCircle, MdAccessTime, MdFilterList
} from 'react-icons/md';
import { formatDate } from '../utils/helpers';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

const REPORT_TABS = [
    { key: 'pipeline', label: 'Tender Pipeline', icon: <MdTrendingUp size={18} />, desc: 'Active & Submitted tenders representing future opportunities.' },
    { key: 'win_loss', label: 'Win/Loss Report', icon: <MdCheckCircle size={18} />, desc: 'Analysis of won and lost tenders with calculated win rate.' },
    { key: 'deadlines', label: 'Upcoming Deadlines', icon: <MdAccessTime size={18} />, desc: 'Tenders approaching submission deadlines, sorted chronologically.' },
    { key: 'value_rep', label: 'Tender Value Report', icon: <MdAttachMoney size={18} />, desc: 'Portfolio financial summary by status, department, and assignee.' },
    { key: 'approvals', label: 'Pending Approvals', icon: <MdWarning size={18} />, desc: 'Tenders currently awaiting authorization clearances.' },
    { key: 'client_wise', label: 'Client-wise Report', icon: <MdPeople size={18} />, desc: 'Tender breakdown and values aggregated by Customer/Client.' },
    { key: 'monthly', label: 'Monthly Summary', icon: <MdCalendarMonth size={18} />, desc: 'Tender creation volumes and financial portfolio progression by month.' },
    { key: 'activities', label: 'Activity Logs', icon: <MdAssignment size={18} />, desc: 'Unified audit trail of actions taken on tenders.' }
];

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const STATUS_BADGES = {
    'Active': 'bg-blue-50 text-blue-700 border-blue-100',
    'Submitted': 'bg-amber-50 text-amber-700 border-amber-100',
    'Won': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'Lost': 'bg-rose-50 text-rose-700 border-rose-100',
    'Pending Approval': 'bg-purple-50 text-purple-700 border-purple-100'
};

const formatCurrency = (val) => {
    if (!val && val !== 0) return '₹0';
    return `₹${val.toLocaleString('en-IN')}`;
};

const TenderReports = () => {
    const now = new Date();
    const [activeTab, setActiveTab] = useState('pipeline');
    const [tenders, setTenders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [customerId, setCustomerId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Dropdown list
    const [customers, setCustomers] = useState([]);

    const loadCustomers = async () => {
        try {
            const res = await customerService.getAll({ limit: 1000 });
            setCustomers(res.data?.data || res.data?.docs || res.data || []);
        } catch (err) {
            console.error('Failed to load customers for reports:', err);
        }
    };

    const loadData = async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            const params = {
                customerId: customerId || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            };
            const res = await tenderService.getTenders(params);
            setTenders(res.data || []);
        } catch (err) {
            console.error('Failed to load tenders report data:', err);
            toast.error('Failed to load tenders database records.');
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, []);

    useEffect(() => {
        loadData(true);
    }, [customerId, startDate, endDate]);

    const handleClearFilters = () => {
        setCustomerId('');
        setStartDate('');
        setEndDate('');
    };

    // PROCESS REPORT DATA DYNAMICALLY BASED ON ACTIVE TAB
    const getReportData = () => {
        const now = new Date();
        
        switch (activeTab) {
            case 'pipeline':
                // Active, Submitted, Pending Approval sorted by value desc
                return tenders
                    .filter(t => ['Active', 'Submitted', 'Pending Approval'].includes(t.status))
                    .sort((a, b) => b.value - a.value);
            
            case 'win_loss':
                // Won and Lost tenders
                return tenders.filter(t => ['Won', 'Lost'].includes(t.status));
            
            case 'deadlines':
                // Active and Submitted, sorted by deadline date ascending
                return tenders
                    .filter(t => ['Active', 'Submitted'].includes(t.status))
                    .sort((a, b) => new Date(a.deadlineDate) - new Date(b.deadlineDate));
            
            case 'value_rep':
                // All tenders, sorted by value desc
                return [...tenders].sort((a, b) => b.value - a.value);
            
            case 'approvals':
                // Pending Approval
                return tenders.filter(t => t.status === 'Pending Approval');
            
            case 'client_wise': {
                // Group by client
                const grouped = {};
                tenders.forEach(t => {
                    const clientName = t.customerId?.companyName || t.customerId?.customerName || 'Unknown Client';
                    if (!grouped[clientName]) {
                        grouped[clientName] = { client: clientName, count: 0, totalValue: 0, wonCount: 0, wonValue: 0 };
                    }
                    grouped[clientName].count += 1;
                    grouped[clientName].totalValue += t.value || 0;
                    if (t.status === 'Won') {
                        grouped[clientName].wonCount += 1;
                        grouped[clientName].wonValue += t.value || 0;
                    }
                });
                return Object.values(grouped).sort((a, b) => b.totalValue - a.totalValue);
            }
            
            case 'monthly': {
                // Group by month
                const grouped = {};
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                tenders.forEach(t => {
                    const dt = new Date(t.createdAt || Date.now());
                    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
                    const label = `${months[dt.getMonth()]} ${dt.getFullYear()}`;
                    if (!grouped[key]) {
                        grouped[key] = { key, label, count: 0, totalValue: 0, wonCount: 0, wonValue: 0 };
                    }
                    grouped[key].count += 1;
                    grouped[key].totalValue += t.value || 0;
                    if (t.status === 'Won') {
                        grouped[key].wonCount += 1;
                        grouped[key].wonValue += t.value || 0;
                    }
                });
                return Object.values(grouped).sort((a, b) => b.key.localeCompare(a.key));
            }
            
            case 'activities': {
                // Flatten activity log from all tenders
                const logs = [];
                tenders.forEach(t => {
                    if (Array.isArray(t.activities)) {
                        t.activities.forEach(act => {
                            logs.push({
                                tenderNo: t.tenderNo,
                                title: t.title,
                                userName: act.userName || 'System',
                                action: act.action,
                                timestamp: new Date(act.timestamp)
                            });
                        });
                    }
                });
                return logs.sort((a, b) => b.timestamp - a.timestamp);
            }

            default:
                return tenders;
        }
    };

    const currentData = getReportData();

    // Excel Export function
    const handleExportExcel = () => {
        const tabInfo = REPORT_TABS.find(t => t.key === activeTab);
        let exportData = [];

        if (activeTab === 'client_wise') {
            exportData = currentData.map((d, i) => ({
                'Sr. No.': i + 1,
                'Client / Customer': d.client,
                'Total Tenders': d.count,
                'Total Value (₹)': d.totalValue,
                'Won Tenders': d.wonCount,
                'Won Value (₹)': d.wonValue,
                'Win Rate (%)': d.count > 0 ? ((d.wonCount / d.count) * 100).toFixed(1) + '%' : '0.0%'
            }));
        } else if (activeTab === 'monthly') {
            exportData = currentData.map((d, i) => ({
                'Sr. No.': i + 1,
                'Month': d.label,
                'Tenders Created': d.count,
                'Total Portfolio Value (₹)': d.totalValue,
                'Won Tenders': d.wonCount,
                'Won Value (₹)': d.wonValue
            }));
        } else if (activeTab === 'activities') {
            exportData = currentData.map((d, i) => ({
                'Sr. No.': i + 1,
                'Tender No': d.tenderNo,
                'Tender Title': d.title,
                'Performed By': d.userName,
                'Action': d.action,
                'Timestamp': d.timestamp.toLocaleString('en-IN')
            }));
        } else {
            // General structure for lists (pipeline, win_loss, deadlines, value_rep, approvals)
            exportData = currentData.map((d, i) => ({
                'Sr. No.': i + 1,
                'Tender No': d.tenderNo,
                'Tender Title': d.title,
                'Client': d.customerId?.companyName || d.customerId?.customerName || '-',
                'Value (₹)': d.value,
                'Status': d.status,
                'Department': d.departmentId?.name || '-',
                'Owner': d.ownerId?.name || '-',
                'Deadline Date': d.deadlineDate ? new Date(d.deadlineDate).toLocaleDateString('en-IN') : '-',
                'Submission Date': d.submissionDate ? new Date(d.submissionDate).toLocaleDateString('en-IN') : '-'
            }));
        }

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, tabInfo.label.slice(0, 31)); // sheet name must be max 31 chars
        XLSX.writeFile(wb, `${tabInfo.label.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success(`Exported "${tabInfo.label}" report to Excel.`);
    };

    // Calculate dynamic Win/Loss summary KPIs
    const getWinLossSummary = () => {
        if (activeTab !== 'win_loss') return null;
        const wonList = currentData.filter(t => t.status === 'Won');
        const lostList = currentData.filter(t => t.status === 'Lost');
        const totalW = wonList.length;
        const totalL = lostList.length;
        const totalOpportunities = totalW + totalL;
        const countWinRate = totalOpportunities > 0 ? ((totalW / totalOpportunities) * 100).toFixed(1) : '0.0';
        
        const wonVal = wonList.reduce((sum, t) => sum + (t.value || 0), 0);
        const lostVal = lostList.reduce((sum, t) => sum + (t.value || 0), 0);
        const totalOpportunitiesVal = wonVal + lostVal;
        const valueWinRate = totalOpportunitiesVal > 0 ? ((wonVal / totalOpportunitiesVal) * 100).toFixed(1) : '0.0';

        return {
            totalW, totalL, countWinRate, wonVal, lostVal, valueWinRate
        };
    };

    const wlSummary = getWinLossSummary();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-md">
                        <MdBarChart size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tender Reports</h1>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Business Analytics Console</p>
                    </div>
                </div>
                {currentData.length > 0 && (
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 text-sm font-black rounded-xl shadow-sm transition-all"
                    >
                        <MdDownload size={18} />
                        Export to Excel
                    </button>
                )}
            </div>

            {/* Filter Section */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                        <MdFilterList size={20} className="text-teal-600" />
                        <span>Filter Reports</span>
                    </div>

                    {/* Client Selector */}
                    <select
                        value={customerId}
                        onChange={e => setCustomerId(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500 max-w-[200px]"
                    >
                        <option value="">All Clients</option>
                        {customers.map(c => (
                            <option key={c._id} value={c._id}>{c.companyName || c.customerName}</option>
                        ))}
                    </select>

                    {/* Start Date */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">From</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    {/* End Date */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">To</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-sm text-slate-700 font-semibold rounded-xl focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    {/* Reset Button */}
                    {(customerId || startDate || endDate) && (
                        <button
                            onClick={handleClearFilters}
                            className="text-xs font-bold text-rose-500 hover:text-rose-700 transition"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Reports Sidebar & Table Container */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Reports Navigation Sidebar */}
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm h-fit space-y-1">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Available Reports</span>
                    {REPORT_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${activeTab === tab.key ? 'bg-teal-50 text-teal-700 font-bold' : 'text-slate-600 font-semibold hover:bg-slate-50'}`}
                        >
                            <span className={activeTab === tab.key ? 'text-teal-600' : 'text-slate-400'}>{tab.icon}</span>
                            <span className="text-sm">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Reports Render area */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Active Report Description card */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                        <h2 className="text-lg font-black text-slate-900 mb-1">{REPORT_TABS.find(t => t.key === activeTab).label}</h2>
                        <p className="text-sm text-slate-500 leading-snug">{REPORT_TABS.find(t => t.key === activeTab).desc}</p>
                    </div>

                    {/* Win/Loss Analysis Summary Widget */}
                    {activeTab === 'win_loss' && wlSummary && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4">
                                <span className="block text-xxs font-bold text-emerald-500 uppercase tracking-wider mb-0.5">Won Tenders</span>
                                <h4 className="text-xl font-black text-emerald-800">{wlSummary.totalW} Opportunity <span className="text-sm font-semibold">({formatCurrency(wlSummary.wonVal)})</span></h4>
                            </div>
                            <div className="bg-rose-50 rounded-2xl border border-rose-100 p-4">
                                <span className="block text-xxs font-bold text-rose-500 uppercase tracking-wider mb-0.5">Lost Tenders</span>
                                <h4 className="text-xl font-black text-rose-800">{wlSummary.totalL} Opportunity <span className="text-sm font-semibold">({formatCurrency(wlSummary.lostVal)})</span></h4>
                            </div>
                            <div className="bg-teal-50 rounded-2xl border border-teal-100 p-4">
                                <span className="block text-xxs font-bold text-teal-500 uppercase tracking-wider mb-0.5">Win Rates (Count / Value)</span>
                                <h4 className="text-xl font-black text-teal-800">{wlSummary.countWinRate}% / {wlSummary.valueWinRate}%</h4>
                            </div>
                        </div>
                    )}

                    {/* Data Render Tables */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-3"></div>
                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider animate-pulse">Running Report...</p>
                            </div>
                        ) : currentData.length > 0 ? (
                            <div className="overflow-x-auto">
                                {activeTab === 'client_wise' ? (
                                    /* Client-wise Aggregate Report */
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                                                <th className="py-3.5 px-6">Client / Customer</th>
                                                <th className="py-3.5 px-6 text-center">Tenders Count</th>
                                                <th className="py-3.5 px-6 text-right">Total Portfolio Value</th>
                                                <th className="py-3.5 px-6 text-center">Won Tenders</th>
                                                <th className="py-3.5 px-6 text-right">Won Portfolio Value</th>
                                                <th className="py-3.5 px-6 text-right">Win Rate %</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                                            {currentData.map((d, i) => (
                                                <tr key={i} className="hover:bg-slate-50/40 transition">
                                                    <td className="py-3 px-6 text-slate-900 font-bold">{d.client}</td>
                                                    <td className="py-3 px-6 text-center">{d.count}</td>
                                                    <td className="py-3 px-6 text-right text-slate-900 font-bold">{formatCurrency(d.totalValue)}</td>
                                                    <td className="py-3 px-6 text-center text-emerald-600">{d.wonCount}</td>
                                                    <td className="py-3 px-6 text-right text-emerald-600 font-bold">{formatCurrency(d.wonValue)}</td>
                                                    <td className="py-3 px-6 text-right text-teal-600 font-bold">
                                                        {d.count > 0 ? ((d.wonCount / d.count) * 100).toFixed(1) : '0.0'}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : activeTab === 'monthly' ? (
                                    /* Monthly Summary Report */
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                                                <th className="py-3.5 px-6">Month</th>
                                                <th className="py-3.5 px-6 text-center">Tenders Count</th>
                                                <th className="py-3.5 px-6 text-right">Total Portfolio Value</th>
                                                <th className="py-3.5 px-6 text-center">Won Tenders</th>
                                                <th className="py-3.5 px-6 text-right">Won Portfolio Value</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                                            {currentData.map((d, i) => (
                                                <tr key={i} className="hover:bg-slate-50/40 transition">
                                                    <td className="py-3 px-6 text-slate-900 font-bold">{d.label}</td>
                                                    <td className="py-3 px-6 text-center">{d.count}</td>
                                                    <td className="py-3 px-6 text-right text-slate-900 font-bold">{formatCurrency(d.totalValue)}</td>
                                                    <td className="py-3 px-6 text-center text-emerald-600">{d.wonCount}</td>
                                                    <td className="py-3 px-6 text-right text-emerald-600 font-bold">{formatCurrency(d.wonValue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : activeTab === 'activities' ? (
                                    /* Activities Logs Report */
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                                                <th className="py-3.5 px-6">Tender No</th>
                                                <th className="py-3.5 px-6">Tender Title</th>
                                                <th className="py-3.5 px-6">Performed By</th>
                                                <th className="py-3.5 px-6">Action</th>
                                                <th className="py-3.5 px-6">Timestamp</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                                            {currentData.map((d, i) => (
                                                <tr key={i} className="hover:bg-slate-50/40 transition">
                                                    <td className="py-3 px-6 text-teal-600 font-bold">{d.tenderNo}</td>
                                                    <td className="py-3 px-6 max-w-xs truncate">{d.title}</td>
                                                    <td className="py-3 px-6 text-slate-900 font-bold">{d.userName}</td>
                                                    <td className="py-3 px-6 text-slate-700 leading-snug">{d.action}</td>
                                                    <td className="py-3 px-6 text-xs text-slate-400">{d.timestamp.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    /* Standard Tenders List (Pipeline, Win/Loss, Deadlines, Value, Approvals) */
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                                                <th className="py-3.5 px-6">Tender No</th>
                                                <th className="py-3.5 px-6">Title</th>
                                                <th className="py-3.5 px-6">Client</th>
                                                <th className="py-3.5 px-6">Status</th>
                                                <th className="py-3.5 px-6 text-right">Value</th>
                                                <th className="py-3.5 px-6">Deadline Date</th>
                                                {activeTab === 'deadlines' && <th className="py-3.5 px-6 text-center">Alert</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-600">
                                            {currentData.map((t) => {
                                                const diffTime = new Date(t.deadlineDate) - now;
                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                const isClose = diffDays >= 0 && diffDays <= 7;
                                                const isOverdue = diffDays < 0;

                                                return (
                                                    <tr key={t._id} className="hover:bg-slate-50/40 transition">
                                                        <td className="py-3 px-6 text-teal-600 font-bold">{t.tenderNo}</td>
                                                        <td className="py-3 px-6 text-slate-900 font-bold max-w-xs truncate">{t.title}</td>
                                                        <td className="py-3 px-6">{t.customerId?.companyName || t.customerId?.customerName || '-'}</td>
                                                        <td className="py-3 px-6">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${STATUS_BADGES[t.status]}`}>
                                                                {t.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-6 text-right text-slate-900 font-bold">{formatCurrency(t.value)}</td>
                                                        <td className="py-3 px-6">{formatDate(t.deadlineDate)}</td>
                                                        {activeTab === 'deadlines' && (
                                                            <td className="py-3 px-6 text-center">
                                                                {isOverdue ? (
                                                                    <span className="inline-flex px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black uppercase">Overdue</span>
                                                                ) : isClose ? (
                                                                    <span className="inline-flex px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black uppercase">Within 7d</span>
                                                                ) : (
                                                                    <span className="text-slate-400 text-xs">-</span>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        ) : (
                            <div className="py-20 text-center text-slate-400 font-bold text-sm">No records found for this report with active filters.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TenderReports;
