import { useState } from 'react';

/**
 * Filters that fold away behind a Filters button (client: Serial No Transfer 2026-11-17, Invoice
 * Bulk Upload 2026-11-19 — they took too much room, above all on a phone). Folded at first; open
 * or folded is remembered in this browser under `storageKey`.
 */
const useFiltersOpen = (storageKey) => {
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

export default useFiltersOpen;
