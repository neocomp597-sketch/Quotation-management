import React from 'react';

/**
 * Reusable loading skeletons.
 *
 * A greyed-out outline of the page reads as "this is loading" faster than a spinner
 * and avoids the layout jump when the real content arrives. Screens compose these
 * rather than each inventing their own.
 */

const shimmer = 'animate-pulse bg-slate-200 dark:bg-slate-700 rounded';

export const TableSkeleton = ({ rows = 6, columns = 5, showHeader = true }) => (
    <div className="w-full" aria-busy="true" aria-label="Loading table">
        {showHeader && (
            <div className="flex gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                {Array.from({ length: columns }).map((_, i) => (
                    <div key={i} className={`${shimmer} h-3`} style={{ flex: i === 0 ? 2 : 1 }} />
                ))}
            </div>
        )}
        {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-4 px-4 py-4 border-b border-slate-100 dark:border-slate-800">
                {Array.from({ length: columns }).map((_, c) => (
                    <div key={c} className={`${shimmer} h-4`} style={{ flex: c === 0 ? 2 : 1, opacity: 1 - r * 0.08 }} />
                ))}
            </div>
        ))}
    </div>
);

export const CardSkeleton = ({ count = 4 }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-busy="true" aria-label="Loading cards">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className={`${shimmer} h-24`} />
        ))}
    </div>
);

export const ListSkeleton = ({ rows = 5 }) => (
    <div className="space-y-3" aria-busy="true" aria-label="Loading list">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
                <div className={`${shimmer} h-10 w-10 rounded-full`} />
                <div className="flex-1 space-y-2">
                    <div className={`${shimmer} h-3 w-1/3`} />
                    <div className={`${shimmer} h-3 w-1/2`} />
                </div>
            </div>
        ))}
    </div>
);

export const FormSkeleton = ({ fields = 6 }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5" aria-busy="true" aria-label="Loading form">
        {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
                <div className={`${shimmer} h-2.5 w-24`} />
                <div className={`${shimmer} h-11`} />
            </div>
        ))}
    </div>
);

/** Whole-page outline used while a screen's code is still downloading. */
export const PageSkeleton = () => (
    <div className="p-7 space-y-7" aria-busy="true" aria-label="Loading screen">
        <div className="space-y-3">
            <div className={`${shimmer} h-7 w-64`} />
            <div className={`${shimmer} h-3.5 w-96`} />
        </div>
        <CardSkeleton />
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-4">
            <TableSkeleton />
        </div>
    </div>
);

export default PageSkeleton;
