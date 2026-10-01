import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAssessment, MdAssignmentTurnedIn, MdCheckCircle, MdOpenInNew, MdRefresh } from 'react-icons/md';
import { csmService } from '../services/api';
import { toast } from 'react-toastify';

const RANGE_OPTIONS = [
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
    { value: 'all', label: 'All time' }
];

const statusClass = (status) => ({
    Open: 'bg-rose-50 text-rose-700 border-rose-200',
    'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
    Closed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Resolved: 'bg-sky-50 text-sky-700 border-sky-200'
}[status] || 'bg-slate-50 text-slate-600 border-slate-200');

const WhyWhyAnalytics = () => {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('90');
    const [query, setQuery] = useState('');

    const loadReports = async () => {
        setLoading(true);
        try {
            const response = await csmService.getRcaReports();
            setReports(response.data || []);
        } catch (error) {
            console.error('Unable to load Why-Why analytics:', error);
            toast.error('Failed to load Why-Why analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const visibleReports = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const threshold = range === 'all' ? null : new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000);
        return reports.filter((report) => {
            const reportDate = new Date(report.date || report.createdAt);
            const matchesRange = !threshold || (!Number.isNaN(reportDate.getTime()) && reportDate >= threshold);
            const searchable = [report.rcaNumber, report.ticketNo, report.department, report.problemStatement, report.rootCause, report.rootCauseReason]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return matchesRange && (!normalizedQuery || searchable.includes(normalizedQuery));
        });
    }, [reports, range, query]);

    const metrics = useMemo(() => {
        const open = visibleReports.filter((report) => ['Open', 'In Progress'].includes(report.status)).length;
        const resolved = visibleReports.filter((report) => ['Closed', 'Resolved'].includes(report.status)).length;
        const capaActions = visibleReports.flatMap((report) => report.capaActions || []);
        const pendingCapa = capaActions.filter((action) => action.status !== 'Completed').length;
        return { total: visibleReports.length, open, resolved, pendingCapa };
    }, [visibleReports]);

    const rootCauseBreakdown = useMemo(() => {
        const counts = visibleReports.reduce((accumulator, report) => {
            const cause = report.rootCauseReason || report.category || 'Not classified';
            accumulator[cause] = (accumulator[cause] || 0) + 1;
            return accumulator;
        }, {});
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [visibleReports]);

    const statusBreakdown = useMemo(() => {
        const counts = visibleReports.reduce((accumulator, report) => {
            const status = report.status || 'Open';
            accumulator[status] = (accumulator[status] || 0) + 1;
            return accumulator;
        }, {});
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [visibleReports]);

    const maxRootCauseCount = rootCauseBreakdown[0]?.[1] || 1;

    return (
        <div className="space-y-6 pb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-teal-700">
                        <MdAssessment size={20} />
                        <span className="text-xs font-black uppercase tracking-widest">Analytics</span>
                    </div>
                    <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Why-Why Analysis</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">Track root causes, RCA resolution, and CAPA action progress.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <select value={range} onChange={(event) => setRange(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-500">
                        {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <button onClick={loadReports} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-600 transition-colors hover:bg-slate-50" title="Refresh analytics" aria-label="Refresh analytics">
                        <MdRefresh size={19} />
                    </button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'RCA reports', value: metrics.total, icon: <MdAssessment size={20} />, tone: 'text-teal-700 bg-teal-50' },
                    { label: 'Open or in progress', value: metrics.open, icon: <MdOpenInNew size={20} />, tone: 'text-amber-700 bg-amber-50' },
                    { label: 'Resolved', value: metrics.resolved, icon: <MdCheckCircle size={20} />, tone: 'text-emerald-700 bg-emerald-50' },
                    { label: 'Pending CAPA actions', value: metrics.pendingCapa, icon: <MdAssignmentTurnedIn size={20} />, tone: 'text-rose-700 bg-rose-50' }
                ].map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className={`mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg ${metric.tone}`}>{metric.icon}</div>
                        <p className="text-2xl font-black text-slate-900">{metric.value}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{metric.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <section className="border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-black text-slate-900">Root Cause Distribution</h2>
                    <div className="mt-5 space-y-4">
                        {rootCauseBreakdown.length ? rootCauseBreakdown.map(([cause, count]) => (
                            <div key={cause}>
                                <div className="mb-1 flex justify-between gap-3 text-xs font-semibold text-slate-600"><span className="truncate">{cause}</span><span>{count}</span></div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: `${(count / maxRootCauseCount) * 100}%` }} /></div>
                            </div>
                        )) : <p className="py-8 text-center text-sm text-slate-400">No RCA reports match the selected filters.</p>}
                    </div>
                </section>

                <section className="border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-black text-slate-900">RCA Status</h2>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        {statusBreakdown.length ? statusBreakdown.map(([status, count]) => (
                            <div key={status} className="border border-slate-100 p-4">
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusClass(status)}`}>{status}</span>
                                <p className="mt-3 text-2xl font-black text-slate-900">{count}</p>
                            </div>
                        )) : <p className="col-span-2 py-8 text-center text-sm text-slate-400">No RCA reports match the selected filters.</p>}
                    </div>
                </section>
            </div>

            <section className="border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div><h2 className="text-sm font-black text-slate-900">RCA Analysis Register</h2><p className="mt-1 text-xs text-slate-500">Open a record to review its five-whys and CAPA actions.</p></div>
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search RCA, ticket, root cause..." className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 sm:w-72" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">RCA</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Root Cause</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">CAPA</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">Loading analytics...</td></tr> : visibleReports.length ? visibleReports.map((report) => {
                                const actions = report.capaActions || [];
                                const completed = actions.filter((action) => action.status === 'Completed').length;
                                return <tr key={report._id} className="text-sm text-slate-600 hover:bg-slate-50"><td className="px-5 py-4 font-bold text-slate-900"><span className="block">{report.rcaNumber}</span><span className="mt-1 block text-xs font-normal text-slate-400">{report.ticketNo || 'No ticket'}</span></td><td className="px-5 py-4">{report.department || '-'}</td><td className="max-w-xs px-5 py-4"><span className="block truncate" title={report.rootCauseReason || report.rootCause || ''}>{report.rootCauseReason || report.rootCause || 'Not classified'}</span></td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusClass(report.status)}`}>{report.status || 'Open'}</span></td><td className="px-5 py-4">{completed}/{actions.length} completed</td><td className="px-5 py-4 text-right"><button onClick={() => navigate('/csm/rca')} className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900">Open report <MdOpenInNew size={15} /></button></td></tr>;
                            }) : <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">No RCA reports match the selected filters.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default WhyWhyAnalytics;