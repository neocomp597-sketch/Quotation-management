import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { MdNewReleases as IconReleases, MdRefresh as IconRefresh, MdCheckCircle as IconCheck, MdPerson as IconPerson, MdCalendarToday as IconCalendar, MdInfo as IconInfo } from 'react-icons/md';
import { systemUpdateService } from '../services/api';

const SystemUpdates = () => {
    const [updates, setUpdates] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadUpdates = async () => {
        setLoading(true);
        try {
            const res = await systemUpdateService.getAll();
            setUpdates(res.data || []);
        } catch (error) {
            console.error("Failed to load system updates", error);
            toast.error('Failed to load system updates history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUpdates();
    }, []);

    const formatDate = (dateStr) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            {/* Header section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-primary-600 font-black uppercase tracking-widest text-xs">
                        <IconReleases size={18} />
                        Release History
                    </div>
                    <h1 className="mt-2 text-3xl font-black text-slate-900 tracking-tight">System Updates</h1>
                    <p className="text-slate-500 font-medium">Keep track of the latest changes, features, and fixes deployed to the platform.</p>
                </div>
                <button
                    type="button"
                    onClick={loadUpdates}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-60 transition-colors shadow-sm"
                >
                    <IconRefresh size={18} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold text-sm">Fetching release records...</p>
                </div>
            ) : updates.length === 0 ? (
                <div className="bg-white rounded-[2rem] border border-slate-100 p-12 text-center shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <IconInfo size={32} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900">No updates posted yet</h3>
                    <p className="text-slate-400 mt-2 font-medium max-w-sm mx-auto">All deployment logs and system announcements will be displayed here once published.</p>
                </div>
            ) : (
                <div className="relative border-l-2 border-slate-100 ml-4 pl-8 py-2 space-y-10">
                    {updates.map((update, index) => (
                        <div key={update._id} className="relative group">
                            {/* Dot on Timeline */}
                            <div className="absolute -left-[41px] top-1.5 w-6 h-6 rounded-full bg-white border-4 border-primary-600 flex items-center justify-center shadow-md group-hover:scale-115 transition-transform duration-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-600"></span>
                            </div>

                            {/* Release Card */}
                            <div className="bg-white rounded-[2rem] border border-slate-100 hover:border-slate-200 p-6 md:p-8 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group-hover:-translate-y-0.5">
                                {/* Gradient Indicator Bar */}
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-primary-600 to-indigo-600"></div>
                                
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4 mb-5">
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center justify-center px-3.5 py-1 rounded-full text-xs font-black bg-primary-50 text-primary-700 tracking-wider">
                                            {update.version}
                                        </span>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">{update.title}</h2>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-400">
                                        <span className="flex items-center gap-1.5">
                                            <IconCalendar size={14} className="text-slate-300" />
                                            {formatDate(update.deployedAt)}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <IconPerson size={14} className="text-slate-300" />
                                            {update.deployedBy}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-slate-600 font-medium leading-relaxed text-sm mb-6">{update.message}</p>

                                {update.releaseNotes && update.releaseNotes.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">What's New</h4>
                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                            {update.releaseNotes.map((note, idx) => (
                                                <li key={idx} className="flex items-start gap-2.5 text-sm font-semibold text-slate-700">
                                                    <IconCheck className="text-emerald-500 mt-0.5 shrink-0" size={16} />
                                                    <span>{note}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SystemUpdates;
