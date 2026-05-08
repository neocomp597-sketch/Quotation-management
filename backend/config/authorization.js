const MENU_GROUPS = [
    { key: 'dashboard', label: 'Dashboard', description: 'Main dashboard and KPI overview' },
    { key: 'master', label: 'Master', description: 'Customers, vendors, products, MGRs, attributes and terms' },
    { key: 'enquiry', label: 'Enquiry', description: 'Leads, enquiries and analytics' },
    { key: 'quotation', label: 'Quotation', description: 'Quotation screens and actions' },
    { key: 'sale', label: 'Sale', description: 'Sales voucher and invoice workflow' },
    { key: 'purchase', label: 'Purchase', description: 'Purchase and GRN navigation group' },
    { key: 'planning', label: 'Planning', description: 'Revenue planning and simulation screens' },
    { key: 'reports', label: 'Reports', description: 'Reporting, analytics and data exports' },
    { key: 'settings', label: 'Settings', description: 'User profile and company configuration' },
    { key: 'admin', label: 'Admin', description: 'Authorization and admin-only configuration' }
];

const ROLE_OPTIONS = ['admin', 'manager', 'sales'];

const ROLE_LABELS = {
    admin: 'Admin',
    manager: 'Manager',
    sales: 'Sales'
};

const buildPermissions = (enabledKeys = []) => {
    const enabledSet = new Set(enabledKeys);
    return MENU_GROUPS.reduce((permissions, group) => {
        permissions[group.key] = enabledSet.has(group.key);
        return permissions;
    }, {});
};

const FULL_ACCESS_KEYS = MENU_GROUPS.map((group) => group.key);

// Manager: everything except the admin panel
// Sales: lightweight access — dashboard, enquiry, quotation only
const DEFAULT_ROLE_PERMISSIONS = {
    admin:   buildPermissions(FULL_ACCESS_KEYS),
    manager: buildPermissions(['dashboard', 'master', 'enquiry', 'quotation', 'sale', 'purchase', 'planning', 'reports', 'settings']),
    sales:   buildPermissions(['dashboard', 'enquiry', 'quotation'])
};

/**
 * Validates and normalises a permission input object.
 * ALWAYS returns a key for every MENU_GROUP — unknown or non-boolean values
 * default to false so that partial saves cannot leak back into defaults.
 */
const sanitizePermissions = (input = {}) => {
    return MENU_GROUPS.reduce((permissions, group) => {
        permissions[group.key] = typeof input[group.key] === 'boolean'
            ? input[group.key]
            : false;
        return permissions;
    }, {});
};

/**
 * Merges stored DB permissions with role defaults.
 * Admin is always fully locked — no stored overrides apply.
 * For other roles, a stored false is respected (not overwritten by defaults).
 */
const resolvePermissions = (role, storedPermissions = {}) => {
    if (role === 'admin') {
        return { ...DEFAULT_ROLE_PERMISSIONS.admin };
    }

    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || buildPermissions([]);

    return MENU_GROUPS.reduce((permissions, group) => {
        const stored = storedPermissions[group.key];
        const hasStoredValue = typeof stored === 'boolean';
        permissions[group.key] = hasStoredValue ? stored : Boolean(defaults[group.key]);
        return permissions;
    }, {});
};

module.exports = {
    MENU_GROUPS,
    ROLE_OPTIONS,
    ROLE_LABELS,
    DEFAULT_ROLE_PERMISSIONS,
    buildPermissions,
    sanitizePermissions,
    resolvePermissions
};
