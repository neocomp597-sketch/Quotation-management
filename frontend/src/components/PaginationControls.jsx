import React from 'react';

const PaginationControls = ({ pagination, onPageChange, className = '' }) => {
    if (!pagination || pagination.pages <= 1) return null;

    const start = pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1;
    const end = Math.min(pagination.total, pagination.page * pagination.limit);

    return (
        <div className={`master-pagination ${className}`}>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Showing {start}-{end} of {pagination.total}
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
                    disabled={pagination.page <= 1}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                    Prev
                </button>
                <span className="min-w-20 text-center text-xs font-black text-slate-700">
                    {pagination.page} / {pagination.pages}
                </span>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
                    disabled={pagination.page >= pagination.pages}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default PaginationControls;
