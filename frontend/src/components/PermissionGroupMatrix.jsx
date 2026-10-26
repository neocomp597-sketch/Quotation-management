import React, { useEffect, useRef } from 'react';
import { MdExpandMore } from 'react-icons/md';
import {
    PERMISSION_ACTIONS,
    actionKey,
    actionsFor,
    childKeysFor,
    differsFrom,
    groupActionState,
    setGroupAction,
    setPermissionFlag,
} from '../utils/permissions';

const Checkbox = ({ checked, indeterminate = false, disabled, onChange, label, title }) => {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
        <input
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            aria-label={label}
            title={title}
            className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 accent-primary-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        />
    );
};

/**
 * One permission group (module) of the Authorization page: the module switch in
 * the header and, when expanded, a View / Create / Modify / Delete grid of its
 * submodules with an "All submodules" row for setting a whole column at once.
 *
 * Module switch: off removes every permission in the module; on gives View on all
 * of its submodules and leaves Create, Modify and Delete to be granted separately.
 */
const PermissionGroupMatrix = ({
    group,
    groups,
    permissions = {},
    baseline,
    permissionActions,
    lockedViewKeys = [],
    expanded,
    onToggleExpand,
    onChange,
    disabled = false,
    variant = 'row',
}) => {
    const children = group.children || [];
    const childKeys = childKeysFor(group);
    const locked = new Set(lockedViewKeys);
    const enabledChildrenCount = childKeys.filter((key) => permissions[key]).length;
    const hasPartialAccess = childKeys.length ? enabledChildrenCount > 0 : Boolean(permissions[group.key]);
    const hasFullAccess = childKeys.length ? enabledChildrenCount === childKeys.length : hasPartialAccess;
    const isCard = variant === 'card';

    const toggleModule = () => {
        onChange(setGroupAction(groups, permissions, group, 'view', !hasFullAccess, permissionActions, lockedViewKeys));
    };

    const toggleColumn = (action, state) => {
        onChange(setGroupAction(groups, permissions, group, action, state !== 'on', permissionActions, lockedViewKeys));
    };

    const toggleCell = (key, action) => {
        onChange(setPermissionFlag(groups, permissions, key, action, !permissions[actionKey(key, action)], permissionActions));
    };

    return (
        <div className={isCard
            ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 shadow-2xs'
            : 'space-y-2 border-b border-slate-50 dark:border-slate-800/60 pb-3 last:border-0 last:pb-0'}
        >
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={onToggleExpand}
                    aria-expanded={expanded}
                    className="flex items-center gap-2 text-left hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                    <div className={`transition-transform duration-200 ${expanded ? 'rotate-0' : '-rotate-90'}`}>
                        <MdExpandMore size={isCard ? 16 : 18} className={hasPartialAccess ? 'text-primary-600 dark:text-primary-400' : 'text-slate-300 dark:text-slate-600'} />
                    </div>
                    <span className={`text-xs font-bold transition-colors ${hasPartialAccess ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {group.label}
                    </span>
                    {children.length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${hasPartialAccess ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                            {enabledChildrenCount}/{childKeys.length}
                        </span>
                    )}
                </button>

                <label
                    title={hasFullAccess ? 'Turn off: removes all access to this module' : 'Turn on: gives View on every submodule'}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${hasFullAccess ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'} ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <input
                        type="checkbox"
                        className="sr-only"
                        checked={hasFullAccess}
                        disabled={disabled}
                        onChange={toggleModule}
                        aria-label={`${group.label} module access`}
                    />
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hasFullAccess ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </label>
            </div>

            {expanded && children.length > 0 && (
                <div className={`${isCard ? '' : 'ml-6'} overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700/70 animate-fade-in`}>
                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/60 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                <th className="text-left font-black px-2.5 py-1.5">Submodule</th>
                                {PERMISSION_ACTIONS.map((action) => (
                                    <th key={action.key} className="w-12 px-1 py-1.5 text-center font-black">{action.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                                <td className="px-2.5 py-1.5 font-bold text-slate-600 dark:text-slate-300">All submodules</td>
                                {PERMISSION_ACTIONS.map((action) => {
                                    const state = groupActionState(group, permissions, action.key, permissionActions);
                                    const noneViewable = action.key !== 'view' && enabledChildrenCount === 0;
                                    return (
                                        <td key={action.key} className="px-1 py-1.5 text-center">
                                            {state === 'none' ? (
                                                <span className="text-slate-300 dark:text-slate-600">—</span>
                                            ) : (
                                                <Checkbox
                                                    checked={state === 'on'}
                                                    indeterminate={state === 'partial'}
                                                    disabled={disabled || noneViewable}
                                                    onChange={() => toggleColumn(action.key, state)}
                                                    label={`${action.label} for all ${group.label} submodules`}
                                                    title={noneViewable ? 'Turn on View first' : `${action.label} for every submodule`}
                                                />
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                            {children.map((child, index) => {
                                const viewOn = Boolean(permissions[child.key]);
                                const actions = actionsFor(child.key, permissionActions);
                                const isOverridden = baseline && differsFrom(child.key, permissions, baseline, permissionActions);
                                return (
                                    <tr key={`${child.key}-${index}`}>
                                        <td className="px-2.5 py-1.5 max-w-0 w-full">
                                            <span
                                                title={isOverridden ? `${child.label}: differs from the role` : child.description || child.label}
                                                className={`block truncate ${isOverridden ? 'font-bold text-amber-700 dark:text-amber-400' : viewOn ? 'font-medium text-slate-800 dark:text-slate-200' : 'font-medium text-slate-400 dark:text-slate-500'}`}
                                            >
                                                ↳ {child.label}
                                            </span>
                                        </td>
                                        {PERMISSION_ACTIONS.map((action) => {
                                            if (!actions.includes(action.key)) {
                                                return (
                                                    <td key={action.key} className="px-1 py-1.5 text-center text-slate-300 dark:text-slate-600" title="Not applicable to this screen">—</td>
                                                );
                                            }
                                            const isLockedView = action.key === 'view' && locked.has(child.key);
                                            const needsView = action.key !== 'view' && !viewOn;
                                            return (
                                                <td key={action.key} className="px-1 py-1.5 text-center">
                                                    <Checkbox
                                                        checked={Boolean(permissions[actionKey(child.key, action.key)])}
                                                        disabled={disabled || isLockedView || needsView}
                                                        onChange={() => toggleCell(child.key, action.key)}
                                                        label={`${action.label}: ${child.label}`}
                                                        title={isLockedView ? 'Always available to this role' : needsView ? 'Turn on View first' : `${action.label}: ${child.label}`}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default PermissionGroupMatrix;
