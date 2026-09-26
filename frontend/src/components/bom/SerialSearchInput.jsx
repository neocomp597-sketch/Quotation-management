import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdSearch } from 'react-icons/md';
import { csmService } from '../../services/api';
import useAnchoredPosition from './useAnchoredPosition';

/**
 * Text input with a serial-number lookup over the serials registered in Invoice Bulk
 * Upload. Typing searches; picking a result calls onSelect with the asset so the form
 * can fill in the finished good.
 *
 * Free text is still allowed (a BOM may be prepared before the serial is registered),
 * but the suggestions keep people from typing something that is not a serial number.
 */
const SerialSearchInput = ({ value, onChange, onSelect, placeholder = 'Search serial number', disabled = false, className = '' }) => {
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState({ term: null, items: [] });
    const [highlight, setHighlight] = useState(0);
    const wrapperRef = useRef(null);
    const listRef = useRef(null);
    const term = String(value || '').trim();
    const showList = open && Boolean(term) && !disabled;
    const listStyle = useAnchoredPosition(wrapperRef, showList, { estimatedHeight: 300 });

    useEffect(() => {
        if (!open || !term) return undefined;
        let cancelled = false;
        const timer = setTimeout(() => {
            csmService.searchSerialNumbers(term)
                .then((res) => {
                    if (cancelled) return;
                    const items = (Array.isArray(res.data) ? res.data : res.data?.data || []).slice(0, 25);
                    setResults({ term, items });
                })
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

    const choose = (asset) => {
        onSelect?.(asset);
        setOpen(false);
    };

    const handleKeyDown = (event) => {
        if (!open || !items.length) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((h) => Math.min(h + 1, items.length - 1)); }
        if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
        if (event.key === 'Enter') { event.preventDefault(); choose(items[highlight]); }
        if (event.key === 'Escape') setOpen(false);
    };

    const labelFor = (asset) => ({
        serial: asset.serialNumber || asset.serial || '',
        product: asset.productId?.productName || asset.productName || '',
        code: asset.productId?.productCode || asset.productCode || '',
        customer: asset.customerId?.customerName || asset.customerId?.companyName || asset.customerName || '',
        status: asset.status || '',
    });

    return (
        <div ref={wrapperRef} className="relative">
            <input
                value={value || ''}
                disabled={disabled}
                placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onChange={(event) => { onChange(event.target.value); setOpen(true); setHighlight(0); }}
                onKeyDown={handleKeyDown}
                className={`${className} pr-9`}
            />
            <MdSearch className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            {listStyle && createPortal(
                <div ref={listRef} style={listStyle} className="max-h-72 w-[30rem] max-w-[90vw] overflow-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
                    {loading && <p className="px-3 py-2 text-xs text-slate-400">Searching…</p>}
                    {!loading && items.length === 0 && (
                        <p className="px-3 py-2 text-xs text-slate-400">
                            No serial number starting with “{term}” in Invoice Bulk Upload. You can still type it in.
                        </p>
                    )}
                    {items.map((asset, index) => {
                        const info = labelFor(asset);
                        return (
                            <button
                                type="button"
                                key={asset._id || info.serial || index}
                                onMouseDown={(event) => { event.preventDefault(); choose(asset); }}
                                onMouseEnter={() => setHighlight(index)}
                                className={`block w-full px-4 py-2 text-left text-sm ${index === highlight ? 'bg-primary-50' : ''}`}
                            >
                                <span className="font-bold text-slate-800">{info.serial}</span>
                                {info.status && <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{info.status}</span>}
                                {(info.product || info.code) && (
                                    <span className="mt-0.5 block text-[11px] text-slate-500">
                                        {[info.code, info.product].filter(Boolean).join(' · ')}
                                    </span>
                                )}
                                {info.customer && <span className="block text-[11px] text-slate-400">{info.customer}</span>}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
};

export default SerialSearchInput;
