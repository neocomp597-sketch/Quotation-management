const MENU_GROUPS = [
    {
        key: 'dashboard',
        label: 'Dashboard',
        description: 'Main dashboard and KPI overview',
        children: [
            { key: 'dashboard_overview', label: 'Dashboard Overview', description: 'Main dashboard and KPI overview' }
        ]
    },
    {
        key: 'master',
        label: 'Master',
        description: 'Customers, vendors, products, MGRs, attributes and terms',
        children: [
            { key: 'master_customers', label: 'Customers', description: 'Customer master records' },
            { key: 'master_vendors', label: 'Vendors', description: 'Vendor master records' },
            { key: 'master_products', label: 'Products', description: 'Product master records' },
            { key: 'master_mgrs', label: 'MGRs', description: 'MGR master hierarchy' },
            { key: 'master_attributes', label: 'Attributes', description: 'Attribute master definitions' },
            { key: 'master_statuses', label: 'Status Master', description: 'Status master definitions for planning' },
            { key: 'master_terms', label: 'Terms', description: 'Terms and conditions master' },
            { key: 'master_territories', label: 'Territories', description: 'Territory master management' }
        ]
    },
    {
        key: 'enquiry',
        label: 'Enquiry',
        description: 'Leads, enquiries and analytics',
        children: [
            { key: 'enquiry_leads', label: 'Leads & Enquiries', description: 'Lead and enquiry records' },
            { key: 'enquiry_analytics', label: 'Analytics', description: 'Enquiry analytics dashboard' }
        ]
    },
    {
        key: 'meetings',
        label: 'Meetings',
        description: 'Meeting schedule and appointment management',
        children: [
            { key: 'meetings_list', label: 'Meetings List', description: 'Schedule and view meetings' }
        ]
    },
    {
        key: 'quotation',
        label: 'Sales',
        description: 'Quotation and sales invoice screens',
        children: [
            { key: 'quotation_list', label: 'Quotations', description: 'Quotation list and creation screens' },
            { key: 'sale_invoices', label: 'Create Invoice', description: 'Sales outward invoice screens' }
        ]
    },
    {
        key: 'sale',
        label: 'Material Received',
        description: 'Material received navigation group',
        children: []
    },
    {
        key: 'purchase',
        label: 'Purchase',
        description: 'Purchase and GRN navigation group',
        children: [
            { key: 'purchase_grn', label: 'GRN', description: 'Goods receipt note screens' }
        ]
    },
    {
        key: 'planning',
        label: 'Planning',
        description: 'Revenue planning and simulation screens',
        children: [
            { key: 'planning_screen', label: 'Planning Screen', description: 'Revenue planning workspace' },
            { key: 'planning_simulations', label: 'Simulations', description: 'Planning simulation screens' },
            { key: 'planning_edit_prev_year', label: 'Edit Previous Year Entries', description: 'Allow adding/editing/deleting planning entries in previous financial years' },
            { key: 'planning_view_sbu_wise', label: 'View SBU Wise Summary', description: 'Access to SBU-wise summary in Planning Screen' },
            { key: 'planning_view_segment_wise', label: 'View Segment Wise Summary', description: 'Access to Segment-wise summary in Planning Screen' },
            { key: 'planning_view_status_breakdown', label: 'View Status Breakdown Summary', description: 'Access to Status Breakdown summary in Planning Screen' }
        ]
    },
    {
        key: 'reports',
        label: 'Reports',
        description: 'Reporting, analytics and data exports',
        children: [
            { key: 'reports_main', label: 'Reports', description: 'Reporting screens' }
        ]
    },
    {
        key: 'settings',
        label: 'Settings',
        description: 'User profile and company configuration',
        children: [
            { key: 'settings_profile', label: 'Settings', description: 'User and company settings' }
        ]
    },
    {
        key: 'admin',
        label: 'Admin',
        description: 'Authorization and admin-only configuration',
        children: [
            { key: 'admin_authorization', label: 'Authorization', description: 'Role authorization controls' },
            { key: 'admin_salespersons', label: 'Salespersons', description: 'Salesperson user administration' }
        ]
    },
    {
        key: 'payroll',
        label: 'Payroll',
        description: 'Manage payroll settings, runs, calculations, and letters',
        children: [
            { key: 'payroll_employees', label: 'Employee Profiles', description: 'Manage employee salary profiles and structures' },
            { key: 'payroll_runs', label: 'Run Payroll', description: 'Create and run monthly payroll batches' },
            { key: 'payroll_payments', label: 'Payments', description: 'Record payment slips and transaction references' },
            { key: 'payroll_settings', label: 'Payroll Settings', description: 'Manage payroll month and calculation configuration' },
            { key: 'payroll_letters', label: 'Letter Management', description: 'Generate offer, appointment, promotion, and relieving letters' },
            { key: 'payroll_reports', label: 'Payroll Reports', description: 'Access monthly register, deduction logs, and allocation charts' }
        ]
    }
];

