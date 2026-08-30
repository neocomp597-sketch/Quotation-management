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
            { key: 'master_products', label: 'Products', description: 'Product master records' },
            { key: 'master_contacts', label: 'Contacts', description: 'Contact management records' },
            { key: 'master_mgrs', label: 'MGR Master', description: 'MGR master hierarchy' },
            { key: 'master_attributes', label: 'Attributes', description: 'Attribute master definitions' },
            { key: 'master_statuses', label: 'Status Master', description: 'Status master definitions for planning' },
            { key: 'master_terms', label: 'Terms & Conditions', description: 'Terms and conditions master' },
            { key: 'master_territories', label: 'Territory Master', description: 'Territory master management' },
            { key: 'master_branches', label: 'Branch Master', description: 'Branch master management' },
            { key: 'master_serials', label: 'Serial No. Master', description: 'Serial number and asset master record management' },
            { key: 'state_master_create', label: 'State Master', description: 'State master management' },
            { key: 'city_master', label: 'City Master', description: 'City master management' }
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
        key: 'quotation',
        label: 'Sales',
        description: 'Catalog, Price Books, CPQ Engine, Quotations, Approvals, Contracts, and Orders',
        children: [
            { key: 'sales_catalog', label: 'Catalog Management', description: 'Manage Products, Services, Subscriptions, and Bundles' },
            { key: 'sales_price_management', label: 'Price Management', description: 'Manage Price Books, Pricing Rules, Discount Policies, and Currency Rates' },
            { key: 'sales_cpq', label: 'CPQ Engine', description: 'Access Guided Selling, configurators, and simulators' },
            { key: 'quotation_list', label: 'Quotations', description: 'Quotation list and creation screens' },
            { key: 'sales_approvals', label: 'Approvals Workflow', description: 'Review low-margin and price-override approvals' },
            { key: 'sales_contracts', label: 'Contracts Agreements', description: 'Manage locked price contracts for customers' },
            { key: 'sales_orders', label: 'Sales Orders', description: 'Access Sales Order conversion and invoice logs' },
            { key: 'sales_revenue_analytics', label: 'Revenue Analytics', description: 'Analytics dashboards for margins and price books' },
            { key: 'sales_competitors', label: 'Competitor Intelligence', description: 'Track competitor pricing and differentials' },
            { key: 'sales_ai_pricing', label: 'AI Pricing Insights', description: 'AI-driven win rates and margin suggestions' }
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
        label: 'Material',
        description: 'Purchase and GRN navigation group',
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
            { key: 'inventory_stock_in', label: 'Stock In / GRN', description: 'Record inward goods receipts' },
            { key: 'inventory_stock_out', label: 'Stock Out / Dispatch', description: 'Record outward material issues' },
            { key: 'inventory_transfers', label: 'Stock Transfers', description: 'Inter-warehouse transfers and approvals' },
            { key: 'inventory_adjustments', label: 'Stock Adjustments', description: 'Damage, loss, and physical audit adjustments' },
            { key: 'inventory_stock_counts', label: 'Physical Audit', description: 'Physical count sessions and reconciliation' },
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
            { key: 'payroll_payslips', label: 'My Payslips', description: 'View and download monthly payslips' },
            { key: 'payroll_employees', label: 'Employees', description: 'Employee directory and profile management' },
            { key: 'payroll_org_chart', label: 'Org Chart', description: 'Direct reporting org chart access' },
            { key: 'payroll_masters', label: 'Department & Designation Masters', description: 'Manage departments and designations' },
            { key: 'payroll_runs', label: 'Run Payroll', description: 'Create and run monthly payroll batches' },
            { key: 'payroll_payments', label: 'Payments', description: 'Record payment slips and transaction references' },
            { key: 'payroll_settings', label: 'Payroll Settings', description: 'Manage payroll month and calculation configuration' },
            { key: 'payroll_letters', label: 'Letter Management', description: 'Generate offer, appointment, promotion, and relieving letters' },
            { key: 'payroll_reports', label: 'Payroll Reports', description: 'Access monthly register, deduction logs, and allocation charts' }
        ]
    },
    {
        key: 'csm',
        label: 'Customer Service',
        description: 'Manage support tickets, service visits, warranties, AMCs, knowledge base, and feedback',
        children: [
            { key: 'csm_dashboard', label: 'CSM Dashboard', description: 'Overview and service analytics' },
            { key: 'csm_tickets', label: 'Tickets Register', description: 'View, create, and resolve customer support tickets' },
            { key: 'csm_tickets', label: 'My Complaints', description: 'Complaints created by or assigned to the logged-in user' },
            { key: 'csm_tickets', label: 'My Team Complaints', description: 'Complaints for the logged-in user reporting hierarchy' },
            { key: 'csm_visits', label: 'Service Visits', description: 'Schedule and manage service engineer visits' },
            { key: 'csm_warranties_amc', label: 'Warranty & AMC', description: 'Manage customer warranty details and AMC contracts' },
            { key: 'csm_kb', label: 'Knowledge Base', description: 'Manage troubleshooting articles and FAQs' },
            { key: 'csm_masters', label: 'CSM Config', description: 'Configure categories, priorities, teams, and SLAs' },
            { key: 'csm_reports', label: 'Service Reports', description: 'Customer service analytics and resolution reports' }
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

// Manager: everything except the admin panel
// Sales: lightweight access - dashboard, enquiry, quotation, inventory items/transfers
// Employee: employee access - payslips, payroll, csm tickets, csm kb, dashboard
const DEFAULT_ROLE_PERMISSIONS = {
    admin: buildPermissions(FULL_ACCESS_KEYS),
    manager: buildPermissions(['dashboard', 'master', 'enquiry', 'sales_pipeline', 'quotation', 'meetings', 'sale', 'purchase', 'inventory', 'planning', 'reports', 'settings', 'csm', 'tender', 'payroll_org_chart']),
    sales: buildPermissions(['dashboard', 'enquiry', 'sales_pipeline', 'quotation', 'meetings', 'inventory_items', 'inventory_stock_in', 'inventory_stock_out', 'inventory_transfers', 'csm_tickets', 'csm_kb', 'tender_dashboard', 'tender_register', 'payroll_org_chart']),
    employee: buildPermissions(['dashboard', 'payroll_payslips', 'payroll_org_chart', 'csm_tickets', 'csm_kb', 'settings_profile'])
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
    const defaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.admin;

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


