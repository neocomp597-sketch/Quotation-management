export const MENU_PERMISSION_GROUPS = [
    {
        key: 'dashboard',
        label: 'Dashboard',
        description: 'Main dashboard and KPI overview',
        defaultRoute: '/dashboard',
        children: [
            { key: 'dashboard_overview', label: 'Dashboard Overview', description: 'Main dashboard and KPI overview', defaultRoute: '/dashboard' }
        ]
    },
    {
        key: 'master',
        label: 'Master',
        description: 'Customers, vendors, products, MGRs, attributes and terms',
        defaultRoute: '/customers',
        children: [
            { key: 'master_customers', label: 'Customers', description: 'Customer master records', defaultRoute: '/customers' },
            { key: 'master_vendors', label: 'Vendors', description: 'Vendor master records', defaultRoute: '/vendors' },
            { key: 'master_contacts', label: 'Contacts', description: 'Contact management records', defaultRoute: '/contacts' },
            { key: 'master_products', label: 'Products', description: 'Product master records', defaultRoute: '/products' },
            { key: 'master_mgrs', label: 'MGRs', description: 'MGR master hierarchy', defaultRoute: '/mgrs' },
            { key: 'master_attributes', label: 'Attributes', description: 'Attribute master definitions', defaultRoute: '/attributes' },
            { key: 'master_statuses', label: 'Status Master', description: 'Status master definitions for planning', defaultRoute: '/status-master' },
            { key: 'master_terms', label: 'Terms', description: 'Terms and conditions master', defaultRoute: '/terms' },
            { key: 'master_territories', label: 'Territories', description: 'Territory master management', defaultRoute: '/territory-master' },
            { key: 'master_serials', label: 'Serial No. Master', description: 'Serial number and asset master record management', defaultRoute: '/serial-no-master' }
        ]
    },
    {
        key: 'enquiry',
        label: 'Enquiry',
        description: 'Enquiry register and analytics',
        defaultRoute: '/enquiries',
        children: [
            { key: 'enquiry_leads', label: 'Enquiry Register', description: 'Enquiry records and register access', defaultRoute: '/enquiries' },
            { key: 'enquiry_analytics', label: 'Analytics', description: 'Enquiry analytics dashboard', defaultRoute: '/enquiries/analytics' }
        ]
    },
    {
        key: 'sales_pipeline',
        label: 'Sales Pipeline',
        description: 'Deal pipeline management, forecasting, targets, and analytics',
        defaultRoute: '/sales/dashboard',
        children: [
            { key: 'sales_dashboard', label: 'Sales Dashboard', description: 'Sales KPI dashboard overview', defaultRoute: '/sales/dashboard' },
            { key: 'sales_deals', label: 'Deals', description: 'Deal board and deal management', defaultRoute: '/sales/deals' },
            { key: 'sales_pipelines', label: 'Pipelines', description: 'Pipeline stage configuration', defaultRoute: '/sales/pipelines' },
            { key: 'sales_forecasting', label: 'Forecasting', description: 'Revenue forecasting and predictions', defaultRoute: '/sales/forecasting' },
            { key: 'sales_activities', label: 'Activities', description: 'Unified deal activity timeline', defaultRoute: '/sales/activities' },
            { key: 'sales_targets', label: 'Targets', description: 'Sales target and quota management', defaultRoute: '/sales/targets' },
            { key: 'sales_reports', label: 'Reports', description: 'Pipeline funnel, win/loss, and revenue reports', defaultRoute: '/sales/reports' },
            { key: 'sales_analytics', label: 'Analytics', description: 'Pipeline velocity, stuck deals, and salesperson analytics', defaultRoute: '/sales/analytics' }
        ]
    },
    {
        key: 'meetings',
        label: 'Appointments',
        description: 'Appointment schedule and activity management',
        defaultRoute: '/meetings',
        children: [
            { key: 'meetings_list', label: 'Appointments List', description: 'Schedule and view appointments', defaultRoute: '/meetings' }
        ]
    },
    {
        key: 'quotation',
        label: 'Quotation Management',
        description: 'Quotation registers, approvals, rejections and conversion reports',
        defaultRoute: '/quotations',
        children: [
            { key: 'quotation_list', label: 'Quotation Register', description: 'View all quotations', defaultRoute: '/quotations' },
            { key: 'quotation_list', label: 'Pending Quotations', description: 'View pending approval quotations', defaultRoute: '/quotations?status=pending_approval' },
            { key: 'quotation_list', label: 'Approved Quotations', description: 'View approved trade quotations', defaultRoute: '/quotations?status=final' },
            { key: 'quotation_list', label: 'Rejected Quotations', description: 'View rejected trade quotations', defaultRoute: '/quotations?status=rejected' },
            { key: 'reports_main', label: 'Quote Conversion Report', description: 'Quotation conversion analytics', defaultRoute: '/quotations/conversion-report' }
        ]
    },
    {
        key: 'sale',
        label: 'Material Received',
        description: 'Material received navigation group',
        defaultRoute: null,
        children: []
    },
    {
        key: 'purchase',
        label: 'Purchase',
        description: 'Purchase and GRN navigation group',
        defaultRoute: null,
        children: [
            { key: 'purchase_grn', label: 'GRN', description: 'Goods receipt note and sale return screens', defaultRoute: '/grn' }
        ]
    },
    {
        key: 'planning',
        label: 'Planning',
        description: 'Revenue planning and simulation screens',
        defaultRoute: '/planning',
        children: [
            { key: 'planning_screen', label: 'Planning Screen', description: 'Revenue planning workspace', defaultRoute: '/planning' },
            { key: 'planning_simulations', label: 'Simulations', description: 'Planning simulation screens', defaultRoute: '/simulations' },
            { key: 'planning_edit_prev_year', label: 'Edit Previous Year Entries', description: 'Allow adding/editing/deleting planning entries in previous financial years', defaultRoute: '/planning' },
            { key: 'planning_view_sbu_wise', label: 'View SBU Wise Summary', description: 'Access to SBU-wise summary in Planning Screen', defaultRoute: '/planning' },
            { key: 'planning_view_segment_wise', label: 'View Segment Wise Summary', description: 'Access to Segment-wise summary in Planning Screen', defaultRoute: '/planning' },
            { key: 'planning_view_status_breakdown', label: 'View Status Breakdown Summary', description: 'Access to Status Breakdown summary in Planning Screen', defaultRoute: '/planning' }
        ]
    },
    {
        key: 'reports',
        label: 'Reports',
        description: 'Reporting, analytics and data exports',
        defaultRoute: '/reports',
        children: [
            { key: 'reports_main', label: 'Reports', description: 'Reporting screens', defaultRoute: '/reports' }
        ]
    },
    {
        key: 'settings',
        label: 'Settings',
        description: 'User and company settings',
        defaultRoute: '/settings',
        children: [
            { key: 'settings_profile', label: 'Settings', description: 'User and company settings', defaultRoute: '/settings' }
        ]
    },
    {
        key: 'admin',
        label: 'Admin',
        description: 'Authorization and admin-only configuration',
        defaultRoute: '/admin/authorization',
        children: [
            { key: 'admin_authorization', label: 'Authorization', description: 'Role authorization controls', defaultRoute: '/admin/authorization' },
            { key: 'admin_salespersons', label: 'Salespersons', description: 'Salesperson user administration', defaultRoute: '/salespersons' }
        ]
    },
    {
        key: 'payroll',
        label: 'Payroll',
        description: 'Manage employee salary profiles, payroll settings, monthly runs, payments, payslips, letters and reports',
        defaultRoute: '/payroll/dashboard',
        children: [
            { key: 'payroll_employees', label: 'Employees', description: 'Employee salary profiles and base structures', defaultRoute: '/payroll/employees' },
            { key: 'payroll_runs', label: 'Run Payroll', description: 'Run and calculate monthly payroll', defaultRoute: '/payroll/runs' },
            { key: 'payroll_payments', label: 'Payments', description: 'Record employee payments', defaultRoute: '/payroll/payments' },
            { key: 'payroll_settings', label: 'Settings', description: 'Manage lock dates and settings', defaultRoute: '/payroll/settings' },
            { key: 'payroll_letters', label: 'Letters', description: 'Generate offer, appointment, promotion, relieving letters', defaultRoute: '/payroll/letters' },
            { key: 'payroll_reports', label: 'Reports', description: 'View register, deduction logs, and allocation reports', defaultRoute: '/payroll/reports' }
        ]
    },
    {
        key: 'csm',
        label: 'Customer Service',
        description: 'Manage support tickets, service visits, warranties, AMCs, knowledge base, and feedback',
        defaultRoute: '/csm/dashboard',
        children: [
            { key: 'csm_dashboard', label: 'CSM Dashboard', description: 'Overview and service analytics', defaultRoute: '/csm/dashboard' },
            { key: 'csm_tickets', label: 'Tickets Management', description: 'View, create, and resolve customer support tickets', defaultRoute: '/csm/tickets' },
            { key: 'csm_visits', label: 'Field Service Visits', description: 'Schedule and manage service engineer visits', defaultRoute: '/csm/visits' },
            { key: 'csm_warranties_amc', label: 'Warranty & AMC', description: 'Manage customer warranty details and AMC contracts', defaultRoute: '/csm/warranties-amc' },
            { key: 'csm_kb', label: 'Knowledge Base', description: 'Manage troubleshooting articles and FAQs', defaultRoute: '/csm/kb' },
            { key: 'csm_masters', label: 'CSM Masters', description: 'Configure categories, priorities, teams, and SLAs', defaultRoute: '/csm/masters' }
        ]
    },
    {
        key: 'tender',
        label: 'Tender Management',
        description: 'Tender dashboard, pipelines, registers, and analysis reports',
        defaultRoute: '/tender/dashboard',
        children: [
            { key: 'tender_dashboard', label: 'Tender Dashboard', description: 'Tender KPI dashboard and charts', defaultRoute: '/tender/dashboard' },
            { key: 'tender_register', label: 'Tender Register', description: 'Tender list register and management', defaultRoute: '/tender/register' },
            { key: 'tender_reports', label: 'Tender Reports', description: 'Tender pipeline and win/loss reports', defaultRoute: '/tender/reports' }
        ]
    }
];

export const ROLE_LABELS = {
    admin: 'Admin',
    manager: 'Manager',
    sales: 'Sales'
};

export const getFallbackRoute = (permissions = {}) => {
    for (const group of MENU_PERMISSION_GROUPS) {
        const firstAccessibleChild = (group.children || []).find(
            (child) => {
                const hasChildValue = Object.prototype.hasOwnProperty.call(permissions || {}, child.key);
                return child.defaultRoute && (hasChildValue ? permissions?.[child.key] : permissions?.[group.key]);
            }
        );

        if (firstAccessibleChild) {
            return firstAccessibleChild.defaultRoute;
        }

        if (group.defaultRoute && permissions?.[group.key]) {
            return group.defaultRoute;
        }
    }

    return '/';
};
