import React, { useState, useEffect } from 'react';
import { MdClose, MdMinimize, MdPushPin } from 'react-icons/md';
import NotepadWidget from './NotepadWidget';

const FloatingNotepad = () => {
    // Default open & pinned so it remains accessible permanently across all pages
    const [isOpen, setIsOpen] = useState(() => {
        try {
            const saved = localStorage.getItem('floating_notepad_open');
            return saved === null ? true : saved !== 'false';
        } catch {
            return true;
        }
    });

    const [isPinned, setIsPinned] = useState(() => {
        try {
            const saved = localStorage.getItem('floating_notepad_pinned');
            return saved === null ? true : saved !== 'false';
        } catch {
            return true;
        }
    });

    useEffect(() => {
        const handleToggle = () => {
            setIsOpen((prev) => {
                const nextState = !prev;
                try {
                    localStorage.setItem('floating_notepad_open', String(nextState));
                } catch {}
                return nextState;
            });
        };
        window.addEventListener('toggle-floating-notepad', handleToggle);
        return () => window.removeEventListener('toggle-floating-notepad', handleToggle);
    }, []);

    const toggleOpen = (state) => {
        const nextState = typeof state === 'boolean' ? state : !isOpen;
        setIsOpen(nextState);
        try {
            localStorage.setItem('floating_notepad_open', String(nextState));
        } catch {}
    };

    const togglePinned = () => {
        const nextState = !isPinned;
        setIsPinned(nextState);
        try {
            localStorage.setItem('floating_notepad_pinned', String(nextState));
        } catch {}
    };

    return (
        <>
            {/* Floating Popover Notepad Window */}
            {isOpen && (
                <div 
                    className="fixed bottom-24 right-6 sm:right-10 w-[92vw] sm:w-[420px] h-[520px] max-h-[80vh] z-[9998] shadow-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden animate-fade-in-up backdrop-blur-xl"
                >
                    {/* Window Header with Pin & Close controls */}
                    <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800 select-none">
                        <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${isPinned ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                                {isPinned ? 'Pinned Notepad (Global Access)' : 'Quick Notes Overlay'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={togglePinned}
                                className={`p-1.5 rounded-lg transition-colors ${isPinned ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                title={isPinned ? "Pinned to Screen (Always Visible)" : "Click to Pin to Screen"}
                            >
                                <MdPushPin size={16} />
                            </button>
                            <button
                                onClick={() => toggleOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                title="Minimize Notepad"
                            >
                                <MdMinimize size={18} />
                            </button>
                            <button
                                onClick={() => toggleOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                title="Close Notepad"
                            >
                                <MdClose size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Notepad Body */}
                    <div className="flex-1 overflow-hidden">
                        <NotepadWidget isFloating={true} onClose={() => toggleOpen(false)} />
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingNotepad;
