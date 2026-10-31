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
        description: 'Customers, employees, vendors, contacts, products, branches, state/city, MGRs, and masters',
        children: [
            { key: 'master_customers', label: 'Customers', description: 'Customer master records' },
            { key: 'payroll_employees', label: 'Employees', description: 'Employee directory and profile management' },
            { key: 'payroll_org_chart', label: 'Org Chart', description: 'Direct reporting org chart access' },
            { key: 'payroll_org_chart_full', label: 'Org Chart (Full Company)', description: 'Full company org chart access' },
            { key: 'master_vendors', label: 'Vendors', description: 'Vendor master records' },
            { key: 'master_products', label: 'Product Master', description: 'Product master records' },
            { key: 'master_bom', label: 'Product BOM Master', description: 'Create, edit and view serial-number-wise BOMs' },
            { key: 'master_type_tests', label: 'Type Test Register', description: 'Product type test certificates, validity and renewal tracking' },
            { key: 'master_contacts', label: 'Contacts', description: 'Contact management records' },
            { key: 'master_mgrs', label: 'Product MGR Master', description: 'MGR master hierarchy' },
            { key: 'master_divisions', label: 'Division Master', description: 'Division codes used by segments and invoice records' },
            { key: 'master_segments', label: 'Segment Master', description: 'Division-wise segment codes' },
            { key: 'master_attributes', label: 'Attributes', description: 'Attribute master definitions' },
            { key: 'master_statuses', label: 'Status Master', description: 'Status master definitions for planning' },
            { key: 'master_terms', label: 'Terms & Conditions', description: 'Terms and conditions master' },
            { key: 'master_territories', label: 'Territory Master', description: 'Territory master management' },
            { key: 'master_branches', label: 'Branch Master', description: 'Branch master management' },
            { key: 'state_master_create', label: 'State Master', description: 'State master management' },
            { key: 'city_master', label: 'City Master', description: 'City master management' },
            { key: 'csm_masters', label: 'Engineers Master', description: 'Field service engineers master' },
            { key: 'flowchart_view', label: 'Flowchart Builder', description: 'Visual process flowchart builder' }
        ]
    },
    {
        key: 'flowchart',
        label: 'Flowchart Builder',
        description: 'Visual process flowchart builder, auto-generation, versioning and templates',
        children: [
            { key: 'flowchart_view', label: 'View Flowcharts', description: 'Access flowchart builder and diagrams' },
            { key: 'flowchart_create', label: 'Create Flowcharts', description: 'Create and auto-generate new flowcharts' },
            { key: 'flowchart_edit', label: 'Edit Flowcharts', description: 'Modify canvas nodes, edges and versions' },
            { key: 'flowchart_delete', label: 'Delete Flowcharts', description: 'Delete flowchart diagrams' }
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
        key: 'sales_pipeline',
        label: 'Sales Pipeline',
        description: 'Deal pipeline management, forecasting, targets, and analytics',
        children: [
            { key: 'sales_dashboard', label: 'Sales Dashboard', description: 'Sales KPI dashboard overview' },
            { key: 'sales_deals', label: 'Deals', description: 'Deal board and deal management' },
            { key: 'sales_pipelines', label: 'Pipelines', description: 'Pipeline stage configuration' },
            { key: 'sales_forecasting', label: 'Forecasting', description: 'Revenue forecasting and predictions' },
            { key: 'sales_activities', label: 'Activities', description: 'Unified deal activity timeline' },
            { key: 'sales_targets', label: 'Targets', description: 'Sales target and quota management' },
            { key: 'sales_reports', label: 'Reports', description: 'Pipeline funnel, win/loss, and revenue reports' },
            { key: 'sales_analytics', label: 'Analytics', description: 'Pipeline velocity, stuck deals, and salesperson analytics' }
        ]
    },
    {
        key: 'meetings',
        label: 'Appointments',
        description: 'Meeting schedule and appointment management',
        children: [
            { key: 'meetings_list', label: 'Appointments Register', description: 'Schedule and view appointments' }
        ]
    },
    {
        key: 'cpq_masters',
        label: 'Catalog',
        description: 'Price books, pricing rules, discount policies, promotions, and currency rates',
        children: [
            { key: 'sales_price_management', label: 'Price Books & Rules', description: 'Manage price books, pricing rules, discount policies and promotions' }
        ]
    },
    {
        key: 'quotation',
        label: 'Quotations',
        description: 'Quotation registers, CPQ tools, invoices, invoice bulk upload, serial transfers, approvals, and orders',
        children: [
            { key: 'quotation_list', label: 'Quotation Register', description: 'View, create, and manage trade quotations' },
            { key: 'reports_main', label: 'Quote Conversion Report', description: 'Quotation conversion analytics' },
            { key: 'sales_cpq', label: 'Guided Selling & Configurator', description: 'Interactive product configurator and quote simulator' },
            { key: 'sale_invoices', label: 'Invoices', description: 'Billing invoices and payment schedules' },
            // Keys keep their master_ prefix from when these screens were under Master: roles,
            // user overrides and API rules are saved against them.
            { key: 'master_serials', label: 'Invoice Bulk Upload', description: 'Invoice bulk upload and serial asset management' },
            { key: 'master_serials_view_details', label: 'Invoice Bulk Upload: View Details', description: 'Open the lifecycle details of an Invoice Bulk Upload entry' },
            { key: 'master_serials_edit', label: 'Invoice Bulk Upload: Edit Entry', description: 'Change a saved Invoice Bulk Upload entry' },
            { key: 'master_serial_transfer', label: 'Serial No Transfer', description: 'Serial number ownership history; Modify allows transfers and past entries' },
            { key: 'sales_approvals', label: 'Approvals Queue', description: 'Manage discount and high-value quotation approvals' },
            { key: 'sales_orders', label: 'Sales Orders', description: 'Sales order processing and status tracking' }
        ]
    },
    {
        key: 'clm',
        label: 'Contracts',
        description: 'Contract Lifecycle Management (CLM), templates, clause library, and renewals',
        children: [
            { key: 'sales_contracts', label: 'Contract Management', description: 'CLM dashboard, contracts list, templates, and clause library' }
        ]
    },
    {
        key: 'purchase',
        label: 'Material',
        description: 'Material received and Goods receipt note (GRN)',
        children: [
            { key: 'purchase_grn', label: 'GRN Register', description: 'Goods receipt note and material tracking screens' }
        ]
    },
    {
        key: 'inventory',
        label: 'Inventory',
        description: 'Stock ledger, multi-warehouse stock, transfers, adjustments, physical audit, and alerts',
        children: [
            { key: 'inventory_dashboard', label: 'Dashboard', description: 'Stock valuation, movement feed, and KPI metrics' },
            { key: 'inventory_items', label: 'Items & Stock Matrix', description: 'Warehouse-wise stock and batch details' },
            { key: 'inventory_warehouses', label: 'Warehouses', description: 'Manage warehouses and storage bins' },
            { key: 'purchase_grn', label: 'GRN / Inward Goods', description: 'Goods receipt note and material tracking screens' },
            { key: 'inventory_stock_in', label: 'Stock In / GRN', description: 'Record inward goods receipts' },
            { key: 'inventory_stock_out', label: 'Stock Out / Dispatch', description: 'Record outward material issues' },
            { key: 'inventory_transfers', label: 'Stock Transfers', description: 'Inter-warehouse transfers and approvals' },
            { key: 'inventory_adjustments', label: 'Stock Adjustments', description: 'Damage, loss, and physical audit adjustments' },
            { key: 'inventory_stock_counts', label: 'Physical Audit', description: 'Physical count sessions and reconciliation' },
            { key: 'inventory_sap_audit', label: 'SAP Stock Audit', description: 'Create SAP B1 stock audit batches (people added to a batch open it without this)' },
            { key: 'inventory_alerts', label: 'Stock Alerts', description: 'Low-stock and expiry notification setup' },
            { key: 'inventory_reports', label: 'Valuation & Reports', description: 'Stock ledger, valuation, and dead-stock reports' }
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
            { key: 'reports_main', label: 'Reports', description: 'Reporting screens' },
            { key: 'sales_reports', label: 'Sales Reports', description: 'Sales revenue and performance reports' },
            { key: 'sales_analytics', label: 'Sales Analytics', description: 'Pipeline velocity and salesperson analytics' },
            { key: 'sales_revenue_analytics', label: 'Revenue Analytics', description: 'Revenue streams and customer cohort analytics' },
            { key: 'csm_rca', label: 'Why-Why Analysis', description: 'Five-why root cause and CAPA analytics dashboard' },
            { key: 'sales_competitors', label: 'Competitor Intel', description: 'Market competitor analysis' },
            { key: 'sales_ai_pricing', label: 'AI Pricing Insights', description: 'AI-driven pricing optimization insights' }
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
        label: 'Employee Records',
        // Salary processing (runs, payments, payslips, letters, settings, reports) has been
        // withdrawn from the app. Only the employee master data permissions remain.
        description: 'Employee directory, org chart, and department/designation masters',
        children: [
            { key: 'payroll_employees', label: 'Employees', description: 'Employee directory and profile management' },
            { key: 'payroll_org_chart', label: 'Org Chart', description: 'Direct reporting org chart access' },
            { key: 'payroll_masters', label: 'Department & Designation Masters', description: 'Manage departments and designations' }
        ]
    },
    {
        key: 'csm',
        label: 'Customer Service',
        description: 'Manage support tickets, service visits, warranties, AMCs, knowledge base, and feedback',
        children: [
            { key: 'csm_dashboard', label: 'CSM Dashboard', description: 'Overview and service analytics' },
            { key: 'csm_detail_dashboard', label: 'CSM Detail Dashboard', description: 'Resolution speed, SLA compliance, field service log, ticket charts and engineer performance' },
            { key: 'csm_tickets', label: 'Tickets Register', description: 'View, create, and resolve customer support tickets' },
            { key: 'csm_tickets', label: 'My Complaints', description: 'Complaints created by or assigned to the logged-in user' },
            { key: 'csm_tickets', label: 'My Team Complaints', description: 'Complaints for the logged-in user reporting hierarchy' },
            { key: 'csm_visits', label: 'Service Visits', description: 'Schedule and manage service engineer visits' },
            { key: 'csm_attendance', label: 'Field Engineer Attendance', description: 'View and manage field engineer check-in/out attendance register' },
            { key: 'csm_warranties_amc', label: 'Warranty & AMC', description: 'Manage customer warranty details and AMC contracts' },
            { key: 'csm_kb', label: 'Knowledge Base', description: 'Manage troubleshooting articles and FAQs' },
            { key: 'csm_masters', label: 'CSM Config', description: 'Configure categories, priorities, teams, and SLAs' },
            { key: 'csm_reports', label: 'Service Reports', description: 'Customer service analytics and resolution reports' },
            { key: 'csm_rca', label: 'RCA Report', description: 'Root Cause Analysis reports and CAPA management' }
        ]
    },
    {
        key: 'tender',
        label: 'Tenders',
        description: 'Tender dashboard, pipelines, registers, and analysis reports',
        children: [
            { key: 'tender_dashboard', label: 'Tender Dashboard', description: 'Tender KPI dashboard and charts' },
            { key: 'tender_register', label: 'Tenders Register', description: 'Tender list register and management' },
            { key: 'tender_reports', label: 'Tender Reports', description: 'Tender pipeline and win/loss reports' }
        ]
    }
];

const ROLE_OPTIONS = ['admin', 'manager', 'sales', 'employee'];

const ROLE_LABELS = {
    admin: 'Admin',
    manager: 'Manager',
    sales: 'Sales',
    employee: 'Employee'
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

// Keys added after roles were already saved inherit the key that used to gate the same screen,
// so existing users keep their access until an admin sets the new key explicitly.
const LEGACY_PERMISSION_FALLBACKS = {
    csm_rca: 'csm_dashboard',
    csm_detail_dashboard: 'csm_dashboard',
    master_serials_view_details: 'master_serials',
    master_bom: 'master_products',
    master_type_tests: 'master_products',
    master_divisions: 'master_mgrs',
    master_segments: 'master_mgrs',
    inventory_sap_audit: 'inventory_stock_counts'
};

// Switches that allow something no role could do before they were added (Invoice Bulk
// Upload entries could not be edited). A role with no saved value gets them only when it
// is the admin role, whatever its other defaults are; an admin grants them to others.
const ADMIN_DEFAULT_ONLY_KEYS = new Set(['master_serials_edit']);

// Sales has the Quotations module but not Invoice Bulk Upload or Serial No Transfer, which
// it never had while they were under Master.
const SALES_WITHHELD_KEYS = ['master_serials', 'master_serials_view_details', 'master_serials_edit', 'master_serial_transfer'];

const withKeysOff = (permissions, keys) => {
    keys.forEach((key) => { permissions[key] = false; });
    return permissions;
};

const withoutAdminOnlyKeys = (permissions) => withKeysOff(permissions, ADMIN_DEFAULT_ONLY_KEYS);

const getLegacyFallback = (input, key) => {
    const fallbackKey = LEGACY_PERMISSION_FALLBACKS[key];
    return fallbackKey && typeof input[fallbackKey] === 'boolean' ? input[fallbackKey] : undefined;
};

// Screens moved to another module after roles were saved, with the module they came from.
// A role saved with module switches only (before screens had switches of their own) gives
// each screen its module's switch. A moved screen keeps taking its old module's switch and
// does not count as a saved screen of its new module, so the move changes nobody's access.
const MOVED_SCREEN_ORIGINS = {
    master_serials: 'master',
    master_serials_view_details: 'master',
    master_serials_edit: 'master',
    master_serial_transfer: 'master'
};

// Each module's screens as they were before those moves.
const ORIGINAL_MODULE_SCREENS = MENU_GROUPS.reduce((modules, group) => {
    modules[group.key] = (group.children || []).map((child) => child.key).filter((key) => !MOVED_SCREEN_ORIGINS[key]);
    return modules;
}, {});
Object.entries(MOVED_SCREEN_ORIGINS).forEach(([key, moduleKey]) => ORIGINAL_MODULE_SCREENS[moduleKey].push(key));

/**
 * The module switch that a role saved with module switches only gives `key`, a screen of
 * `group`; undefined when no switch was saved for that module or it has screen values.
 */
const getModuleOnlyValue = (saved, group, key) => {
    const moduleKey = MOVED_SCREEN_ORIGINS[key] || group.key;
    if (typeof saved[moduleKey] !== 'boolean') return undefined;
    return ORIGINAL_MODULE_SCREENS[moduleKey].some((screen) => typeof saved[screen] === 'boolean')
        ? undefined
        : saved[moduleKey];
};

// ─── Action-level permissions ───────────────────────────────────────────────
// A screen's own key is its View permission. Create, Modify and Delete are stored
// next to it as "<key>:create", "<key>:modify" and "<key>:delete".
const PERMISSION_ACTIONS = ['view', 'create', 'modify', 'delete'];

// Screens that only show information have View alone; screens whose records are
// never deleted have no Delete. Every screen not listed has all four actions.
const MODULE_ACTIONS = {
    dashboard_overview: ['view'],
    payroll_org_chart: ['view'],
    payroll_org_chart_full: ['view'],
    enquiry_analytics: ['view'],
    sales_dashboard: ['view'],
    sales_forecasting: ['view'],
    sales_activities: ['view'],
    sales_reports: ['view'],
    sales_analytics: ['view'],
    sales_revenue_analytics: ['view'],
    sales_ai_pricing: ['view'],
    sales_cpq: ['view'],
    sales_approvals: ['view', 'modify'],
    reports_main: ['view'],
    master_serials: ['view', 'create', 'modify'],
    master_serials_view_details: ['view'],
    master_serials_edit: ['view'],
    master_serial_transfer: ['view', 'modify'],
    inventory_dashboard: ['view'],
    inventory_items: ['view'],
    inventory_stock_in: ['view'],
    inventory_stock_out: ['view'],
    inventory_transfers: ['view', 'create', 'modify'],
    inventory_adjustments: ['view', 'create', 'modify'],
    inventory_stock_counts: ['view', 'create', 'modify'],
    inventory_alerts: ['view', 'modify'],
    inventory_reports: ['view'],
    planning_simulations: ['view'],
    planning_edit_prev_year: ['view'],
    planning_view_sbu_wise: ['view'],
    planning_view_segment_wise: ['view'],
    planning_view_status_breakdown: ['view'],
    csm_dashboard: ['view'],
    csm_detail_dashboard: ['view'],
    csm_tickets: ['view', 'create', 'modify'],
    csm_visits: ['view', 'create', 'modify'],
    csm_attendance: ['view', 'create'],
    csm_warranties_amc: ['view', 'create', 'modify'],
    csm_reports: ['view'],
    tender_dashboard: ['view'],
    tender_reports: ['view'],
    settings_profile: ['view', 'modify'],
    admin_authorization: ['view'],
    admin_salespersons: ['view', 'create', 'modify'],
    // Older per-action flowchart switches, superseded by the actions of flowchart_view
    flowchart_create: ['view'],
    flowchart_edit: ['view'],
    flowchart_delete: ['view']
};

// Screens a role always sees, whatever is saved (the client applies the same rule).
const ROLE_LOCKED_VIEW_KEYS = {
    employee: ['dashboard_overview', 'payroll_org_chart', 'csm_tickets', 'csm_kb', 'settings_profile']
};

const actionKey = (key, action) => (action === 'view' ? key : `${key}:${action}`);

const getModuleActions = (key) => MODULE_ACTIONS[key] || PERMISSION_ACTIONS;

const uniqueChildKeys = (group) => Array.from(new Set((group.children || []).map((child) => child.key)));

const MODULE_KEYS = Array.from(new Set(MENU_GROUPS.flatMap((group) => (
    group.children?.length ? uniqueChildKeys(group) : [group.key]
))));

const getPermissionActionMap = () => MODULE_KEYS.reduce((map, key) => {
    map[key] = getModuleActions(key);
    return map;
}, {});

const getLockedViewKeys = (role) => ROLE_LOCKED_VIEW_KEYS[role] || [];

// Screens given a switch of their own after roles and users were saved with the switch that
// used to cover them. Until a role or user is saved again, the screen takes every value saved
// for the old switch (View and each action), so nobody gains or loses access.
const SPLIT_PERMISSION_SOURCES = {
    master_serial_transfer: 'master_serials'
};

/** `saved` with the old switch's values copied to each split-out screen that has none of its own. */
const withSplitPermissions = (saved = {}) => {
    const next = { ...saved };
    Object.entries(SPLIT_PERMISSION_SOURCES).forEach(([key, source]) => {
        if (typeof next[key] === 'boolean' || typeof next[source] !== 'boolean') return;
        next[key] = next[source];
        getModuleActions(key).forEach((action) => {
            const value = next[actionKey(source, action)];
            if (action !== 'view' && typeof value === 'boolean') next[actionKey(key, action)] = value;
        });
    });
    return next;
};

/**
 * Adds the Create/Modify/Delete flags of every screen to `permissions`, which
 * already holds the View values. A flag that was never saved follows the screen's
 * View value, so roles saved before action-level permissions keep the access they
 * had. No action is granted on a screen that cannot be viewed.
 */
const applyActionPermissions = (permissions, stored = {}) => {
    MODULE_KEYS.forEach((key) => {
        getModuleActions(key).forEach((action) => {
            if (action === 'view') return;
            const flagKey = actionKey(key, action);
            const saved = stored[flagKey];
            permissions[flagKey] = Boolean(permissions[key]) && (typeof saved === 'boolean' ? saved : true);
        });
    });
    return permissions;
};

/**
 * True when `permissions` allow `action` on the screen `key`. An action the screen
 * does not have (deleting a ticket line, say) is decided by Modify, or by View on
 * a screen that has nothing to modify.
 */
const hasPermission = (permissions = {}, key, action = 'view') => {
    if (!permissions[key]) return false;
    if (action === 'view') return true;

    const actions = getModuleActions(key);
    const effectiveAction = actions.includes(action)
        ? action
        : actions.includes('modify') ? 'modify' : 'view';

    return effectiveAction === 'view' || permissions[actionKey(key, effectiveAction)] === true;
};

// Manager: everything except the admin panel
// Sales: lightweight access - dashboard, enquiry, quotation, inventory items/transfers
// Employee: employee access - payslips, payroll, csm tickets, csm attendance, csm kb, dashboard
const DEFAULT_ROLE_PERMISSIONS = {
    admin: buildPermissions(FULL_ACCESS_KEYS),
    manager: withoutAdminOnlyKeys(buildPermissions(['dashboard', 'master', 'enquiry', 'sales_pipeline', 'quotation', 'meetings', 'sale', 'purchase', 'inventory', 'planning', 'reports', 'settings', 'csm', 'tender', 'payroll_org_chart'])),
    sales: withoutAdminOnlyKeys(withKeysOff(buildPermissions(['dashboard', 'enquiry', 'sales_pipeline', 'quotation', 'meetings', 'inventory_items', 'inventory_stock_in', 'inventory_stock_out', 'inventory_transfers', 'csm_tickets', 'csm_attendance', 'csm_kb', 'tender_dashboard', 'tender_register', 'payroll_org_chart']), SALES_WITHHELD_KEYS)),
    employee: withoutAdminOnlyKeys(buildPermissions(['dashboard', 'payroll_org_chart', 'csm_tickets', 'csm_attendance', 'csm_kb', 'settings_profile']))
};

/**
 * Validates and normalises a permission input object. Parent-only legacy input
 * grants all children in that section so existing saved roles keep working.
 * Every action flag comes out explicit.
 */
const sanitizePermissions = (rawInput = {}) => {
    const input = withSplitPermissions(rawInput);
    const permissions = MENU_GROUPS.reduce((permissions, group) => {
        const childKeys = (group.children || []).map((child) => child.key);
        let enabledChildren = 0;

        childKeys.forEach((key) => {
            const legacyFallback = getLegacyFallback(input, key);
            const childEnabled = typeof input[key] === 'boolean'
                ? input[key]
                : typeof legacyFallback === 'boolean'
                    ? legacyFallback
                    : getModuleOnlyValue(input, group, key) === true;

            permissions[key] = childEnabled;
            if (childEnabled) enabledChildren += 1;
        });

        permissions[group.key] = childKeys.length
            ? enabledChildren > 0
            : Boolean(input[group.key]);

        return permissions;
    }, {});

    return applyActionPermissions(permissions, input);
};

/**
 * Merges stored DB permissions with role defaults.
 * Admin is always fully locked - no stored overrides apply.
 * For other roles, stored child permissions are respected.
 */
const resolvePermissions = (role, savedPermissions = {}) => {
    const storedPermissions = withSplitPermissions(savedPermissions);
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.admin;
    const lockedKeys = new Set(getLockedViewKeys(role));

    const permissions = MENU_GROUPS.reduce((permissions, group) => {
        const childKeys = (group.children || []).map((child) => child.key);
        const storedParent = storedPermissions[group.key];
        const hasStoredParent = typeof storedParent === 'boolean';
        const hasStoredChildren = childKeys.some((key) => typeof storedPermissions[key] === 'boolean');
        let enabledChildren = 0;

        childKeys.forEach((key) => {
            const stored = storedPermissions[key];
            const hasStoredValue = typeof stored === 'boolean';
            const legacyFallback = getLegacyFallback(storedPermissions, key);
            const moduleOnlyValue = getModuleOnlyValue(storedPermissions, group, key);
            const childEnabled = lockedKeys.has(key) || (hasStoredValue
                ? stored
                : typeof legacyFallback === 'boolean'
                    ? legacyFallback
                    : ADMIN_DEFAULT_ONLY_KEYS.has(key)
                    ? String(role || '').toLowerCase() === 'admin'
                    : typeof moduleOnlyValue === 'boolean'
                    ? moduleOnlyValue
                    : Boolean(defaults[key]));

            permissions[key] = childEnabled;
            if (childEnabled) enabledChildren += 1;
        });

        permissions[group.key] = hasStoredChildren || childKeys.some((key) => lockedKeys.has(key))
            ? enabledChildren > 0
            : hasStoredParent
                ? storedParent
                : Boolean(defaults[group.key]);

        return permissions;
    }, {});

    return applyActionPermissions(permissions, storedPermissions);
};

/**
 * Effective permissions of one user: the role's resolved permissions with the
 * user's own overrides on top. An override saved before action-level permissions
 * existed holds only View; its actions then follow that View value, as they did.
 */
const mergeUserPermissions = (role, rolePermissions = {}, customPermissions = {}) => {
    const custom = withSplitPermissions(customPermissions || {});
    const lockedKeys = new Set(getLockedViewKeys(role));
    const merged = {};

    MENU_GROUPS.forEach((group) => {
        const childKeys = group.children?.length ? uniqueChildKeys(group) : [group.key];

        childKeys.forEach((key) => {
            const hasViewOverride = typeof custom[key] === 'boolean';
            const view = lockedKeys.has(key) || (hasViewOverride ? custom[key] : Boolean(rolePermissions[key]));
            merged[key] = view;

            getModuleActions(key).forEach((action) => {
                if (action === 'view') return;
                const flagKey = actionKey(key, action);
                const value = typeof custom[flagKey] === 'boolean'
                    ? custom[flagKey]
                    : hasViewOverride ? custom[key] : Boolean(rolePermissions[flagKey]);
                merged[flagKey] = view && value;
            });
        });

        if (group.children?.length) {
            merged[group.key] = childKeys.some((key) => merged[key]);
        }
    });

    return merged;
};

/**
 * The overrides to save for a user who should end up with `desired`: every flag
 * that differs from the role. When View differs, all of that screen's actions are
 * saved too, so none of them falls back to following the overridden View.
 */
const diffUserPermissions = (role, rolePermissions = {}, desired = {}) => {
    const target = mergeUserPermissions(role, rolePermissions, {});
    const locked = Object.fromEntries(getLockedViewKeys(role).map((key) => [key, true]));
    const wanted = sanitizePermissions({ ...desired, ...locked });

    const flagsOf = (key) => getModuleActions(key).map((action) => actionKey(key, action));
    const source = (key) => SPLIT_PERMISSION_SOURCES[key];

    return MODULE_KEYS.reduce((diff, key) => {
        const flags = flagsOf(key);
        // A split-out screen left as the role has it is saved too when its old switch is
        // overridden; otherwise it would take that override (withSplitPermissions).
        const viewChanged = wanted[key] !== target[key]
            || Boolean(source(key) && flagsOf(source(key)).some((flag) => wanted[flag] !== target[flag]));
        flags.forEach((flag) => {
            if (viewChanged || wanted[flag] !== target[flag]) diff[flag] = wanted[flag];
        });
        return diff;
    }, {});
};

module.exports = {
    MENU_GROUPS,
    ROLE_OPTIONS,
    ROLE_LABELS,
    DEFAULT_ROLE_PERMISSIONS,
    PERMISSION_ACTIONS,
    MODULE_KEYS,
    actionKey,
    getModuleActions,
    getPermissionActionMap,
    getLockedViewKeys,
    hasPermission,
    mergeUserPermissions,
    diffUserPermissions,
    buildPermissions,
    getAllPermissionKeys,
    sanitizePermissions,
    resolvePermissions
};


