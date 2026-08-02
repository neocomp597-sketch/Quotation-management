import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    MdArrowBack,
    MdContactPhone,
    MdEmail,
    MdPhone,
    MdBusiness,
    MdWork,
    MdCalendarMonth,
    MdBuildCircle,
    MdTimeline,
    MdMessage,
    MdBadge
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { contactService } from '../services/api';

const TABS = [
    { id: 'overview', label: 'Overview', icon: <MdContactPhone size={18} /> },
    { id: 'meetings', label: 'Meetings', icon: <MdCalendarMonth size={18} /> },
    { id: 'tickets', label: 'Support Tickets', icon: <MdBuildCircle size={18} /> },
    { id: 'timeline', label: 'Interaction Timeline', icon: <MdTimeline size={18} /> }
];

const Contact360Workspace = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
        const fetchContact360 = async () => {
            setLoading(true);
            try {
                const res = await contactService.get360Data(id);
                setData(res.data);
            } catch (err) {
                console.error('Error fetching Contact 360 data:', err);
                toast.error('Failed to load Contact profile');
                navigate('/contacts');
            } finally {
                setLoading(false);
            }
        };
        fetchContact360();
    }, [id, navigate]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-20">
                <div className="w-12 h-12 rounded-full border-4 border-primary-600 border-t-transparent animate-spin mb-4"></div>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Assembling Contact 360 Profile...</p>
            </div>
        );
    }

    if (!data) return null;

    const { contact, customer, tickets = [], meetings = [], timeline = [], stats = {} } = data;

    return (
        <div className="space-y-8 font-outfit pb-12">
            {/* Back Button */}
            <button
                onClick={() => navigate('/contacts')}
                className="flex items-center gap-2 text-slate-500 hover:text-primary-600 font-bold text-xs uppercase tracking-widest transition-colors"
            >
                <MdArrowBack size={18} />
                Back to Contacts List
            </button>

            {/* Profile Overview Header Block */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-100/30 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-start md:items-center gap-6">
                    <div className="h-20 w-20 bg-primary-50 text-primary-600 rounded-2xl p-2 shadow-sm shrink-0 flex items-center justify-center font-black text-3xl">
                        {contact.contactName ? contact.contactName.substring(0, 1).toUpperCase() : 'C'}
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-black text-slate-900 leading-tight">{contact.contactName}</h1>
                            {contact.contactId && (
                                <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200">
                                    {contact.contactId}
                                </span>
                            )}
                            {contact.customerType && (
                                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                                    {contact.customerType}
                                </span>
                            )}
                        </div>
                        <p className="text-slate-500 font-semibold mt-2 text-sm flex items-center gap-2">
                            <MdWork className="text-primary-500" /> {contact.designation || 'Contact Person'} {contact.company ? `at ${contact.company}` : ''}
                        </p>
                        <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1"><MdPhone /> {contact.phone || 'No Phone'}</span>
                            <span className="flex items-center gap-1"><MdEmail /> {contact.email || 'No Email'}</span>
                            <span className="flex items-center gap-1"><MdBusiness /> {contact.company || 'No Company'}</span>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Widget */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shrink-0 min-w-[200px]">
                    <div className="text-center px-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Meetings</div>
                        <div className="text-xl font-black text-primary-600">{stats.meetingCount || 0}</div>
                    </div>
                    <div className="text-center px-4 border-l border-slate-200">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tickets</div>
                        <div className="text-xl font-black text-slate-800">{stats.ticketCount || 0}</div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 scrollbar-none">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shrink-0 ${
                            activeTab === tab.id
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content Areas */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm min-h-[400px]">
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider border-b border-slate-100 pb-3">Contact Details</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Contact Name</span>
                                    <span className="font-bold text-slate-800">{contact.contactName}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Contact ID</span>
                                    <span className="font-mono font-bold text-slate-800">{contact.contactId || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Company</span>
                                    <span className="font-bold text-slate-800">{contact.company || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Designation</span>
                                    <span className="font-bold text-slate-800">{contact.designation || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Phone</span>
                                    <span className="font-bold text-slate-800">{contact.phone || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Email</span>
                                    <span className="font-bold text-slate-800">{contact.email || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Type</span>
                                    <span className="font-bold text-primary-600">{contact.customerType || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block">Last Interaction</span>
                                    <span className="font-bold text-slate-800">{contact.lastInteractionDate ? new Date(contact.lastInteractionDate).toLocaleDateString() : '-'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider border-b border-slate-100 pb-3">Notes & Relationship</h3>
                            <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                                <div>
                                    <span className="text-slate-400 text-xs font-bold uppercase block mb-1">Notes</span>
                                    <p className="text-xs font-medium text-slate-700 leading-relaxed">{contact.notes || 'No notes added for this contact.'}</p>
                                </div>
                                {customer && (
                                    <div className="pt-4 border-t border-slate-200">
                                        <span className="text-slate-400 text-xs font-bold uppercase block mb-2">Linked Customer Account</span>
                                        <button
                                            onClick={() => navigate(`/customers/${customer._id}/360`)}
                                            className="text-xs font-black text-primary-600 hover:underline flex items-center gap-1"
                                        >
                                            <MdBusiness /> {customer.companyName || customer.customerName} → View Customer 360
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* MEETINGS TAB */}
                {activeTab === 'meetings' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Scheduled & Past Meetings</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Title</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Agenda</th>
                                        <th className="px-6 py-4 text-right">Date & Time</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {meetings.map(m => (
                                        <tr key={m._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-black text-slate-900">{m.title}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-black uppercase bg-primary-50 text-primary-700 px-2 py-0.5 rounded border border-primary-100">
                                                    {m.status || 'Scheduled'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{m.agenda || '-'}</td>
                                            <td className="px-6 py-4 text-right text-slate-400">
                                                {m.startDateTime ? new Date(m.startDateTime).toLocaleString() : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {meetings.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No meetings logged for this contact.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SUPPORT TICKETS TAB */}
                {activeTab === 'tickets' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Support Tickets Raised</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Ticket No</th>
                                        <th className="px-6 py-4">Issue Title</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Created Date</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-slate-700 divide-y divide-slate-50">
                                    {tickets.map(t => (
                                        <tr key={t._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-mono font-black text-slate-900">{t.ticketNo}</td>
                                            <td className="px-6 py-4 text-slate-800">{t.issueTitle}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {tickets.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No support tickets found for this contact.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TIMELINE TAB */}
                {activeTab === 'timeline' && (
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Interaction History</h3>
                        <div className="relative border-l-2 border-slate-100 pl-6 ml-3 space-y-6">
                            {timeline.map((item, idx) => (
                                <div key={item.id || idx} className="relative">
                                    <div className="absolute -left-[31px] top-0 h-8 w-8 rounded-full bg-primary-50 border-2 border-white flex items-center justify-center text-primary-600 shadow-sm">
                                        <MdMessage size={16} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-slate-900 text-sm">{item.title}</span>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {item.date ? new Date(item.date).toLocaleString() : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs font-medium text-slate-600 mt-1">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                            {timeline.length === 0 && (
                                <p className="text-slate-400 font-bold text-xs uppercase">No timeline events recorded.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Contact360Workspace;
