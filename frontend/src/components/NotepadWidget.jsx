import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MdStickyNote2,
    MdSave,
    MdDeleteOutline,
    MdContentCopy,
    MdCheck,
    MdSync,
    MdLock,
    MdCheckBox,
    MdCheckBoxOutlineBlank,
    MdFormatListNumbered,
    MdFormatListBulleted,
    MdPlaylistAdd,
    MdEdit,
    MdCheckCircle,
    MdAdd
} from 'react-icons/md';
import { toast } from 'react-toastify';
import { userService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const NotepadWidget = ({ isFloating = false, compact = false, onClose = null }) => {
    const { user } = useAuth();
    const userId = user?._id || user?.id || 'guest';
    const storageKey = `crm_personal_note_${userId}`;

    const [note, setNote] = useState(() => {
        try {
            return localStorage.getItem(storageKey) || '';
        } catch {
            return '';
        }
    });

    const [viewMode, setViewMode] = useState('text'); // 'text' | 'checklist'
    const [saveState, setSaveState] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
    const [lastSavedTime, setLastSavedTime] = useState(null);
    const [newTaskText, setNewTaskText] = useState('');

    const textareaRef = useRef(null);
    const saveTimerRef = useRef(null);

    // Sync from API on mount
    useEffect(() => {
        let isMounted = true;
        const fetchRemoteNote = async () => {
            try {
                const res = await userService.getNote();
                if (isMounted && res.data && typeof res.data.note === 'string') {
                    setNote(res.data.note);
                    try {
                        localStorage.setItem(storageKey, res.data.note);
                    } catch {}
                    setSaveState('saved');
                }
            } catch (err) {
                console.error("Failed to load personal note from server", err);
            }
        };

        fetchRemoteNote();
        return () => {
            isMounted = false;
        };
    }, [storageKey]);

    // Save handler (both to API and localStorage)
    const persistNote = useCallback(async (contentToSave) => {
        setSaveState('saving');
        try {
            localStorage.setItem(storageKey, contentToSave);
            await userService.updateNote(contentToSave);
            setSaveState('saved');
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } catch (err) {
            console.error("Failed to save note to server", err);
            setSaveState('unsaved');
        }
    }, [storageKey]);

    // Auto-save debouncing
    const handleChange = (e) => {
        const value = e.target.value;
        updateNoteContent(value);
    };

    const updateNoteContent = (newContent) => {
        setNote(newContent);
        setSaveState('unsaved');
        try {
            localStorage.setItem(storageKey, newContent);
        } catch {}

        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(() => {
            persistNote(newContent);
        }, 1000);
    };

    // Auto sequence continuation on Enter key
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const selectionStart = textarea.selectionStart;
            const textBeforeCursor = note.substring(0, selectionStart);
            const textAfterCursor = note.substring(selectionStart);

            const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
            const currentLine = textBeforeCursor.substring(currentLineStart);

            const checkboxMatch = currentLine.match(/^(\s*)\[([ xX])\]\s*/);
            const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s*/);
            const bulletMatch = currentLine.match(/^(\s*)([•\-\*])\s*/);

            if (checkboxMatch) {
                const indent = checkboxMatch[1];
                const content = currentLine.substring(checkboxMatch[0].length);
                if (!content.trim()) {
                    e.preventDefault();
                    const newText = note.substring(0, currentLineStart) + textAfterCursor;
                    updateNoteContent(newText);
                    setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = currentLineStart;
                    }, 0);
                    return;
                }
                e.preventDefault();
                const prefix = `\n${indent}[ ] `;
                const newText = textBeforeCursor + prefix + textAfterCursor;
                updateNoteContent(newText);
                setTimeout(() => {
                    const newPos = selectionStart + prefix.length;
                    textarea.selectionStart = textarea.selectionEnd = newPos;
                }, 0);
            } else if (numberMatch) {
                const indent = numberMatch[1];
                const nextNum = parseInt(numberMatch[2], 10) + 1;
                const content = currentLine.substring(numberMatch[0].length);
                if (!content.trim()) {
                    e.preventDefault();
                    const newText = note.substring(0, currentLineStart) + textAfterCursor;
                    updateNoteContent(newText);
                    setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = currentLineStart;
                    }, 0);
                    return;
                }
                e.preventDefault();
                const prefix = `\n${indent}${nextNum}. `;
                const newText = textBeforeCursor + prefix + textAfterCursor;
                updateNoteContent(newText);
                setTimeout(() => {
                    const newPos = selectionStart + prefix.length;
                    textarea.selectionStart = textarea.selectionEnd = newPos;
                }, 0);
            } else if (bulletMatch) {
                const indent = bulletMatch[1];
                const bulletChar = bulletMatch[2];
                const content = currentLine.substring(bulletMatch[0].length);
                if (!content.trim()) {
                    e.preventDefault();
                    const newText = note.substring(0, currentLineStart) + textAfterCursor;
                    updateNoteContent(newText);
                    setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = currentLineStart;
                    }, 0);
                    return;
                }
                e.preventDefault();
                const prefix = `\n${indent}${bulletChar} `;
                const newText = textBeforeCursor + prefix + textAfterCursor;
                updateNoteContent(newText);
                setTimeout(() => {
                    const newPos = selectionStart + prefix.length;
                    textarea.selectionStart = textarea.selectionEnd = newPos;
                }, 0);
            }
        }
    };

    // Insert Checkbox Prefix
    const insertCheckbox = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const textBefore = note.substring(0, start);
        const textAfter = note.substring(start);
        
        // If empty line or start of line, prepend [ ]
        const isStartOfLine = start === 0 || note[start - 1] === '\n';
        const prefix = isStartOfLine ? '[ ] ' : '\n[ ] ';
        const newText = textBefore + prefix + textAfter;
        updateNoteContent(newText);

        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
        }, 0);
    };

    // Insert Sequence Number (1., 2., 3.)
    const insertSequence = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;

        // Calculate next number sequence
        const lines = note.substring(0, start).split('\n');
        let lastNum = 0;
        lines.forEach(l => {
            const m = l.match(/^\s*(\d+)\./);
            if (m) lastNum = parseInt(m[1], 10);
        });

        const nextNum = lastNum + 1;
        const isStartOfLine = start === 0 || note[start - 1] === '\n';
        const prefix = isStartOfLine ? `${nextNum}. ` : `\n${nextNum}. `;
        const newText = note.substring(0, start) + prefix + note.substring(start);
        updateNoteContent(newText);

        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
        }, 0);
    };

    // Insert Bullet Point
    const insertBullet = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const isStartOfLine = start === 0 || note[start - 1] === '\n';
        const prefix = isStartOfLine ? '• ' : '\n• ';
        const newText = note.substring(0, start) + prefix + note.substring(start);
        updateNoteContent(newText);

        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
        }, 0);
    };

    // Toggle specific line in interactive checklist view
    const toggleChecklistItem = (lineIndex) => {
        const lines = note.split('\n');
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        const targetLine = lines[lineIndex];
        if (targetLine.includes('[ ]')) {
            lines[lineIndex] = targetLine.replace('[ ]', '[x]');
        } else if (targetLine.includes('[x]') || targetLine.includes('[X]')) {
            lines[lineIndex] = targetLine.replace(/\[[xX]\]/, '[ ]');
        } else {
            // If line wasn't formatted as checkbox, convert it to completed
            lines[lineIndex] = `[x] ${targetLine}`;
        }

        const newText = lines.join('\n');
        updateNoteContent(newText);
    };

    // Add task from interactive checklist mode
    const handleAddChecklistItem = (e) => {
        e.preventDefault();
        if (!newTaskText.trim()) return;
        const itemLine = `[ ] ${newTaskText.trim()}`;
        const newText = note ? `${note}\n${itemLine}` : itemLine;
        updateNoteContent(newText);
        setNewTaskText('');
    };

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    const handleManualSave = () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        persistNote(note);
        toast.success("Notepad saved!", { autoClose: 1500 });
    };

    const handleClear = () => {
        if (!note.trim()) return;
        if (window.confirm("Are you sure you want to clear your personal notes?")) {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            setNote('');
            persistNote('');
            toast.info("Notepad cleared");
        }
    };

    const handleCopy = () => {
        if (!note.trim()) {
            toast.info("Notepad is empty");
            return;
        }
        navigator.clipboard.writeText(note);
        toast.success("Notes copied to clipboard!", { autoClose: 1500 });
    };

    const charCount = note.length;
    const lines = note ? note.split('\n') : [];
    const lineCount = lines.length;

    // Parse checklist stats
    const totalCheckboxes = lines.filter(l => /\[[ xX]\]/.test(l)).length;
    const completedCheckboxes = lines.filter(l => /\[[xX]\]/.test(l)).length;

    return (
        <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden transition-all duration-300 ${isFloating ? 'h-full' : 'w-full'}`}>
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent dark:from-amber-500/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                        <MdStickyNote2 size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">Personal Notepad</h3>
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                <MdLock size={10} /> Private
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Quick tasks, sequence lists & reminders</p>
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                    {saveState === 'saving' && (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-600 animate-pulse">
                            <MdSync className="animate-spin" size={14} /> Saving...
                        </span>
                    )}
                    {saveState === 'saved' && (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <MdCheck size={14} /> {lastSavedTime ? `Saved ${lastSavedTime}` : 'Saved'}
                        </span>
                    )}
                    {saveState === 'unsaved' && (
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                            Unsaved
                        </span>
                    )}
                </div>
            </div>

            {/* Primary Action Toolbar */}
            <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                {/* Main Action Buttons */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleManualSave}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        title="Save notes"
                    >
                        <MdSave size={15} /> Save
                    </button>
                    <button
                        onClick={handleCopy}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
                        title="Copy to clipboard"
                    >
                        <MdContentCopy size={14} /> Copy
                    </button>
                    <button
                        onClick={handleClear}
                        disabled={!note.trim()}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Clear notepad"
                    >
                        <MdDeleteOutline size={15} /> Clear
                    </button>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center bg-slate-200/60 dark:bg-slate-700/60 p-0.5 rounded-xl text-xs font-bold">
                    <button
                        onClick={() => setViewMode('text')}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                            viewMode === 'text'
                                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                        title="Plain Text Editor"
                    >
                        <MdEdit size={14} /> Text
                    </button>
                    <button
                        onClick={() => setViewMode('checklist')}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                            viewMode === 'checklist'
                                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                        title="Interactive Checklist Mode"
                    >
                        <MdCheckBox size={14} /> Tasks {totalCheckboxes > 0 && `(${completedCheckboxes}/${totalCheckboxes})`}
                    </button>
                </div>
            </div>

            {/* Sequence & Formatting Shortcut Bar (Only in Text Mode) */}
            {viewMode === 'text' && (
                <div className="px-4 py-1.5 bg-amber-50/40 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs">
                        <span className="text-[10px] font-black uppercase text-amber-800/60 dark:text-amber-400/60 mr-1 tracking-wider">Quick Format:</span>
                        <button
                            onClick={insertCheckbox}
                            className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 shadow-2xs"
                            title="Add Checkbox item [ ]"
                        >
                            <MdCheckBoxOutlineBlank className="text-amber-600" size={14} /> Checkbox
                        </button>
                        <button
                            onClick={insertSequence}
                            className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 shadow-2xs"
                            title="Add Number Sequence 1. 2. 3."
                        >
                            <MdFormatListNumbered className="text-amber-600" size={14} /> 1, 2, 3 Sequence
                        </button>
                        <button
                            onClick={insertBullet}
                            className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 shadow-2xs"
                            title="Add Bullet Point •"
                        >
                            <MdFormatListBulleted className="text-amber-600" size={14} /> Bullet
                        </button>
                    </div>

                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hidden sm:block">
                        {charCount} chars • {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                    </div>
                </div>
            )}

            {/* Main Content Body */}
            <div className="relative flex-1 p-3 sm:p-4 bg-amber-50/10 dark:bg-slate-900/40 overflow-y-auto">
                {viewMode === 'text' ? (
                    <textarea
                        ref={textareaRef}
                        value={note}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type daily notes, tasks, or customer points...&#10;&#10;💡 Tip: Click 'Checkbox' or '1, 2, 3 Sequence' above! Pressing Enter will automatically continue your list."
                        className="w-full h-full min-h-[180px] bg-transparent text-slate-800 dark:text-slate-100 text-sm font-medium leading-relaxed outline-none resize-y placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono"
                        spellCheck="false"
                    />
                ) : (
                    /* Interactive Checklist Mode */
                    <div className="space-y-3">
                        {lines.length === 0 || (lines.length === 1 && !lines[0].trim()) ? (
                            <div className="p-8 text-center text-slate-400 font-medium text-xs">
                                No task items found. Add a task below or switch to Text mode to start typing!
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {lines.map((line, index) => {
                                    if (!line.trim()) return null;
                                    const isChecked = /\[[xX]\]/.test(line);
                                    const hasCheckbox = /\[[ xX]\]/.test(line);

                                    // Strip checkbox markup for display
                                    const displayText = line.replace(/^\s*\[[ xX]\]\s*/, '').replace(/^\s*[\d+\.•\-]\s*/, '');

                                    return (
                                        <div
                                            key={index}
                                            onClick={() => toggleChecklistItem(index)}
                                            className={`group flex items-start gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer select-none ${
                                                isChecked
                                                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 text-slate-400 line-through'
                                                    : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-amber-400'
                                            }`}
                                        >
                                            <div className="mt-0.5 shrink-0">
                                                {isChecked ? (
                                                    <MdCheckCircle className="text-emerald-500" size={18} />
                                                ) : (
                                                    <MdCheckBoxOutlineBlank className="text-amber-500 group-hover:scale-110 transition-transform" size={18} />
                                                )}
                                            </div>
                                            <span className="text-sm font-semibold flex-1 leading-snug break-words">
                                                {displayText || line}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Add Task Input in Checklist View */}
                        <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <input
                                type="text"
                                value={newTaskText}
                                onChange={(e) => setNewTaskText(e.target.value)}
                                placeholder="Add new task item..."
                                className="flex-1 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-amber-500"
                            />
                            <button
                                type="submit"
                                disabled={!newTaskText.trim()}
                                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm disabled:opacity-40"
                            >
                                <MdAdd size={16} /> Add Task
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotepadWidget;
