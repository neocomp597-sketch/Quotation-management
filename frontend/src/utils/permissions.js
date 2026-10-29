/**
 * Action-level permissions (mirrors backend/config/authorization.js).
 *
 * A screen's own key is its View permission; "<key>:create", "<key>:modify" and
 * "<key>:delete" are its actions. Which actions a screen has comes from the server
 * (`permissionActions`); a screen it does not list has all four.
 */
export const PERMISSION_ACTIONS = [
    { key: 'view', label: 'View' },
    { key: 'create', label: 'Create' },
    { key: 'modify', label: 'Modify' },
    { key: 'delete', label: 'Delete' },
];

const ALL_ACTIONS = PERMISSION_ACTIONS.map((action) => action.key);

export const actionKey = (key, action) => (action === 'view' ? key : `${key}:${action}`);

export const actionsFor = (key, permissionActions) => permissionActions?.[key] || ALL_ACTIONS;

export const childKeysFor = (group) => Array.from(new Set((group?.children || []).map((child) => child.key)));

/**
 * True when `permissions` allow `action` on `key`. An action the screen does not
 * have is decided by Modify, or by View when there is nothing to modify. A missing
 * flag (a server without action-level permissions) follows View.
 */
export const permissionAllows = (permissions = {}, key, action = 'view', permissionActions) => {
    if (!permissions?.[key]) return false;
    if (action === 'view') return true;

    const actions = actionsFor(key, permissionActions);
    const effective = actions.includes(action) ? action : (actions.includes('modify') ? 'modify' : 'view');
    if (effective === 'view') return true;

    const flag = permissions[actionKey(key, effective)];
    return typeof flag === 'boolean' ? flag : true;
};

// Screens given a switch of their own after users were saved with the switch that used to cover
// them; until the user is saved again they take that switch's values (as on the server).
const SPLIT_PERMISSION_SOURCES = {
    master_serial_transfer: 'master_serials',
};

/** `saved` with the old switch's values copied to each split-out screen that has none of its own. */
const withSplitPermissions = (saved = {}, permissionActions) => {
    const next = { ...saved };
    Object.entries(SPLIT_PERMISSION_SOURCES).forEach(([key, source]) => {
        if (typeof next[key] === 'boolean' || typeof next[source] !== 'boolean') return;
        next[key] = next[source];
        actionsFor(key, permissionActions).forEach((action) => {
            const value = next[actionKey(source, action)];
            if (action !== 'view' && typeof value === 'boolean') next[actionKey(key, action)] = value;
        });
    });
    return next;
};

/** Every module key the server knows, plus any key used by the given menu groups. */
const moduleKeysOf = (groups, permissionActions) => Array.from(new Set([
    ...Object.keys(permissionActions || {}),
    ...groups.flatMap((group) => (group.children?.length ? childKeysFor(group) : [group.key])),
]));

/**
 * A user's effective permissions: the role's permissions with the user's overrides
 * on top (same rules as the server). An override holding only View, saved before
 * action-level permissions, carries its View value to the actions.
 */
export const mergeUserPermissions = (groups, rolePermissions = {}, savedCustom = {}, permissionActions, lockedViewKeys = []) => {
    const custom = withSplitPermissions(savedCustom || {}, permissionActions);
    const locked = new Set(lockedViewKeys);
    const merged = {};

    moduleKeysOf(groups, permissionActions).forEach((key) => {
        const hasViewOverride = typeof custom?.[key] === 'boolean';
        const view = locked.has(key) || (hasViewOverride ? custom[key] : Boolean(rolePermissions[key]));
        merged[key] = view;

        actionsFor(key, permissionActions).forEach((action) => {
            if (action === 'view') return;
            const flag = actionKey(key, action);
            const value = typeof custom?.[flag] === 'boolean'
                ? custom[flag]
                : hasViewOverride ? custom[key] : Boolean(rolePermissions[flag] ?? rolePermissions[key]);
            merged[flag] = view && value;
        });
    });

    return withGroupKeys(groups, merged);
};

/** Group keys are on when any of their screens can be viewed. */
export const withGroupKeys = (groups, permissions) => {
    const next = { ...permissions };
    groups.forEach((group) => {
        const keys = childKeysFor(group);
        if (keys.length) next[group.key] = keys.some((key) => Boolean(next[key]));
    });
    return next;
};

/** Every flag of `key` (View and its actions). */
export const flagsOf = (key, permissionActions) => actionsFor(key, permissionActions).map((action) => actionKey(key, action));

/** True when any flag of `key` differs between the two permission sets. */
export const differsFrom = (key, permissions = {}, baseline = {}, permissionActions) => (
    flagsOf(key, permissionActions).some((flag) => Boolean(permissions[flag]) !== Boolean(baseline[flag]))
);

/** True when the two permission sets grant the same thing on every given screen. */
export const samePermissions = (a = {}, b = {}, keys = [], permissionActions) => (
    keys.every((key) => !differsFrom(key, a, b, permissionActions))
);

/**
 * Sets one flag. Turning View off also turns off the screen's actions (nothing can
 * be done on a screen that cannot be opened); turning View on grants View only.
 * Create, Modify and Delete never change each other.
 */
export const setPermissionFlag = (groups, permissions, key, action, value, permissionActions) => {
    const next = { ...permissions };
    if (action === 'view') {
        next[key] = value;
        if (!value) {
            actionsFor(key, permissionActions).forEach((other) => {
                if (other !== 'view') next[actionKey(key, other)] = false;
            });
        }
    } else if (next[key]) {
        next[actionKey(key, action)] = value;
    }
    return withGroupKeys(groups, next);
};

/**
 * Sets one action on every screen of a group (the "All" row). View follows the
 * module switch rule; an action is only given on screens that can be viewed.
 * Locked screens keep their View.
 */
export const setGroupAction = (groups, permissions, group, action, value, permissionActions, lockedViewKeys = []) => {
    const locked = new Set(lockedViewKeys);
    let next = { ...permissions };
    childKeysFor(group).forEach((key) => {
        if (!actionsFor(key, permissionActions).includes(action)) return;
        if (action === 'view' && !value && locked.has(key)) return;
        next = setPermissionFlag(groups, next, key, action, value, permissionActions);
    });
    return next;
};

/**
 * State of one column in a group: 'on' when every screen that has the action
 * allows it, 'partial' when some do, 'off' otherwise, 'none' when no screen has it.
 */
export const groupActionState = (group, permissions, action, permissionActions) => {
    const keys = childKeysFor(group).filter((key) => actionsFor(key, permissionActions).includes(action));
    if (!keys.length) return 'none';
    const enabled = keys.filter((key) => Boolean(permissions[actionKey(key, action)])).length;
    if (enabled === 0) return 'off';
    return enabled === keys.length ? 'on' : 'partial';
};
