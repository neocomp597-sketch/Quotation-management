import React from 'react';
import { MdFilterAlt } from 'react-icons/md';

const MGR_LEVELS = [['mgr1', 'MGR 1'], ['mgr2', 'MGR 2'], ['mgr3', 'MGR 3'], ['mgr4', 'MGR 4'], ['mgr5', 'MGR 5']];

const mgrLabel = (mgr) => (mgr.description && mgr.description !== mgr.code ? `${mgr.code} - ${mgr.description}` : mgr.code);

/**
 * The user's MGR access (Authorization > MGR Access), shown above a list when it limits what they
 * see: `mgrAccess` is { mgr1: [{ code, description }] } as the server sends it, or null. `noun` names
 * what is limited, e.g. "serial numbers".
 */
const MgrAccessNotice = ({ mgrAccess, noun }) => {
    if (!mgrAccess) return null;
    const lines = MGR_LEVELS
        .filter(([key]) => mgrAccess[key]?.length)
        .map(([key, label]) => `${label}: ${mgrAccess[key].map(mgrLabel).join(', ')}`);
    return (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-4">
            <div className="shrink-0 rounded-xl bg-primary-100 p-2 text-primary-700"><MdFilterAlt size={18} /></div>
            <div className="min-w-0">
                <p className="text-sm font-black text-primary-800">
                    {lines.length ? `You see only the ${noun} of your MGR access` : 'Your MGR access has no values'}
                </p>
                <p className="mt-0.5 break-words text-[11px] font-semibold text-primary-700">
                    {lines.length
                        ? lines.join(' · ')
                        : 'The MGR values you were given have been removed from the Product MGR Master. Ask an administrator to set your MGR access again.'}
                </p>
            </div>
        </div>
    );
};

export default MgrAccessNotice;
