import React, { useState } from 'react';
import { MdFilterAlt, MdExpandMore, MdExpandLess } from 'react-icons/md';

const MGR_LEVELS = [['mgr1', 'MGR 1'], ['mgr2', 'MGR 2'], ['mgr3', 'MGR 3'], ['mgr4', 'MGR 4'], ['mgr5', 'MGR 5']];

const mgrLabel = (mgr) => (mgr.description && mgr.description !== mgr.code ? `${mgr.code} - ${mgr.description}` : mgr.code);

/**
 * The user's MGR access (Authorization > MGR Access), shown above a list when it limits what they
 * see: `mgrAccess` is { mgr1: [{ code, description }] } as the server sends it, or null. `noun` names
 * what is limited, e.g. "serial numbers".
 */
const MgrAccessNotice = ({ mgrAccess, noun }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    if (!mgrAccess) return null;
    const lines = MGR_LEVELS
        .filter(([key]) => mgrAccess[key]?.length)
        .map(([key, label]) => `${label}: ${mgrAccess[key].map(mgrLabel).join(', ')}`);

    return (
        <div className="mb-4 rounded-2xl border border-primary-200 bg-primary-50 p-4 transition-all duration-200">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 rounded-xl bg-primary-100 p-2 text-primary-700">
                        <MdFilterAlt size={18} />
                    </div>
                    <p className="text-sm font-black text-primary-800 truncate">
                        {lines.length ? `You see only the ${noun} of your MGR access` : 'Your MGR access has no values'}
                    </p>
                </div>
                {lines.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded((prev) => !prev)}
                        className="inline-flex items-center gap-1 shrink-0 px-2.5 py-1 text-xs font-bold text-primary-700 hover:text-primary-900 hover:bg-primary-100 rounded-lg transition-colors cursor-pointer"
                        title={isExpanded ? 'Collapse access details' : 'Expand access details'}
                    >
                        <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                        {isExpanded ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
                    </button>
                )}
            </div>
            {isExpanded && (
                <div className="mt-2 pl-11">
                    <p className="break-words text-[11px] font-semibold text-primary-700 leading-relaxed">
                        {lines.length
                            ? lines.join(' · ')
                            : 'The MGR values you were given have been removed from the Product MGR Master. Ask an administrator to set your MGR access again.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default MgrAccessNotice;
