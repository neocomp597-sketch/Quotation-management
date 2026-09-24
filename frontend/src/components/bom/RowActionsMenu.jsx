import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useAnchoredPosition from './useAnchoredPosition';

/**
 * "More" menu for a component row. `actions` is a list of { label, onClick, disabled }.
 * Rendered in a portal so the scrolling table doesn't clip it.
 */
const RowActionsMenu = ({ actions }) => {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const style = useAnchoredPosition(buttonRef, open, { align: 'right', estimatedHeight: 240 });

    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => {
            if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
        };
        const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                title="More actions"
                onClick={() => setOpen((value) => !value)}
                className="rounded-md bg-[#e9eef3] px-2 py-[7px] text-sm font-semibold leading-none text-[#263238] hover:bg-[#dde5ec]"
            >
                ⋯
            </button>
            {style && createPortal(
                <div ref={menuRef} role="menu" style={style} className="min-w-[13rem] overflow-hidden rounded-md border border-[#d7dee7] bg-white py-1 text-sm shadow-lg">
                    {actions.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            role="menuitem"
                            disabled={action.disabled}
                            onClick={() => { setOpen(false); action.onClick(); }}
                            className="block w-full px-3 py-2 text-left text-[#263238] hover:bg-[#eef5fb] disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                        >
                            {action.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
};

export default RowActionsMenu;