const ROLE_OPTIONS = ['admin', 'manager', 'sales'];

const ROLE_LABELS = {
    admin: 'Admin',
    manager: 'Manager',
    sales: 'Sales'
};

const getAllPermissionKeys = () => MENU_GROUPS.flatMap((group) => [
    group.key,
    ...(group.children || []).map((child) => child.key)
]);

const buildPermissions = (enabledKeys = []) => {
    const enabledSet = new Set(enabledKeys);

    return MENU_GROUPS.reduce((permissions, group) => {
        const childKeys = (group.children || []).map((child) => child.key);
        const parentEnabled = enabledSet.has(group.key);
        const anyChildEnabled = childKeys.some((key) => enabledSet.has(key));

        permissions[group.key] = parentEnabled || anyChildEnabled;
        childKeys.forEach((key) => {
            permissions[key] = parentEnabled || enabledSet.has(key);
        });

        return permissions;
    }, {});
};

const FULL_ACCESS_KEYS = getAllPermissionKeys();

// Manager: everything except the admin panel
// Sales: lightweight access - dashboard, enquiry, quotation only
const DEFAULT_ROLE_PERMISSIONS = {
    admin: buildPermissions(FULL_ACCESS_KEYS),
    manager: buildPermissions(['dashboard', 'master', 'enquiry', 'quotation', 'meetings', 'sale', 'purchase', 'planning', 'reports', 'settings']),
    sales: buildPermissions(['dashboard', 'enquiry', 'quotation', 'meetings'])
};

/**
 * Validates and normalises a permission input object. Parent-only legacy input
 * grants all children in that section so existing saved roles keep working.
 */
const sanitizePermissions = (input = {}) => {
    return MENU_GROUPS.reduce((permissions, group) => {
        const childKeys = (group.children || []).map((child) => child.key);
        const hasExplicitChildren = childKeys.some((key) => typeof input[key] === 'boolean');
        const legacyParentEnabled = input[group.key] === true && !hasExplicitChildren;
        let enabledChildren = 0;

        childKeys.forEach((key) => {
            const childEnabled = typeof input[key] === 'boolean'
                ? input[key]
                : legacyParentEnabled;

            permissions[key] = childEnabled;
            if (childEnabled) enabledChildren += 1;
        });

        permissions[group.key] = childKeys.length
            ? enabledChildren > 0
            : Boolean(input[group.key]);

        return permissions;
    }, {});
};

/**
 * Merges stored DB permissions with role defaults.
 * Admin is always fully locked - no stored overrides apply.
 * For other roles, stored child permissions are respected.
 */
const resolvePermissions = (role, storedPermissions = {}) => {
    if (role === 'admin') {
        return { ...DEFAULT_ROLE_PERMISSIONS.admin };
    }

    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || buildPermissions([]);

    return MENU_GROUPS.reduce((permissions, group) => {
        const childKeys = (group.children || []).map((child) => child.key);
        const storedParent = storedPermissions[group.key];
        const hasStoredParent = typeof storedParent === 'boolean';
        const hasStoredChildren = childKeys.some((key) => typeof storedPermissions[key] === 'boolean');
        let enabledChildren = 0;

        childKeys.forEach((key) => {
            const stored = storedPermissions[key];
            const hasStoredValue = typeof stored === 'boolean';
            const childEnabled = hasStoredValue
                ? stored
                : hasStoredParent && !hasStoredChildren
                    ? storedParent
                    : Boolean(defaults[key]);

            permissions[key] = childEnabled;
            if (childEnabled) enabledChildren += 1;
        });

        permissions[group.key] = hasStoredChildren
            ? enabledChildren > 0
            : hasStoredParent
                ? storedParent
                : Boolean(defaults[group.key]);

        return permissions;
    }, {});
};

module.exports = {
    MENU_GROUPS,
    ROLE_OPTIONS,
    ROLE_LABELS,
    DEFAULT_ROLE_PERMISSIONS,
    buildPermissions,
    getAllPermissionKeys,
    sanitizePermissions,
    resolvePermissions
};
