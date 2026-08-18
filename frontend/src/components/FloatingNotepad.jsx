import React, { useState, useEffect, useRef } from 'react';
import { MdStickyNote2, MdClose, MdDragIndicator, MdMinimize, MdPushPin } from 'react-icons/md';
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
    
    // Position state for floating button
    const [buttonPos, setButtonPos] = useState(() => {
        try {
            const saved = localStorage.getItem('floating_notepad_button_pos');
            if (saved) return JSON.parse(saved);
        } catch {}
        return { x: Math.max(10, window.innerWidth - 340), y: 16 };
    });

    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
    const hasMovedRef = useRef(false);

    // Keep within bounds on window resize
    useEffect(() => {
        const handleResize = () => {
            setButtonPos((prev) => {
                const maxX = window.innerWidth - 70;
                const maxY = window.innerHeight - 70;
                return {
                    x: Math.max(10, Math.min(prev.x, maxX)),
                    y: Math.max(10, Math.min(prev.y, maxY))
                };
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Drag handlers for Floating Button
    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        isDraggingRef.current = true;
        hasMovedRef.current = false;
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            posX: buttonPos.x,
            posY: buttonPos.y
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - dragStartRef.current.mouseX;
        const dy = e.clientY - dragStartRef.current.mouseY;

        if (Math.hypot(dx, dy) > 4) {
            hasMovedRef.current = true;
        }

        const newX = Math.max(10, Math.min(window.innerWidth - 70, dragStartRef.current.posX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 70, dragStartRef.current.posY + dy));

        setButtonPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            try {
                localStorage.setItem('floating_notepad_button_pos', JSON.stringify(buttonPos));
            } catch {}
        }
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    // Touch event handlers for mobile
    const handleTouchStart = (e) => {
        const touch = e.touches[0];
        isDraggingRef.current = true;
        hasMovedRef.current = false;
        dragStartRef.current = {
            mouseX: touch.clientX,
            mouseY: touch.clientY,
            posX: buttonPos.x,
            posY: buttonPos.y
        };
    };

    const handleTouchMove = (e) => {
        if (!isDraggingRef.current) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartRef.current.mouseX;
        const dy = touch.clientY - dragStartRef.current.mouseY;

        if (Math.hypot(dx, dy) > 4) {
            hasMovedRef.current = true;
        }

        const newX = Math.max(10, Math.min(window.innerWidth - 70, dragStartRef.current.posX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 70, dragStartRef.current.posY + dy));

        setButtonPos({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            try {
                localStorage.setItem('floating_notepad_button_pos', JSON.stringify(buttonPos));
            } catch {}
        }
    };

    const handleClick = () => {
        if (hasMovedRef.current) {
            hasMovedRef.current = false;
            return;
        }
        toggleOpen();
    };

    return (
        <>
            {/* Draggable Floating Action Button */}
            <div
                style={{
                    position: 'fixed',
                    left: `${buttonPos.x}px`,
                    top: `${buttonPos.y}px`,
                    zIndex: 9999
                }}
                className="group touch-none select-none cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <button
                    onClick={handleClick}
                    className={`relative w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-200 active:scale-95 border-2 border-white/30 ${
                        isOpen 
                            ? 'bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 shadow-amber-600/50 ring-2 ring-amber-300' 
                            : 'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 shadow-amber-500/40 hover:scale-105 hover:shadow-amber-500/60'
                    }`}
                    title="Drag to move • Click to toggle Notepad"
                >
                    {isOpen ? <MdClose size={24} /> : <MdStickyNote2 size={24} />}

                    {/* Drag hint handle icon overlay */}
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-white/30 dark:bg-slate-700/70 backdrop-blur-md rounded-full flex items-center justify-center text-white text-[9px] opacity-80 group-hover:opacity-100">
                        <MdDragIndicator size={10} />
                    </div>
                </button>

                {/* Floating Tooltip / Label */}
                {!isOpen && (
                    <div className="absolute right-16 top-2 hidden group-hover:flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-xl border border-slate-800 pointer-events-none">
                        <span>Pinned Notepad</span>
                        <span className="text-[10px] opacity-60 font-mono">(Drag me)</span>
                    </div>
                )}
            </div>

            {/* Floating Popover Notepad Window */}
            {isOpen && (
                <div 
                    className="fixed bottom-24 right-6 sm:right-10 w-[92vw] sm:w-[420px] h-[520px] max-h-[80vh] z-[9998] shadow-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden animate-fade-in-up backdrop-blur-xl"
                >
                    {/* Window Header with Drag, Pin & Close controls */}
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
