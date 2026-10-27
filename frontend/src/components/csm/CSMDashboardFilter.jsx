import React, { useState } from 'react';
import {
    MdFilterList, MdCalendarToday, MdBusiness,
    MdExpandMore, MdExpandLess, MdRestartAlt, MdRefresh
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

const presetButtonClass = (active) => `px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
    active
        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
}`;

const selectClass = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl py-1.5 font-bold outline-none focus:ring-2 focus:ring-teal-500 shadow-sm';

/** Page title row with the Refresh button. */
export const CSMDashboardHeader = ({ title, icon, onRefresh, refreshing }) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase flex items-center gap-2">
            {icon} {title}
        </h1>
        <button
            onClick={onRefresh}
            className="p-3 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-1 font-bold text-xs self-start md:self-auto"
            title="Refresh Stats"
        >
            <MdRefresh size={18} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
    </div>
);

/** Collapsible "Filter View" toolbar driven by useCSMDashboardFilters() (hooks/useCSMDashboardFilters). */
const CSMDashboardFilter = ({ filters }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const {
        branches, selectedBranch, setSelectedBranch, quickRange, setQuickRange,
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
        startDay, setStartDay, endDay, setEndDay, customMode, setCustomMode, reset
    } = filters;

    const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dayOptions = Array.from({ length: daysInSelectedMonth }, (_, idx) => idx + 1);

    const selectedBranchName = (() => {
        if (!selectedBranch) return 'All Branches';
        const found = branches.find(b => b._id === selectedBranch);
        return found ? (found.name || found.code) : 'Branch';
    })();

    const activeDateSummary = (() => {
        const preset = QUICK_RANGES.find(r => r.value === quickRange);
        if (preset) return preset.label;
        if (customMode) {
            const mName = MONTH_NAMES[selectedMonth - 1]?.slice(0, 3) || '';
            const rangeStr = (startDay || endDay) ? ` (${startDay || 1}-${endDay || daysInSelectedMonth})` : '';
            return `${mName} ${selectedYear}${rangeStr}`;
        }
        return 'All Time';
    })();

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all overflow-hidden">
            {/* Filter Header / Collapse Toggle Bar */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-2xl border border-teal-100 dark:border-teal-900/50">
                        <MdFilterList size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                Filter View
                            </h3>
                            {(selectedBranch || quickRange || customMode) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300">
                                    Active
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                            {selectedBranchName} • {activeDateSummary}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Quick Branch & Date Badges when collapsed */}
                    {isCollapsed && (
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-bold border border-slate-200/60 dark:border-slate-700">
                                {selectedBranchName}
                            </span>
                            <span className="px-3 py-1 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-300 rounded-xl text-[11px] font-bold border border-teal-200/60 dark:border-teal-900/50">
                                {activeDateSummary}
                            </span>
                        </div>
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
                <div className="p-4 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Preset Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5">
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

                        {/* Branch Filter & Reset */}
                        <div className="flex items-center gap-3">
                            {branches.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <MdBusiness className="text-teal-600" size={16} />
                                    <select
                                        value={selectedBranch}
                                        onChange={(e) => setSelectedBranch(e.target.value)}
                                        className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
                                    >
                                        <option value="">All Branches</option>
                                        {branches.map((b) => (
                                            <option key={b._id} value={b._id}>
                                                {b.name || b.code}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {(selectedBranch || quickRange || customMode || startDay || endDay) && (
                                <button
                                    onClick={reset}
                                    className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1.5 rounded-xl transition-colors"
                                >
                                    <MdRestartAlt size={16} /> Reset
                                </button>
                            )}
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
