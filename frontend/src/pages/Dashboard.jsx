import React, { useState, useEffect } from 'react';
import {
    MdTrendingUp,
    MdDescription,
    MdPendingActions,
    MdAttachMoney,
    MdAdd,
    MdVisibility,
    MdPictureAsPdf,
    MdChevronRight,
    MdPeople,
    MdSchedule,
    MdTrendingDown,
    MdAutoGraph,
    MdInventory2,
    MdStorefront,
    MdReceipt,
    MdHelpOutline,
    MdSecurity
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import { quotationService } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const StatCard = ({ title, value, icon, trend, color, subValue, isTrendUp, to }) => (
    <Link to={to} className="group p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-primary-600/20 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 relative overflow-hidden block">
        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
        
        <div className="flex justify-between items-start mb-6 relative">
            <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-white shadow-lg shadow-current/20`}>
                {icon}
            </div>
            {trend && (
                <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-black ${isTrendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {isTrendUp ? <MdTrendingUp /> : <MdTrendingDown />}
                    {trend}
                </span>
            )}
        </div>

        <div className="relative">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-3">{title}</h3>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">{value}</p>
            <p className="text-xs font-bold text-slate-400 mt-3">{subValue}</p>
        </div>
    </Link>
);

const Dashboard = () => {
    const { user, isAdmin, isSuperAdmin } = useAuth();
    const isManagerOrAdmin = isAdmin || isSuperAdmin;

    const [stats, setStats] = useState({
        totalQuotations: 0,
        pendingDrafts: 0,
        totalValue: 0,
        customerCount: 0,
        productCount: 0,
        vendorCount: 0
    });
    const [recentQuotations, setRecentQuotations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isManagerOrAdmin) {
            setLoading(false);
            return;
        }

        const fetchDashboardData = async () => {
            try {
                const response = await quotationService.getReports();
                const { summary, recentQuotations } = response.data;

                setStats({
                    totalQuotations: summary?.totalQuotations || 0,
                    pendingDrafts: summary?.statusBreakdown?.draft || 0,
                    totalValue: summary?.totalValue || 0,
                    customerCount: summary?.customerCount || 0,
                    productCount: summary?.productCount || 0,
                    vendorCount: summary?.vendorCount || 0
                });

                setRecentQuotations(recentQuotations || []);
            } catch (err) {
                console.error("Error fetching dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();

        const handleRealtimeUpdate = (e) => {
            fetchDashboardData();
        };

        window.addEventListener('onCrmSocketUpdate', handleRealtimeUpdate);
        return () => window.removeEventListener('onCrmSocketUpdate', handleRealtimeUpdate);
    }, [isManagerOrAdmin]);

    // Regular Employee View
    if (!isManagerOrAdmin) {
        const employeeCards = [
            {
                title: "My Payslips",
                value: "Salary Slips",
                subValue: "Download & print monthly payslips",
                icon: <MdReceipt size={28} />,
                color: "bg-gradient-to-br from-teal-500 to-emerald-600",
                to: "/payroll/payslips"
            },
            {
                title: "Support Tickets",
                value: "CSM Portal",
                subValue: "Track and resolve service tickets",
                icon: <MdPendingActions size={28} />,
                color: "bg-gradient-to-br from-blue-500 to-indigo-600",
                to: "/csm/tickets"
            },
            {
                title: "Knowledge Base",
                value: "Help Articles",
                subValue: "Browse troubleshooting guides",
                icon: <MdHelpOutline size={28} />,
                color: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
                to: "/csm/kb"
            },
            {
                title: "Account Security",
                value: "My Settings",
                subValue: "Update password and details",
                icon: <MdSecurity size={28} />,
                color: "bg-gradient-to-br from-slate-700 to-slate-900",
                to: "/settings"
            }
        ];

        return (
            <div className="space-y-8 animate-fade-in-up">
                <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-primary-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="relative z-10 max-w-2xl">
                        <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-black uppercase tracking-wider">
                            Employee Self-Service Portal
                        </span>
                        <h1 className="text-3xl font-black tracking-tight mt-3">
                            Welcome Back, {user?.name || user?.email}!
                        </h1>
                        <p className="text-teal-100 font-medium text-sm mt-2 leading-relaxed">
                            Access your personal salary slips, track support requests, or manage your account credentials.
                        </p>
                        <div className="flex flex-wrap gap-3 mt-6">
                            <Link
                                to="/payroll/payslips"
                                className="px-5 py-3 bg-white text-teal-800 hover:bg-teal-50 rounded-2xl text-sm font-black transition-all shadow-lg shadow-black/10 flex items-center gap-2"
                            >
                                <MdReceipt size={18} /> View My Payslips
                            </Link>
                            <Link
                                to="/csm/tickets"
                                className="px-5 py-3 bg-teal-700/60 hover:bg-teal-700 text-white rounded-2xl text-sm font-bold transition-all flex items-center gap-2"
                            >
                                <MdPendingActions size={18} /> Support Tickets
                            </Link>
                        </div>
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-4">Quick Access</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {employeeCards.map((card, i) => (
                            <StatCard
                                key={i}
                                title={card.title}
                                value={card.value}
                                icon={card.icon}
                                color={card.color}
                                subValue={card.subValue}
                                to={card.to}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Admin / Manager View
    const statItems = [
        {
            title: "Total Quotations",
            value: stats.totalQuotations,
            desc: "All time generated",
            icon: <MdDescription size={26} />,
            color: "bg-gradient-to-br from-teal-500 to-emerald-600",
            subValue: "All time generated",
            to: "/quotations"
        },
        {
            title: "Draft Quotes",
            value: stats.pendingDrafts,
            desc: "Awaiting finalization",
            icon: <MdSchedule size={26} />,
            color: "bg-gradient-to-br from-amber-400 to-orange-500",
            subValue: "Awaiting finalization",
            to: "/quotations?status=draft"
        },
        {
            title: "Business Pipeline",
            value: formatCurrency(stats.totalValue, 0),
            desc: "Total quoted value",
            icon: <MdAttachMoney size={26} />,
            color: "bg-gradient-to-br from-primary-600 to-accent",
            subValue: "Total quoted value",
            trend: "+100%",
            isTrendUp: true,
            to: "/reports"
        },
        {
            title: "Registered Customers",
            value: stats.customerCount,
            desc: "Direct & Retail",
            icon: <MdPeople size={26} />,
            color: "bg-gradient-to-br from-blue-500 to-indigo-600",
            subValue: "Direct & Retail",
            to: "/customers"
        },
        {
            title: "Total Products",
            value: stats.productCount,
            desc: "Active Inventory",
            icon: <MdInventory2 size={26} />,
            color: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
            subValue: "Active Inventory",
            to: "/products"
        },
        {
            title: "Total Vendors",
            value: stats.vendorCount,
            desc: "Onboarded Suppliers",
            icon: <MdStorefront size={26} />,
            color: "bg-gradient-to-br from-rose-500 to-pink-600",
            subValue: "Onboarded Suppliers",
            to: "/vendors"
        }
    ];

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-outfit uppercase">Dashboard Overview</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-semibold mt-1">Real-time performance metrics</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to="/simulations"
                        className="px-5 py-2.5 bg-slate-900 dark:bg-slate-800 rounded-2xl text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-lg shadow-slate-900/10 flex items-center gap-2"
                    >
                        <MdAutoGraph size={18} /> Pricing Simulator
                    </Link>
                    <Link
                        to="/quotations/new"
                        className="px-5 py-2.5 bg-primary-600 rounded-2xl text-sm font-bold text-white hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 flex items-center gap-2"
                    >
                        <MdAdd size={20} /> New Quotation
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6 gap-6">
                {statItems.map((stat, i) => (
                    <StatCard
                        key={i}
                        title={stat.title}
                        value={stat.value}
                        icon={stat.icon}
                        trend={stat.trend}
                        color={stat.color}
                        subValue={stat.subValue}
                        isTrendUp={stat.isTrendUp}
                        to={stat.to}
                    />
                ))}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Recent Quotations</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Last 5 activities</p>
                    </div>
                    <Link to="/quotations" className="px-4 py-2 text-sm font-bold text-primary-600 dark:text-primary-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all border border-slate-100 dark:border-slate-700 shadow-sm">
                        View All
                    </Link>
                </div>
                
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-primary-600 rounded-full animate-spin"></div>
                            <p className="mt-4 text-slate-400 font-bold uppercase text-xs tracking-widest">Loading Records...</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white dark:bg-slate-900">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref Number</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {recentQuotations.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-12 text-center text-slate-400 font-bold text-sm">
                                            No recent quotations found.
                                        </td>
                                    </tr>
                                ) : (
                                    recentQuotations.map((q) => (
                                        <tr key={q._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                                                {q.quotationNumber}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {q.customerName || q.customer?.name}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-teal-600">
                                                {formatCurrency(q.grandTotal)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold uppercase tracking-wider">
                                                    {q.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link to={`/quotations/${q._id}`} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl inline-block text-slate-600 dark:text-slate-400 transition-colors">
                                                    <MdVisibility size={18} />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
