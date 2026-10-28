import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { csmService } from '../services/api';
import { MdFlashOn, MdFormatListBulleted, MdGridView, MdChevronRight } from 'react-icons/md';
import { toast } from 'react-toastify';
import CSMDashboardFilter, { CSMDashboardHeader } from '../components/csm/CSMDashboardFilter';
import { useCSMDashboardFilters } from '../hooks/useCSMDashboardFilters';

// Charts, SLA compliance, field service log and engineer performance live on the
// CSM Detail Dashboard (/csm/detail-dashboard); this page only shows the ticket counts.
const VIEW_MODE_KEY = 'csm_dashboard_view_mode';

const VIEW_OPTIONS = [
    { value: 'list', label: 'List', icon: MdFormatListBulleted },
    { value: 'card', label: 'Card', icon: MdGridView }
];

const CSMDashboard = () => {
    const navigate = useNavigate();
    const filters = useCSMDashboardFilters();
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState(null);
    const latestRequest = useRef(0);
    // The chosen view is remembered on this device
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'card';
        } catch {
            return 'card';
        }
    });

    const changeViewMode = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem(VIEW_MODE_KEY, mode);
        } catch {
            // Storage unavailable (private mode): the choice lasts for this visit only
        }
    };

    const loadStats = useCallback(async () => {
        // Ignore responses that arrive after a newer filter change
        const requestId = ++latestRequest.current;
        setLoading(true);
        try {
            const res = await csmService.getStats(filters.params);
            if (requestId === latestRequest.current) setMetrics(res.data?.metrics || {});
        } catch (error) {
            console.error('Fetch dashboard stats error:', error);
            if (requestId === latestRequest.current) toast.error('Failed to load dashboard statistics');
        } finally {
            if (requestId === latestRequest.current) setLoading(false);
        }
    }, [filters.params]);

    useEffect(() => {
        loadStats();
        window.addEventListener('onCsmDataSeeded', loadStats);
        return () => {
            window.removeEventListener('onCsmDataSeeded', loadStats);
        };
    }, [loadStats]);

    const m = metrics || {};

    // Each card opens the Tickets Register filtered to the tickets it counts
    const cardRows = [
        [
            { label: 'Open', value: m.open, color: 'from-teal-500 to-emerald-600', link: '/csm/tickets?status=open_tickets&tab=all' },
            { label: 'Unassigned', value: m.unassigned, color: 'from-purple-500 to-indigo-600', link: '/csm/tickets?unassigned=true&tab=all' },
            { label: 'Pending', value: m.pending, color: 'from-amber-400 to-orange-500', link: '/csm/tickets?status=Pending Customer&tab=all' }
        ],
        [
            { label: 'Created Yesterday', value: m.createdYesterday, color: 'from-indigo-400 to-blue-600', link: '/csm/tickets?createdOn=yesterday&tab=all' },
            { label: 'Resolved Yesterday', value: m.resolvedYesterday, color: 'from-emerald-500 to-green-600', link: '/csm/tickets?resolvedOn=yesterday&tab=all' },
            { label: 'Created Today', value: m.createdToday, color: 'from-blue-500 to-blue-700', link: '/csm/tickets?createdOn=today&tab=all' },
            { label: 'Resolved Today', value: m.resolvedToday, color: 'from-sky-500 to-cyan-600', link: '/csm/tickets?resolvedOn=today&tab=all' }
        ]
    ];

    const renderCard = (card) => (
        <button
            key={card.label}
            type="button"
            onClick={() => navigate(card.link)}
            className="relative overflow-hidden text-left bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-[0.98] group focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
            <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.color}`} />
            <span className="block text-[11px] leading-tight font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                {card.label}
            </span>
            {metrics ? (
                <span className="block mt-1 text-3xl font-black text-slate-900 dark:text-slate-100 font-outfit leading-tight tabular-nums">
                    {card.value ?? 0}
                </span>
            ) : (
                <span className="block mt-2 h-8 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            )}
        </button>
    );

    const renderListRow = (card) => (
        <button
            key={card.label}
            type="button"
            onClick={() => navigate(card.link)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
        >
            <span className={`w-1 self-stretch rounded-full bg-gradient-to-b ${card.color}`} />
            <span className="flex-1 min-w-0 text-[11px] leading-tight font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                {card.label}
            </span>
            {metrics ? (
                <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-outfit leading-tight tabular-nums">
                    {card.value ?? 0}
                </span>
            ) : (
                <span className="h-6 w-8 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
            )}
            <MdChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 shrink-0" />
        </button>
    );

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            <CSMDashboardHeader
                title="Customer Service Analytics"
                icon={<MdFlashOn className="text-teal-600 animate-pulse" />}
                onRefresh={loadStats}
                refreshing={loading}
            />

            <CSMDashboardFilter filters={filters} />

            <div className="space-y-3">
                {/* List / Card View Toggle */}
                <div className="flex justify-end">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 shrink-0">
                        {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => changeViewMode(value)}
                                aria-pressed={viewMode === value}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    viewMode === value
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                                title={`${label} View`}
                            >
                                <Icon size={16} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {viewMode === 'list' ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                        {cardRows.flat().map(renderListRow)}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {cardRows[0].map(renderCard)}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {cardRows[1].map(renderCard)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CSMDashboard;
