import { MdHistory } from 'react-icons/md';
import { ACTIVITY_CATEGORIES, filterActivity, formatActivityDate } from '../utils/assetActivity';

// Activity Log of one serial number, as returned by csmService.getAssetActivity: lifecycle
// entries, customer transfers, tickets and service visits. Asset Lifecycle Detail and Serial No
// Transfer both show it, so the same records read the same everywhere.

const CATEGORY_STYLES = {
    Lifecycle: 'bg-blue-50 text-blue-700 border-blue-200',
    Customer: 'bg-violet-50 text-violet-700 border-violet-200',
    Ticket: 'bg-amber-50 text-amber-700 border-amber-200',
    'Service Visit': 'bg-teal-50 text-teal-700 border-teal-200'
};

const AssetActivityLog = ({ activity = [], category = 'All', onCategoryChange, loading = false, title = 'Activity Log' }) => {
    const visible = filterActivity(activity, category);

    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                    <MdHistory size={18} className="text-primary-600" /> {title}
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">{visible.length}</span>
                </span>
                {onCategoryChange && (
                    <div className="flex flex-wrap gap-2">
                        {ACTIVITY_CATEGORIES.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => onCategoryChange(c)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${category === c ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="p-3 rounded-l-xl">Date & Time</th>
                            <th className="p-3">Category</th>
                            <th className="p-3">Activity</th>
                            <th className="p-3">Reference</th>
                            <th className="p-3">Customer</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Details</th>
                            <th className="p-3 rounded-r-xl">By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((a, i) => (
                            <tr key={`${a.category}-${a.reference}-${a.date}-${i}`} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 text-xs">
                                <td className="p-3 font-semibold text-slate-600 whitespace-nowrap">{formatActivityDate(a.date) || '-'}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase ${CATEGORY_STYLES[a.category] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{a.category}</span>
                                </td>
                                <td className="p-3 font-bold text-slate-900">{a.action}</td>
                                <td className="p-3 font-mono text-slate-700">{a.reference || '-'}</td>
                                <td className="p-3 font-semibold text-slate-700">{a.customer || '-'}</td>
                                <td className="p-3 font-bold text-slate-700">{a.status || '-'}</td>
                                <td className="p-3 text-slate-600 max-w-md">{a.details || '-'}</td>
                                <td className="p-3 font-semibold text-slate-600 whitespace-nowrap">{a.by || '-'}</td>
                            </tr>
                        ))}
                        {!visible.length && (
                            <tr>
                                <td colSpan={8} className="p-10 text-center text-slate-400 text-sm font-medium">
                                    {loading ? 'Loading activity…' : 'No activity recorded for this serial.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AssetActivityLog;
