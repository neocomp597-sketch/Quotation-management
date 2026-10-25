import React from 'react';
import { ROW_STATUS, rowStatusLabel } from './importHelpers';

// Small building blocks shared by the import steps.

export const StatusBadge = ({ row }) => (
    <span className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${ROW_STATUS[row.status]?.className || ROW_STATUS.blank.className}`}>
        {rowStatusLabel(row)}
    </span>
);

/** Buttons of a step, kept in view at the bottom of the modal while the step scrolls. */
export const ActionBar = ({ children, note }) => (
    <div className="sticky -bottom-5 md:-bottom-8 z-10 -mx-5 md:-mx-8 -mb-5 md:-mb-8 mt-6 px-5 md:px-8 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{note}</p>
        <div className="flex flex-wrap justify-end gap-2">{children}</div>
    </div>
);
