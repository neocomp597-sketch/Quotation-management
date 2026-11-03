import React, { useState } from 'react';
import {
    MdFilterList, MdCalendarToday,
    MdExpandMore, MdExpandLess, MdRestartAlt, MdRefresh, MdFileDownload
} from 'react-icons/md';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const QUICK_RANGES = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Previous Month' }
];

const presetButtonClass = (active) => `px-2.5 py-1.5 whitespace-nowrap text-xs font-bold rounded-xl transition-all ${
    active
        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
}`;

const selectClass = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl py-1.5 font-bold outline-none focus:ring-2 focus:ring-teal-500 shadow-sm';

// Branch and MGR 1 share the date buttons' row: a long name is cut off in the closed list, not the row's width.
const rowSelectClass = `${selectClass} truncate min-w-0 grow basis-36 px-3 sm:grow-0 sm:basis-auto`;

const headerButtonClass = 'px-3 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-1 font-bold text-xs';

/** The date filter in words, e.g. "This Month" or "Jan 2026 (1-15)". */
export const describeDateFilter = ({ quickRange, customMode, selectedMonth, selectedYear, startDay, endDay }) => {
    const preset = QUICK_RANGES.find(r => r.value === quickRange);
    if (preset) return preset.label;
    if (customMode) {
        const mName = MONTH_NAMES[selectedMonth - 1]?.slice(0, 3) || '';
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const rangeStr = (startDay || endDay) ? ` (${startDay || 1}-${endDay || daysInMonth})` : '';
        return `${mName} ${selectedYear}${rangeStr}`;
    }
    return 'All Time';
};

