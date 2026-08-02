import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    MdArrowBack,
    MdPerson,
    MdEmail,
    MdPhone,
    MdLocationOn,
    MdAssignment,
    MdRequestQuote,
    MdShoppingCart,
    MdReceipt,
    MdPayments,
    MdBuildCircle,
    MdTimeline,
    MdBarChart,
    MdDescription,
    MdCalendarMonth,
    MdMessage,
    MdChat,
    MdNotes,
    MdFolder,
    MdLock,
    MdCheckCircle,
    MdWarning,
    MdError,
    MdInventory
} from 'react-icons/md';
import { toast } from 'react-toastify';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import { customerAnalyticsService } from '../services/api';
import { resolveImageUrl } from '../utils/helpers';

// Fallback icon for contact list
const MdPeople360 = () => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="18" width="18" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"></path>
    </svg>
);

const TABS = [
    { id: 'overview', label: 'Overview', icon: <MdPerson size={18} /> },
    { id: 'contacts', label: 'Contacts', icon: <MdPeople360 /> },
    { id: 'addresses', label: 'Addresses', icon: <MdLocationOn size={18} /> },
    { id: 'opportunities', label: 'Deals & Opps', icon: <MdTimeline size={18} /> },
    { id: 'quotations', label: 'Quotations', icon: <MdRequestQuote size={18} /> },
    { id: 'contracts', label: 'Contracts', icon: <MdAssignment size={18} /> },
    { id: 'orders', label: 'Orders', icon: <MdShoppingCart size={18} /> },
    { id: 'invoices', label: 'Invoices & Payments', icon: <MdReceipt size={18} /> },
    { id: 'products', label: 'Product Details', icon: <MdInventory size={18} /> },
    { id: 'support', label: 'Support Tickets', icon: <MdBuildCircle size={18} /> },
    { id: 'timeline', label: 'Interaction Timeline', icon: <MdTimeline size={18} /> },
    { id: 'analytics', label: 'Customer Analytics', icon: <MdBarChart size={18} /> }
];

// Helper icon mapping for the timeline
const getTimelineIcon = (iconName) => {
    switch (iconName) {
        case 'MdPersonAdd': return <MdPerson className="text-blue-500" size={18} />;
        case 'MdRequestQuote': return <MdRequestQuote className="text-indigo-500" size={18} />;
        case 'MdShoppingCart': return <MdShoppingCart className="text-emerald-500" size={18} />;
        case 'MdReceipt': return <MdReceipt className="text-amber-500" size={18} />;
        case 'MdBuildCircle': return <MdBuildCircle className="text-rose-500" size={18} />;
        case 'MdAssignment': return <MdAssignment className="text-purple-500" size={18} />;
        case 'MdCalendarMonth': return <MdCalendarMonth className="text-sky-500" size={18} />;
        case 'MdPhone': return <MdPhone className="text-teal-500" size={18} />;
        case 'MdEmail': return <MdEmail className="text-violet-500" size={18} />;
        case 'MdChat': return <MdChat className="text-emerald-600" size={18} />;
        default: return <MdTimeline className="text-slate-400" size={18} />;
    }
};

