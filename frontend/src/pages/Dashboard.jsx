import React, { useState, useEffect } from 'react';
import {
    MdTrendingUp,
    MdDescription,
    MdPendingActions,
    MdAttachMoney,
    MdAdd,
    MdVisibility,
    MdPictureAsPdf
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import { quotationService, customerService, productService } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { PDFDownloadLink } from '@react-pdf/renderer';
import QuotationPDF from '../components/QuotationPDF';

const StatCard = ({ title, value, icon, trend, color, subValue }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
                {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
                {trend && (
                    <p className={`text-xs mt-2 flex items-center ${trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                        <MdTrendingUp className="mr-1" /> {trend}
                    </p>
                )}
            </div>
            <div className={`p-3 rounded-xl ${color}`}>
                {icon}
            </div>
        </div>
    </div>
);

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalQuotations: 0,
        pendingDrafts: 0,
        totalValue: 0,
        customerCount: 0
    });
    const [recentQuotations, setRecentQuotations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [qtnRes, custRes] = await Promise.all([
                    quotationService.getAll(),
                    customerService.getAll()
                ]);

                const qtns = qtnRes.data;
                const totalValue = qtns.reduce((sum, q) => sum + (q.grandTotal || 0), 0);
                const drafts = qtns.filter(q => q.status === 'draft').length;

                setStats({
                    totalQuotations: qtns.length,
                    pendingDrafts: drafts,
                    totalValue: totalValue,
                    customerCount: custRes.data.length
                });

                setRecentQuotations(qtns.slice(0, 5));
            } catch (err) {
                console.error("Error fetching dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-slate-500">Welcome to Jaguar ERP Quotation Management.</p>
                </div>
                <Link
                    to="/quotations/create"
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20 uppercase text-xs"
                >
                    <MdAdd size={20} />
                    <span>New Quotation</span>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Quotations"
                    value={stats.totalQuotations}
                    icon={<MdDescription size={24} className="text-blue-600" />}
                    color="bg-blue-50"
                    subValue="All time generated"
                />
                <StatCard
                    title="Draft Quotes"
                    value={stats.pendingDrafts}
                    icon={<MdPendingActions size={24} className="text-amber-600" />}
                    color="bg-amber-50"
                    subValue="Awaiting finalization"
                />
                <StatCard
                    title="Business Pipeline"
                    value={formatCurrency(stats.totalValue)}
                    icon={<MdAttachMoney size={24} className="text-emerald-600" />}
                    color="bg-emerald-50"
                    subValue="Total quoted value"
                    trend="+100%"
                />
                <StatCard
                    title="Registered Customers"
                    value={stats.customerCount}
                    icon={<MdDescription size={24} className="text-indigo-600" />}
                    color="bg-indigo-50"
                    subValue="Direct & Retail"
                />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900">Recent Quotations</h2>
                    <Link to="/quotations" className="text-primary-600 hover:text-primary-700 text-sm font-semibold">View All</Link>
                </div>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-10 text-center text-slate-400">Loading data...</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black border-b border-slate-100 tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Ref Number</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Total Amount</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {recentQuotations.map((q) => (
                                    <tr key={q._id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-slate-900 uppercase text-xs">{q.quotationNo}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-slate-700">{q.customerId?.companyName}</div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{q.customerId?.customerName}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-900 font-black">{formatCurrency(q.grandTotal)}</td>
                                        <td className="px-6 py-4 text-slate-500 text-xs">{formatDate(q.quotationDate)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${q.status === 'final' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                }`}>
                                                {q.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <PDFDownloadLink document={<QuotationPDF quotation={q} />} fileName={`${q.quotationNo}.pdf`}>
                                                    <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Download PDF">
                                                        <MdPictureAsPdf size={18} />
                                                    </button>
                                                </PDFDownloadLink>
                                                <Link to={`/quotations?view=${q._id}`} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all">
                                                    <MdVisibility size={18} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
