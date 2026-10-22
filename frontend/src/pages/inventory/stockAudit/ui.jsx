import React from 'react';

const TONES = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-rose-50 text-rose-700 border-rose-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-100'
};
const TONE_OF = {
    Draft: 'slate', 'In Progress': 'sky', 'Under Review': 'amber', Completed: 'green', Cancelled: 'red',
    Pending: 'slate', Matched: 'green', Short: 'red', Excess: 'violet',
    Open: 'red', 'Recount Requested': 'amber', Resolved: 'green',
    owner: 'sky', auditor: 'green', viewer: 'slate'
};
export const Badge = ({ value, tone, children }) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold whitespace-nowrap ${TONES[tone || TONE_OF[value] || 'slate']}`}>
        {children || value || '—'}
    </span>
);

export const ProgressBar = ({ value, className = 'bg-teal-500' }) => (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${className}`} style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }} />
    </div>
);