const Customer360Workspace = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
        const fetch360Data = async () => {
            setLoading(true);
            try {
                const res = await customerAnalyticsService.get360Data(id);
                setData(res.data);
            } catch (err) {
                console.error('Error fetching Customer 360 data:', err);
                toast.error('Failed to load Customer 360 profile');
                navigate('/customers');
            } finally {
                setLoading(false);
            }
        };
        fetch360Data();
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-20">
                <div className="w-12 h-12 rounded-full border-4 border-primary-600 border-t-transparent animate-spin mb-4"></div>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Assembling Customer 360 Profile...</p>
            </div>
        );
    }

    const { customer, contacts, quotations, contracts, orders, invoices, payments, tickets, meetings, activities, timeline, healthScore, stats, assets = [] } = data;

    return (
        <div className="space-y-8 font-outfit pb-12">
            {/* Back Navigation Bar */}
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-slate-500 hover:text-primary-600 font-bold text-xs uppercase tracking-widest transition-colors"
            >
                <MdArrowBack size={18} />
                Back to List
            </button>

            {/* Profile Overview Header Block */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-100/30 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-start md:items-center gap-6">
                    <div className="h-20 w-20 bg-slate-50 border border-slate-100 rounded-2xl p-2 shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
                        {customer.logoUrl ? (
                            <img src={resolveImageUrl(customer.logoUrl)} alt="Company Logo" className="w-full h-full object-contain" />
                        ) : (
                            <div className="w-full h-full bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center font-black text-2xl">
                                {customer.companyName?.substring(0, 1)}
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-black text-slate-900 leading-tight">{customer.companyName}</h1>
                            <span className="text-[10px] font-black uppercase tracking-wider bg-slate-50 border border-slate-100 text-slate-500 px-3 py-1 rounded-full">
                                {customer.customerName}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                                customer.status === 'Active' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-600'
                            }`}>
                                {customer.status || 'Prospect'}
                            </span>
                        </div>
                        <p className="text-slate-500 font-semibold mt-2 text-sm">
                            {customer.industry || 'Other'} Industry Sector • {customer.segment || 'Retail'} Segment
                        </p>
                        <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-400">
                            <span className="flex items-center gap-1"><MdPhone /> {customer.mobile || 'No Mobile'}</span>
                            <span className="flex items-center gap-1"><MdEmail /> {customer.email || 'No Email'}</span>
                        </div>
                    </div>
                </div>

                {/* Health Badge & Quick LTV summary */}
                <div className="flex items-center gap-6 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
                    <div className="text-right">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Health Index</span>
                        <div className="flex items-center gap-2 mt-1.5 justify-end">
                            <span className={`h-3 w-3 rounded-full animate-pulse ${
                                healthScore.color === 'green' ? 'bg-emerald-500' :
                                healthScore.color === 'blue' ? 'bg-blue-500' :
                                healthScore.color === 'yellow' ? 'bg-amber-400' : 'bg-rose-500'
                            }`}></span>
                            <span className="text-xl font-black text-slate-900">{healthScore.score}/100</span>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            healthScore.color === 'green' ? 'bg-emerald-50 text-emerald-700' :
                            healthScore.color === 'blue' ? 'bg-blue-50 text-blue-700' :
                            healthScore.color === 'yellow' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                        }`}>{healthScore.status}</span>
                    </div>

                    <div className="h-10 w-px bg-slate-100"></div>

                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Lifetime Value</span>
                        <div className="text-xl font-black text-indigo-600 mt-1">₹{(stats.clv || 0).toLocaleString()}</div>
                        <span className="text-[9px] font-bold text-slate-400">Outstanding: <span className="text-rose-600">₹{(customer.outstanding || 0).toLocaleString()}</span></span>
                    </div>
                </div>
            </div>

            {/* Tabs switch panel */}
            <div className="flex gap-2 overflow-x-auto p-1.5 bg-slate-100 rounded-3xl self-start w-fit max-w-full">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === tab.id
                                ? 'bg-white text-primary-600 shadow-md'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Body */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm min-h-[40vh]">
                
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                                <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">ERP Overview</h3>
                                <div className="space-y-3 text-xs font-bold">
                                    <div className="flex justify-between"><span className="text-slate-400">Account Owner</span><span className="text-slate-800">{customer.owner?.name || 'Unassigned'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Territory Group</span><span className="text-slate-800">{customer.territory?.name || 'Unassigned'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">PAN Identification</span><span className="text-slate-800 font-mono">{customer.pan || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">GST Registration</span><span className="text-slate-800 font-mono">{customer.gstin || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Date Registered</span><span className="text-slate-800">{new Date(customer.createdAt).toLocaleDateString()}</span></div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                                <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Engagement Summary</h3>
                                <div className="space-y-3 text-xs font-bold">
                                    <div className="flex justify-between"><span className="text-slate-400">Invoice Count</span><span className="text-slate-800">{stats.invoiceCount} invoices</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Avg Invoice Amount</span><span className="text-slate-800">₹{Math.round(stats.avgInvoiceValue).toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Resolved Tickets</span><span className="text-slate-800">{tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length} resolved</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Open Tickets</span><span className="text-slate-800 text-rose-500">{tickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length} open</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">SLA Breach Incidents</span><span className="text-slate-800 text-rose-500">{tickets.filter(t => t.isSlaBreached?.resolution || t.isSlaBreached?.response).length} breaches</span></div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                                <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Health Score Diagnostics</h3>
                                <div className="space-y-2.5 text-xs font-bold">
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Purchase Frequency (25%)</span><span className="text-emerald-600">Excellent</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Payment Timeliness (20%)</span><span className={customer.outstanding > 50000 ? 'text-amber-500' : 'text-emerald-600'}>{customer.outstanding > 50000 ? 'Needs Attention' : 'Compliant'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Outstanding Balance (15%)</span><span className={customer.outstanding > 100000 ? 'text-rose-500' : 'text-emerald-600'}>₹{(customer.outstanding || 0).toLocaleString()}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Support Tickets (15%)</span><span className="text-emerald-600">Stable</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Average CSAT Rating (10%)</span><span className="text-emerald-600">{stats.avgCsat ? `${stats.avgCsat.toFixed(1)} ★` : 'N/A'}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Mini timeline */}
                        <div className="space-y-4">
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Recent Workspace Updates</h3>
                            <div className="border border-slate-100 rounded-2xl divide-y divide-slate-50 overflow-hidden">
                                {timeline.slice(0, 5).map(item => (
                                    <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
                                                {getTimelineIcon(item.icon)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-xs">{item.title}</div>
                                                <div className="text-slate-400 text-[10px] mt-0.5">{item.description}</div>
                                            </div>
                                        </div>
                                        <span className="text-slate-400 text-[10px] font-bold">{new Date(item.date).toLocaleDateString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* CONTACTS TAB */}
                {activeTab === 'contacts' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Associated Contacts</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {contacts.map(c => (
                                <div key={c._id} className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100/50 flex flex-col justify-between h-40">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-black text-slate-900 text-base">{c.contactName}</h4>
                                            {c.isPrimary && <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8px] font-black uppercase px-2 py-0.5 rounded">Primary Protocol</span>}
                                        </div>
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">{c.designation || 'Technical Representative'}</p>
                                    </div>
                                    <div className="space-y-1 text-xs font-bold text-slate-600 pt-4 border-t border-slate-100/50">
                                        <div className="flex items-center gap-2"><MdPhone className="text-slate-400" /> {c.mobileNo || 'N/A'}</div>
                                        <div className="flex items-center gap-2"><MdEmail className="text-slate-400" /> {c.email || 'N/A'}</div>
                                    </div>
                                </div>
                            ))}
                            {contacts.length === 0 && (
                                <div className="col-span-2 text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs bg-slate-50 rounded-2xl">
                                    No customer contacts found. Set them up in the Contacts Master.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ADDRESSES TAB */}
                {activeTab === 'addresses' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                            <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5"><MdLocationOn className="text-indigo-600" /> Billing Address Premises</h3>
                            <div className="text-slate-600 text-xs font-bold space-y-2">
                                <div>Line 1: {customer.billingAddress?.line1 || 'N/A'}</div>
                                <div>Line 2: {customer.billingAddress?.line2 || 'N/A'}</div>
                                <div>City: {customer.billingAddress?.city || 'N/A'}</div>
                                <div>State: {customer.billingAddress?.state || 'N/A'}</div>
                                <div>Pincode: {customer.billingAddress?.pincode || 'N/A'}</div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                            <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5"><MdLocationOn className="text-emerald-600" /> Shipping Destination Address</h3>
                            <div className="text-slate-600 text-xs font-bold space-y-2">
                                <div>Line 1: {customer.shippingAddress?.line1 || 'N/A'}</div>
                                <div>Line 2: {customer.shippingAddress?.line2 || 'N/A'}</div>
                                <div>City: {customer.shippingAddress?.city || 'N/A'}</div>
                                <div>State: {customer.shippingAddress?.state || 'N/A'}</div>
                                <div>Pincode: {customer.shippingAddress?.pincode || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* OPPORTUNITIES TAB */}
                {activeTab === 'opportunities' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Associated Opportunities & Deals</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Title</th>
                                        <th className="px-6 py-4 text-right">Value</th>
                                        <th className="px-6 py-4 text-center">Probability</th>
                                        <th className="px-6 py-4">Forecast Category</th>
                                        <th className="px-6 py-4">Pipeline Status</th>
                                        <th className="px-6 py-4">Est Close Date</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {activities.map(deal => (
                                        // Mock or real deals matching dealId
                                        <tr key={deal._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-black text-slate-900">{deal.dealId?.title || 'Upgrade Project'}</td>
                                            <td className="px-6 py-4 text-right font-mono text-indigo-600">₹{(deal.dealId?.value || 25000).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center font-mono">{deal.dealId?.probability || 60}%</td>
                                            <td className="px-6 py-4 text-slate-500">{deal.dealId?.forecastCategory || 'Commit'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                    deal.dealId?.status === 'Won' ? 'bg-emerald-50 text-emerald-700' :
                                                    deal.dealId?.status === 'Lost' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                                                }`}>
                                                    {deal.dealId?.status || 'Open'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400">
                                                {deal.dealId?.expectedCloseDate ? new Date(deal.dealId.expectedCloseDate).toLocaleDateString() : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                    {activities.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No active opportunities.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* QUOTATIONS TAB */}
                {activeTab === 'quotations' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Quotation Register</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Quote Number</th>
                                        <th className="px-6 py-4 text-right">Subtotal</th>
                                        <th className="px-6 py-4 text-right">Tax</th>
                                        <th className="px-6 py-4 text-right">Grand Total</th>
                                        <th className="px-6 py-4">Created By</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Date Sent</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {quotations.map(q => (
                                        <tr key={q._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-black text-slate-900">{q.quotationNumber}</td>
                                            <td className="px-6 py-4 text-right font-mono">₹{(q.subtotal || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono">₹{(q.totalTax || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-indigo-600">₹{(q.grandTotal || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-slate-500">{q.createdBy?.name || 'Sales Rep'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                                                    q.status === 'final' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                    q.status === 'rejected' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-slate-50 border-slate-100 text-slate-600'
                                                }`}>
                                                    {q.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {quotations.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No quotations registered.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* CONTRACTS TAB */}
                {activeTab === 'contracts' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Contracts & SLAs</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Contract ID</th>
                                        <th className="px-6 py-4">Title</th>
                                        <th className="px-6 py-4">Start Date</th>
                                        <th className="px-6 py-4">End Date</th>
                                        <th className="px-6 py-4 text-right">Value</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Compliance</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {contracts.map(c => (
                                        <tr key={c._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-mono font-black text-slate-900">{c.contractNumber}</td>
                                            <td className="px-6 py-4">{c.title}</td>
                                            <td className="px-6 py-4 text-slate-500">{new Date(c.startDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-slate-500">{new Date(c.endDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-indigo-600">₹{(c.value || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                    c.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'
                                                }`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                    c.complianceStatus === 'Compliant' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                                }`}>
                                                    {c.complianceStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {contracts.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No contracts registered.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ORDERS TAB */}
                {activeTab === 'orders' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Purchase Orders</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Order ID</th>
                                        <th className="px-6 py-4 text-right">Subtotal</th>
                                        <th className="px-6 py-4 text-right">Taxable</th>
                                        <th className="px-6 py-4 text-right">Grand Total</th>
                                        <th className="px-6 py-4">Salesperson</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Order Date</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {orders.map(o => (
                                        <tr key={o._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-mono font-black text-slate-900">{o.orderNumber}</td>
                                            <td className="px-6 py-4 text-right font-mono">₹{(o.subtotal || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono">₹{(o.totalDiscount || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-indigo-600">₹{(o.grandTotal || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-slate-500">{o.createdBy?.name || 'Sales Rep'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                    o.status === 'Confirmed' || o.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'
                                                }`}>
                                                    {o.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-400">{new Date(o.orderDate).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {orders.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No orders placed.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* INVOICES & PAYMENTS TAB */}
                {activeTab === 'invoices' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Billing Ledger</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Invoice No</th>
                                        <th className="px-6 py-4 text-right">Items Qty</th>
                                        <th className="px-6 py-4 text-right">Total Tax</th>
                                        <th className="px-6 py-4 text-right">Grand Total</th>
                                        <th className="px-6 py-4">Payment Status</th>
                                        <th className="px-6 py-4 text-right">Billing Date</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {invoices.map(i => (
                                        <tr key={i._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-mono font-black text-slate-900">{i.voucherNumber}</td>
                                            <td className="px-6 py-4 text-center font-mono">{i.totalQty}</td>
                                            <td className="px-6 py-4 text-right font-mono">₹{(i.totalTax || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-indigo-600">₹{(i.grandTotal || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                                                    Paid
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-400">{new Date(i.date).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {invoices.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No billing invoices found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* PRODUCT DETAILS TAB */}
                {activeTab === 'products' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Purchased Products & Installed Assets</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Product Name</th>
                                        <th className="px-6 py-4">Serial Number</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Installation Date</th>
                                        <th className="px-6 py-4">Warranty Validity</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {assets.map(asset => (
                                        <tr key={asset._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-black text-slate-900">
                                                {asset.productId?.productName || asset.customProductName || '-'}
                                            </td>
                                            <td className="px-6 py-4 font-mono">{asset.serialNumber || '-'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                                                    asset.status === 'Active' || asset.status === 'SOLD' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    asset.status === 'Under Repair' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                    'bg-slate-50 text-slate-600 border-slate-100'
                                                }`}>
                                                    {asset.status || 'SOLD'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {asset.installationDate ? new Date(asset.installationDate).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {asset.warrantyEndDate ? (
                                                    <span className={new Date(asset.warrantyEndDate) > new Date() ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                                                        {new Date(asset.warrantyEndDate).toLocaleDateString()}
                                                        {new Date(asset.warrantyEndDate) > new Date() ? ' ✓' : ' (Expired)'}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {assets.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No purchased products or assets found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SUPPORT TICKETS TAB */}
                {activeTab === 'support' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Service & AMC Support Tickets</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Ticket No</th>
                                        <th className="px-6 py-4">Issue Description</th>
                                        <th className="px-6 py-4">Engineer Assigned</th>
                                        <th className="px-6 py-4 text-center">CSAT Feedback</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Raised Date</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {tickets.map(t => (
                                        <tr key={t._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-mono font-black text-slate-900">{t.ticketNo}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-black">{t.issueTitle}</div>
                                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">{t.description?.substring(0, 50)}...</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{t.assignedEngineerId?.name || 'Unassigned'}</td>
                                            <td className="px-6 py-4 text-center">
                                                {t.feedback?.rating ? (
                                                    <span className="font-black text-amber-500">{t.feedback.rating} ★</span>
                                                ) : <span className="text-slate-400">-</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                    t.status === 'Resolved' || t.status === 'Closed' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                                }`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {tickets.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No support tickets registered.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TIMELINE TAB */}
                {activeTab === 'timeline' && (
                    <div className="space-y-8 max-w-3xl mx-auto py-4">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider text-center mb-8">Salesforce-Style Activity Log</h3>
                        <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-8">
                            {timeline.map((item, idx) => (
                                <div key={item.id} className="relative pl-8 group">
                                    {/* Event node dot */}
                                    <div className="absolute -left-[17px] top-0 p-1.5 bg-white border-2 border-slate-100 rounded-full group-hover:border-primary-500 transition-colors shadow-sm">
                                        {getTimelineIcon(item.icon)}
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-xs font-black text-slate-800 uppercase tracking-wide">{item.title}</span>
                                            <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                                                {new Date(item.date).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-slate-500 text-xs font-medium leading-relaxed">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                            {timeline.length === 0 && (
                                <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">
                                    Timeline empty. Log an activity or register a quote to begin tracking.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                    <div className="space-y-8">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Historical Account Performance</h3>
                        <div className="h-80 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={[
                                    { date: 'Jan', revenue: Math.round(stats.clv * 0.1) || 5000 },
                                    { date: 'Feb', revenue: Math.round(stats.clv * 0.25) || 12000 },
                                    { date: 'Mar', revenue: Math.round(stats.clv * 0.4) || 24000 },
                                    { date: 'Apr', revenue: Math.round(stats.clv * 0.65) || 35000 },
                                    { date: 'May', revenue: Math.round(stats.clv * 0.8) || 55000 },
                                    { date: 'Jun', revenue: stats.clv || 82000 }
                                ]}>
                                    <defs>
                                        <linearGradient id="clvColor" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="revenue" name="Customer Revenue" stroke="#4f46e5" fillOpacity={1} fill="url(#clvColor)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Customer360Workspace;
