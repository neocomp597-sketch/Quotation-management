import React, { useEffect, useState } from 'react';
import { MdClose } from 'react-icons/md';
import { stockAuditService } from '../../../services/api';
import { INPUT } from './shared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NONE = [];

// Email chips. Type or paste addresses (comma / space / newline separated) or pick a portal
// user from the suggestions; Enter, comma or leaving the field adds what was typed.
const EmailListInput = ({ value, onChange, placeholder = 'name@company.com', disabled = false, exclude = NONE, id }) => {
    const [draft, setDraft] = useState('');
    // Users found for a search term, tagged with that term.
    const [found, setFound] = useState({ term: '', users: [] });
    const [error, setError] = useState('');
    const term = draft.trim();
    const searching = term.length >= 2 && !disabled;
    const suggestions = searching && found.term === term
        ? found.users.filter(u => !value.includes(u.email) && !exclude.includes(u.email))
        : NONE;

    useEffect(() => {
        if (!searching) return undefined;
        let cancelled = false;
        const t = setTimeout(() => {
            stockAuditService.searchUsers(term)
                .then(res => { if (!cancelled) setFound({ term, users: res.data || [] }); })
                .catch(() => { if (!cancelled) setFound({ term, users: [] }); });
        }, 250);
        return () => { cancelled = true; clearTimeout(t); };
    }, [term, searching]);

    const add = (input) => {
        const parts = String(input).split(/[\s,;]+/).map(p => p.trim().toLowerCase()).filter(Boolean);
        if (!parts.length) return;
        const bad = parts.filter(p => !EMAIL_RE.test(p));
        const good = parts.filter(p => EMAIL_RE.test(p) && !value.includes(p));
        if (good.length) onChange([...value, ...good]);
        setError(bad.length ? `Not an email address: ${bad.join(', ')}` : '');
        setDraft(bad.join(' '));
    };

    const remove = (email) => onChange(value.filter(e => e !== email));

    return (
        <div>
            <div className={`${INPUT} flex flex-wrap items-center gap-1.5 min-h-[42px] !py-1.5`}>
                {value.map(email => (
                    <span key={email} className="inline-flex items-center gap-1 max-w-full rounded-lg bg-teal-50 border border-teal-100 pl-2 pr-1 py-0.5 text-xs font-bold text-teal-800">
                        <span className="truncate">{email}</span>
                        {!disabled && (
                            <button type="button" onClick={() => remove(email)} className="p-0.5 rounded hover:bg-teal-100" aria-label={`Remove ${email}`}>
                                <MdClose size={14} />
                            </button>
                        )}
                    </span>
                ))}
                {!disabled && (
                    <input
                        id={id}
                        type="email"
                        multiple
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (['Enter', ',', ';'].includes(e.key)) {
                                e.preventDefault();
                                add(draft);
                            } else if (e.key === 'Backspace' && !draft && value.length) {
                                remove(value[value.length - 1]);
                            }
                        }}
                        onPaste={(e) => {
                            const pasted = e.clipboardData.getData('text');
                            if (/[\s,;]/.test(pasted.trim())) {
                                e.preventDefault();
                                add(`${draft} ${pasted}`);
                            }
                        }}
                        onBlur={() => setTimeout(() => { if (draft.trim()) add(draft); }, 150)}
                        placeholder={value.length ? '' : placeholder}
                        className="flex-1 min-w-[160px] bg-transparent outline-none text-sm font-semibold text-slate-700 py-1"
                        autoComplete="off"
                    />
                )}
            </div>
            {suggestions.length > 0 && (
                <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-50">
                    {suggestions.map(u => (
                        <li key={u.email}>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => add(u.email)}
                                className="w-full text-left px-3 py-2 hover:bg-teal-50"
                            >
                                <span className="block text-sm font-bold text-slate-700">{u.name}</span>
                                <span className="block text-xs text-slate-500">{u.email}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {error && <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p>}
        </div>
    );
};

export default EmailListInput;
