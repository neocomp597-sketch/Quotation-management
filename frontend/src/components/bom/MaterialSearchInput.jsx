import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdSearch } from 'react-icons/md';
import { bomService } from '../../services/api';
import useAnchoredPosition from './useAnchoredPosition';

/**
 * Text input with a Product Master lookup. Typing searches by code or name; picking a result
 * calls onSelect with the material (code, description, uom, rate, materialGroup, status...).
 */
const MaterialSearchInput = ({ value, onChange, onSelect, placeholder = 'Search code', disabled = false, className = '' }) => {
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState({ term: null, items: [] });
    const [highlight, setHighlight] = useState(0);
    const wrapperRef = useRef(null);
    const listRef = useRef(null);
    const term = String(value || '').trim();
    const showList = open && Boolean(term) && !disabled;
    // The list is portalled with fixed positioning so the horizontally scrolling BOM table can't clip it.
    const listStyle = useAnchoredPosition(wrapperRef, showList, { estimatedHeight: 300 });

    useEffect(() => {
        if (!open || !term) return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            bomService.searchMaterials(term)
                .then((res) => { if (!cancelled) setResults({ term, items: res.data || [] }); })
                .catch(() => { if (!cancelled) setResults({ term, items: [] }); });
        }, 250);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [open, term]);

    useEffect(() => {
        const close = (event) => {
            if (!wrapperRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const items = results.term === term ? results.items : [];
    const loading = open && term && results.term !== term;

    const choose = (material) => {
        onSelect(material);
        setOpen(false);
    };

    const handleKeyDown = (event) => {
        if (!open || !items.length) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((h) => Math.min(h + 1, items.length - 1)); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
        if (event.key === 'Enter') { event.preventDefault(); choose(items[highlight]); }
        if (event.key === 'Escape') setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <input
                value={value || ''}
                disabled={disabled}
                placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onChange={(event) => { onChange(event.target.value); setOpen(true); setHighlight(0); }}
                onKeyDown={handleKeyDown}
                className={`${className} pr-7`}
            />
            <MdSearch className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            {listStyle && createPortal(
                <div ref={listRef} style={listStyle} className="max-h-72 w-[26rem] max-w-[90vw] overflow-auto rounded-md border border-[#d7dee7] bg-white shadow-lg">
                    {loading && <p className="px-3 py-2 text-xs text-slate-400">Searching...</p>}
                    {!loading && items.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No material found in Product Master.</p>}
                    {items.map((material, index) => (
                        <button
                            type="button"
                            key={material.productId}
                            onMouseDown={(event) => { event.preventDefault(); choose(material); }}
                            onMouseEnter={() => setHighlight(index)}
                            className={`block w-full px-3 py-2 text-left text-sm ${index === highlight ? 'bg-[#eef5fb]' : ''}`}
                        >
                            <span className="font-semibold text-[#1f4e78]">{material.code}</span>
                            <span className="ml-2 text-slate-700">{material.description}</span>
                            <span className="mt-0.5 block text-[11px] text-slate-500">
                                {[material.uom, material.materialGroup, material.rate ? `₹${material.rate}` : '', material.status !== 'Active' ? material.status : '']
                                    .filter(Boolean).join(' · ')}
                            </span>
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

export default MaterialSearchInput;
