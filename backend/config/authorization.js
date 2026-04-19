const MENU_GROUPS = [
    { key: 'dashboard', label: 'Dashboard', description: 'Main dashboard overview' },
    { key: 'master', label: 'Master', description: 'Customers, vendors, products, MGRs, attributes and terms' },
    { key: 'enquiry', label: 'Enquiry', description: 'Leads, enquiries and analytics' },
    { key: 'quotation', label: 'Quotation', description: 'Quotation screens and actions' },
    { key: 'sale', label: 'Sale', description: 'Sales voucher and invoice workflow' },
    { key: 'purchase', label: 'Purchase', description: 'Purchase and GRN navigation group' },
    { key: 'planning', label: 'Planning', description: 'Planning and simulation screens' },
    { key: 'reports', label: 'Reports', description: 'Reporting screens' },
    { key: 'settings', label: 'Settings', description: 'User and company settings' },
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

const DEFAULT_ROLE_PERMISSIONS = {
    admin: buildPermissions(FULL_ACCESS_KEYS),
    manager: buildPermissions(FULL_ACCESS_KEYS.filter((key) => key !== 'admin')),
    sales: buildPermissions(FULL_ACCESS_KEYS.filter((key) => key !== 'admin'))
};

const sanitizePermissions = (input = {}) => {
    return MENU_GROUPS.reduce((permissions, group) => {
        if (typeof input[group.key] === 'boolean') {
            permissions[group.key] = input[group.key];
        }
        return permissions;
    }, {});
};

const resolvePermissions = (role, storedPermissions = {}) => {
    if (role === 'admin') {
        return { ...DEFAULT_ROLE_PERMISSIONS.admin };
    }

    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || buildPermissions([]);

    return MENU_GROUPS.reduce((permissions, group) => {
        const hasStoredValue = Object.prototype.hasOwnProperty.call(storedPermissions, group.key);
        permissions[group.key] = hasStoredValue
            ? Boolean(storedPermissions[group.key])
            : Boolean(defaults[group.key]);
        return permissions;
    }, {});
};

module.exports = {
    MENU_GROUPS,
    ROLE_OPTIONS,
    ROLE_LABELS,
    DEFAULT_ROLE_PERMISSIONS,
    sanitizePermissions,
    resolvePermissions
};
