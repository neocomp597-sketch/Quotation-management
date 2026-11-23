import React, { useState } from 'react';
import { MdExpandMore, MdFilterList } from 'react-icons/md';

/**
 * Filters that fold away behind a Filters button (client: Serial No Transfer 2026-11-17, Invoice
 * Bulk Upload 2026-11-19 — they took too much room, above all on a phone). Folded at first; open
 * or folded is remembered in this browser under `storageKey`.
 */
export const useFiltersOpen = (storageKey) => {
    const [open, setOpen] = useState(() => {
        try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
    });
    const toggle = () => {
        const next = !open;
        setOpen(next);
        try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* not remembered */ }
    };
    return [open, toggle];
};

// `active`: how many of the folded filters are in use, shown on the button so none is forgotten.
export const FiltersButton = ({ open, onToggle, active, className = '' }) => (
    <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title={open ? 'Hide the filters' : 'Show the filters'}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all ${open || active ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'} ${className}`}
    >
        <MdFilterList size={18} />
        Filters
        {active > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary-600 text-white text-[10px] leading-5 text-center tracking-normal">{active}</span>
        )}
        <MdExpandMore size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
);