/** Page title row with the Refresh button, Export to Excel when `onExport` is given, and `children` first (the page's own controls). */
export const CSMDashboardHeader = ({ title, icon, onRefresh, refreshing, onExport, exporting, children }) => (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 font-outfit uppercase flex items-center gap-2">
            {icon} {title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {children}
            {onExport && (
                <button type="button" onClick={onExport} disabled={exporting} className={`${headerButtonClass} disabled:opacity-60`} title="Export to Excel">
                    <MdFileDownload size={18} /> {exporting ? 'Exporting...' : 'Export to Excel'}
                </button>
            )}
            <button type="button" onClick={onRefresh} className={headerButtonClass} title="Refresh Stats">
                <MdRefresh size={18} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
        </div>
    </div>
);

/** Collapsible "Filter View" toolbar driven by useCSMDashboardFilters() (hooks/useCSMDashboardFilters). */
const CSMDashboardFilter = ({ filters }) => {
    const {
        branchAndMgr, branchOptions, mgr1Options, mgr1Name,
        selectedBranch, setSelectedBranch, selectedMgr1, setSelectedMgr1,
        branchName, quickRange, setQuickRange,
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
        startDay, setStartDay, endDay, setEndDay, customMode, setCustomMode, reset
    } = filters;
    // Analytics opens with its Branch and MGR 1 filters in view; the other dashboards with them closed.
    const [isCollapsed, setIsCollapsed] = useState(!branchAndMgr);

    const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dayOptions = Array.from({ length: daysInSelectedMonth }, (_, idx) => idx + 1);

    const activeDateSummary = describeDateFilter(filters);
    const canReset = selectedBranch || selectedMgr1 || quickRange || customMode || startDay || endDay;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all overflow-hidden">
            {/* Filter Header / Collapse Toggle Bar */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
            >
                <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0 p-2 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-2xl border border-teal-100 dark:border-teal-900/50">
                        <MdFilterList size={18} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                Filter View
                            </h3>
                            {(selectedBranch || selectedMgr1 || quickRange || customMode) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300">
                                    Active
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                            {branchName}{mgr1Name ? ` • ${mgr1Name}` : ''} • {activeDateSummary}
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {/* Quick Branch & Date Badges when collapsed */}
                    {isCollapsed && (
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-bold border border-slate-200/60 dark:border-slate-700">
                                {branchName}
                            </span>
                            {mgr1Name && (
                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-bold border border-slate-200/60 dark:border-slate-700">
                                    {mgr1Name}
                                </span>
                            )}
                            <span className="px-3 py-1 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-300 rounded-xl text-[11px] font-bold border border-teal-200/60 dark:border-teal-900/50">
                                {activeDateSummary}
                            </span>
                        </div>
                    )}

                    {!isCollapsed && canReset && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); reset(); }}
                            title="Reset filters"
                            aria-label="Reset filters"
                            className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1.5 rounded-xl transition-colors"
                        >
                            <MdRestartAlt size={16} /> <span className="hidden sm:inline">Reset</span>
                        </button>
                    )}

                    <button
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                        aria-label={isCollapsed ? "Expand filters" : "Collapse filters"}
                    >
                        <span>{isCollapsed ? "Expand Filters" : "Collapse"}</span>
                        {isCollapsed ? <MdExpandMore size={18} /> : <MdExpandLess size={18} />}
                    </button>
                </div>
            </div>

            {/* Expanded Filter Panel */}
            {!isCollapsed && (
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 text-xs">
                        {branchAndMgr && branchOptions.length > 1 && (
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                aria-label="Branch"
                                title={branchName}
                                className={`${rowSelectClass} sm:max-w-[10rem]`}
                            >
                                <option value="">All My Branches</option>
                                {branchOptions.map((branch) => (
                                    <option key={branch._id} value={branch._id}>{branch.name}</option>
                                ))}
                            </select>
                        )}
                        {branchAndMgr && (
                            <select
                                value={selectedMgr1}
                                onChange={(e) => setSelectedMgr1(e.target.value)}
                                aria-label="MGR 1"
                                title={mgr1Name || 'All MGR 1'}
                                className={`${rowSelectClass} sm:max-w-[11rem]`}
                            >
                                <option value="">All MGR 1</option>
                                {mgr1Options.map((mgr) => (
                                    <option key={mgr._id} value={mgr._id}>
                                        {mgr.description && mgr.description !== mgr.code ? `${mgr.code} - ${mgr.description}` : mgr.code}
                                    </option>
                                ))}
                            </select>
                        )}

                        {/* Preset Buttons */}
                        <div className="flex flex-wrap xl:shrink-0 items-center gap-1">
                            <button
                                onClick={() => { setQuickRange(''); setCustomMode(false); }}
                                className={presetButtonClass(!quickRange && !customMode)}
                            >
                                All Time
                            </button>
                            {QUICK_RANGES.map((range) => (
                                <button
                                    key={range.value}
                                    onClick={() => { setQuickRange(range.value); setCustomMode(false); }}
                                    className={presetButtonClass(quickRange === range.value)}
                                >
                                    {range.label}
                                </button>
                            ))}
                            <button
                                onClick={() => { setQuickRange(''); setCustomMode(true); }}
                                className={`${presetButtonClass(customMode)} flex items-center gap-1.5`}
                            >
                                <MdCalendarToday size={14} /> Month / Day Range
                            </button>
                        </div>
                    </div>

                    {/* Custom Month-wise & Day Range Selection */}
                    {customMode && (
                        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">Month:</span>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                    className={`${selectClass} px-3`}
                                >
                                    {MONTH_NAMES.map((m, idx) => (
                                        <option key={idx} value={idx + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">Year:</span>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className={`${selectClass} px-3`}
                                >
                                    {[2024, 2025, 2026, 2027].map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">Day Range:</span>
                                <select
                                    value={startDay}
                                    onChange={(e) => setStartDay(e.target.value)}
                                    className={`${selectClass} px-2.5`}
                                >
                                    <option value="">1</option>
                                    {dayOptions.map(day => <option key={day} value={day}>{day}</option>)}
                                </select>
                                <span className="font-bold text-slate-400">to</span>
                                <select
                                    value={endDay}
                                    onChange={(e) => setEndDay(e.target.value)}
                                    className={`${selectClass} px-2.5`}
                                >
                                    <option value="">{daysInSelectedMonth}</option>
                                    {dayOptions.map(day => <option key={day} value={day}>{day}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CSMDashboardFilter;
