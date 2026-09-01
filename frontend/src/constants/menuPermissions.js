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
        description: 'Customers, employees, vendors, contacts, products, branches, state/city, MGRs, and masters',
        defaultRoute: '/customers',
        children: [
            { key: 'master_customers', label: 'Customers', description: 'Customer master records', defaultRoute: '/customers' },
            { key: 'payroll_employees', label: 'Employees & Master', description: 'Employee directory and profile management', defaultRoute: '/payroll/employees' },
            { key: 'payroll_org_chart', label: 'Org Chart (My Team)', description: 'Direct reporting org chart access', defaultRoute: '/payroll/org-chart' },
            { key: 'payroll_org_chart_full', label: 'Org Chart (Full Company)', description: 'Full company org chart access', defaultRoute: '/payroll/org-chart' },
            { key: 'master_vendors', label: 'Vendors', description: 'Vendor master records', defaultRoute: '/vendors' },
            { key: 'master_contacts', label: 'Contacts', description: 'Contact management records', defaultRoute: '/contacts' },
            { key: 'master_products', label: 'Products', description: 'Product master records', defaultRoute: '/products' },
            { key: 'master_territories', label: 'Territory Master', description: 'Territory master management', defaultRoute: '/territory-master' },
            { key: 'master_branches', label: 'Branch Master', description: 'Branch master management', defaultRoute: '/branches' },
            { key: 'state_master_create', label: 'State Master', description: 'State master management', defaultRoute: '/state-master' },
            { key: 'city_master', label: 'City Master', description: 'City master management', defaultRoute: '/city-master' },
            { key: 'csm_masters', label: 'Engineers Master', description: 'Field service engineers master', defaultRoute: '/csm/masters?tab=engineers' },
            { key: 'master_mgrs', label: 'MGR Master', description: 'MGR master hierarchy', defaultRoute: '/mgrs' },
            { key: 'master_attributes', label: 'Attributes', description: 'Attribute master definitions', defaultRoute: '/attributes' },
            { key: 'master_terms', label: 'Terms & Conditions', description: 'Terms and conditions master', defaultRoute: '/terms' },
            { key: 'master_statuses', label: 'Status Master', description: 'Status master definitions for planning', defaultRoute: '/status-master' },
            { key: 'master_serials', label: 'Serial No. Master', description: 'Serial number and asset master records', defaultRoute: '/serial-no-master' },
            { key: 'flowchart_view', label: 'Flowchart Builder', description: 'Visual process flowchart builder', defaultRoute: '/flowcharts' }
        ]
    },
    {
        key: 'payroll',
        label: 'Payroll',
        description: 'Manage salary profiles, monthly runs, payments, payslips, letters, and settings',
        defaultRoute: '/payroll/dashboard',
        children: [
            { key: 'payroll_runs', label: 'Overview & Runs', description: 'Payroll dashboard and monthly payroll run execution', defaultRoute: '/payroll/runs' },
            { key: 'payroll_payments', label: 'Payments', description: 'Record employee payments', defaultRoute: '/payroll/payments' },
            { key: 'payroll_payslips', label: 'Payslips', description: 'View and print monthly payslips', defaultRoute: '/payroll/payslips' },
            { key: 'payroll_letters', label: 'Letters', description: 'Generate offer, appointment, promotion, relieving letters', defaultRoute: '/payroll/letters' },
            { key: 'payroll_settings', label: 'Settings', description: 'Manage payroll settings and lock dates', defaultRoute: '/payroll/settings' }
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
        description: 'Deal pipeline management, forecasting, targets, and activities',
        defaultRoute: '/sales/dashboard',
        children: [
            { key: 'sales_dashboard', label: 'Overview', description: 'Sales KPI dashboard overview', defaultRoute: '/sales/dashboard' },
            { key: 'sales_deals', label: 'Deals', description: 'Deal board and deal management', defaultRoute: '/sales/deals' },
            { key: 'sales_pipelines', label: 'Pipelines', description: 'Pipeline stage configuration', defaultRoute: '/sales/pipelines' },
            { key: 'sales_forecasting', label: 'Forecasting', description: 'Revenue forecasting and predictions', defaultRoute: '/sales/forecasting' },
            { key: 'sales_activities', label: 'Activities', description: 'Unified deal activity timeline', defaultRoute: '/sales/activities' },
            { key: 'sales_targets', label: 'Targets', description: 'Sales target and quota management', defaultRoute: '/sales/targets' }
        ]
    },
    {
        key: 'meetings',
        label: 'Appointments',
        description: 'Appointment schedule and activity management',
        defaultRoute: '/meetings',
        children: [
            { key: 'meetings_list', label: 'Appointments Register', description: 'Schedule and view appointments', defaultRoute: '/meetings' }
        ]
    },
    {
        key: 'cpq_masters',
        label: 'Catalog',
        description: 'Price books, pricing rules, discount policies, promotions, and currency rates',
        defaultRoute: '/sales/price-management/price-books',
        children: [
            { key: 'sales_price_management', label: 'Price Books & Rules', description: 'Manage price books, pricing rules, discount policies and promotions', defaultRoute: '/sales/price-management/price-books' }
        ]
    },
    {
        key: 'quotation',
        label: 'Quotations',
        description: 'Quotation registers, CPQ tools, invoices, approvals, and orders',
        defaultRoute: '/quotations',
        children: [
            { key: 'quotation_list', label: 'Quotation Register', description: 'View, create, and manage trade quotations', defaultRoute: '/quotations' },
            { key: 'reports_main', label: 'Quote Conversion Report', description: 'Quotation conversion analytics', defaultRoute: '/quotations/conversion-report' },
            { key: 'sales_cpq', label: 'Guided Selling & Configurator', description: 'Interactive product configurator and quote simulator', defaultRoute: '/sales/cpq/guided-selling' },
            { key: 'sale_invoices', label: 'Invoices', description: 'Billing invoices and payment schedules', defaultRoute: '/invoices' },
            { key: 'sales_approvals', label: 'Approvals Queue', description: 'Manage discount and high-value quotation approvals', defaultRoute: '/sales/approvals' },
            { key: 'sales_orders', label: 'Sales Orders', description: 'Sales order processing and status tracking', defaultRoute: '/sales/orders' }
        ]
    },
    {
        key: 'clm',
        label: 'Contracts',
        description: 'Contract Lifecycle Management (CLM), templates, clause library, and renewals',
        defaultRoute: '/sales/contracts/dashboard',
        children: [
            { key: 'sales_contracts', label: 'Contract Management', description: 'CLM dashboard, contracts list, templates, and clause library', defaultRoute: '/sales/contracts/dashboard' }
        ]
    },
    {
        key: 'purchase',
        label: 'Material',
        description: 'Goods Receipt Note (GRN) and material tracking',
        defaultRoute: '/grn',
        children: [
            { key: 'purchase_grn', label: 'GRN Register', description: 'Goods receipt note and material tracking screens', defaultRoute: '/grn' }
        ]
    },
    {
        key: 'inventory',
        label: 'Inventory',
        description: 'Stock matrix, warehouses, stock transfers, adjustments, audits, alerts, and valuation',
        defaultRoute: '/inventory/dashboard',
        children: [
            { key: 'inventory_dashboard', label: 'Inventory Dashboard', description: 'Stock valuation, movement feed, and KPI metrics', defaultRoute: '/inventory/dashboard' },
            { key: 'inventory_items', label: 'Items & Matrix', description: 'Warehouse-wise stock and batch details', defaultRoute: '/inventory/stock' },
            { key: 'inventory_warehouses', label: 'Warehouses', description: 'Manage warehouses and storage bins', defaultRoute: '/inventory/warehouses' },
            { key: 'inventory_transfers', label: 'Stock Transfers', description: 'Inter-warehouse transfers and approvals', defaultRoute: '/inventory/transfers' },
            { key: 'inventory_adjustments', label: 'Adjustments', description: 'Damage, loss, and physical audit adjustments', defaultRoute: '/inventory/adjustments' },
            { key: 'inventory_stock_counts', label: 'Physical Audit', description: 'Physical count sessions and reconciliation', defaultRoute: '/inventory/counts' },
            { key: 'inventory_alerts', label: 'Stock Alerts', description: 'Low-stock and expiry notification setup', defaultRoute: '/inventory/alerts' },
            { key: 'inventory_reports', label: 'Valuation & Reports', description: 'Stock ledger, valuation, and dead-stock reports', defaultRoute: '/inventory/reports' }
        ]
    },
    {
        key: 'planning',
        label: 'Planning',
        description: 'Revenue planning, simulations, and financial breakdown views',
        defaultRoute: '/planning',
        children: [
            { key: 'planning_screen', label: 'Planning Screen', description: 'Revenue planning workspace', defaultRoute: '/planning' },
            { key: 'planning_simulations', label: 'Simulations', description: 'Planning simulation screens', defaultRoute: '/simulations' },
            { key: 'planning_edit_prev_year', label: 'Edit Previous Year Entries', description: 'Allow modifying entries in previous financial years', defaultRoute: '/planning' },
            { key: 'planning_view_sbu_wise', label: 'View SBU Wise Summary', description: 'Access to SBU-wise summary in Planning Screen', defaultRoute: '/planning' },
            { key: 'planning_view_segment_wise', label: 'View Segment Wise Summary', description: 'Access to Segment-wise summary in Planning Screen', defaultRoute: '/planning' },
            { key: 'planning_view_status_breakdown', label: 'View Status Breakdown', description: 'Access to Status Breakdown summary in Planning Screen', defaultRoute: '/planning' }
        ]
    },
    {
        key: 'csm',
        label: 'Customer Service',
        description: 'Manage support tickets, field visits, warranty & AMC, knowledge base, and service reports',
        defaultRoute: '/csm/dashboard',
        children: [
            { key: 'csm_dashboard', label: 'CSM Dashboard', description: 'Overview and customer service analytics', defaultRoute: '/csm/dashboard' },
            { key: 'csm_tickets', label: 'Tickets Register', description: 'View, create, and resolve customer support tickets', defaultRoute: '/csm/tickets' },
            { key: 'csm_tickets', label: 'My Tickets', description: 'Tickets created by or assigned to the logged-in user', defaultRoute: '/csm/tickets?tab=my' },
            { key: 'csm_tickets', label: 'My Team Tickets', description: 'Tickets for the logged-in user reporting hierarchy', defaultRoute: '/csm/tickets?tab=team' },
            { key: 'csm_visits', label: 'Service Visits', description: 'Schedule and manage service engineer visits', defaultRoute: '/csm/visits' },
            { key: 'csm_warranties_amc', label: 'Warranty & AMC', description: 'Manage customer warranty details and AMC contracts', defaultRoute: '/csm/warranties-amc' },
            { key: 'csm_kb', label: 'Knowledge Base', description: 'Manage troubleshooting articles and FAQs', defaultRoute: '/csm/kb' },
            { key: 'csm_masters', label: 'CSM Config', description: 'Configure categories, priorities, teams, and SLAs', defaultRoute: '/csm/masters' },
            { key: 'csm_reports', label: 'Service Reports', description: 'Customer service analytics and resolution reports', defaultRoute: '/csm/reports' }
        ]
    },
    {
        key: 'tender',
        label: 'Tenders',
        description: 'Tender dashboard, register, and win/loss analysis reports',
        defaultRoute: '/tender/dashboard',
        children: [
            { key: 'tender_dashboard', label: 'Tender Dashboard', description: 'Tender KPI dashboard and charts', defaultRoute: '/tender/dashboard' },
            { key: 'tender_register', label: 'Tenders Register', description: 'Tender list register and management', defaultRoute: '/tender/register' },
            { key: 'tender_reports', label: 'Tender Reports', description: 'Tender pipeline and win/loss reports', defaultRoute: '/tender/reports' }
        ]
    },
    {
        key: 'reports',
        label: 'Reports',
        description: 'Reporting, sales analytics, customer analytics, and revenue insights',
        defaultRoute: '/reports',
        children: [
            { key: 'reports_main', label: 'Reports', description: 'Main reporting screens', defaultRoute: '/reports' },
            { key: 'sales_reports', label: 'Sales Reports', description: 'Sales revenue and performance reports', defaultRoute: '/sales/reports' },
            { key: 'sales_analytics', label: 'Sales Analytics', description: 'Pipeline velocity and salesperson analytics', defaultRoute: '/sales/analytics' },
            { key: 'sales_revenue_analytics', label: 'Revenue Analytics', description: 'Revenue streams and customer cohort analytics', defaultRoute: '/sales/revenue-analytics' },
            { key: 'sales_competitors', label: 'Competitor Intel', description: 'Market competitor analysis', defaultRoute: '/sales/competitors' },
            { key: 'sales_ai_pricing', label: 'AI Pricing Insights', description: 'AI-driven pricing optimization insights', defaultRoute: '/sales/ai-pricing' }
        ]
    },
    {
        key: 'admin',
        label: 'Admin',
        description: 'Authorization matrix and user permissions administration',
        defaultRoute: '/admin/authorization',
        children: [
            { key: 'admin_authorization', label: 'Authorization', description: 'Role authorization matrix controls', defaultRoute: '/admin/authorization' }
        ]
    }
];

export const ROLE_LABELS = {
    admin: 'Admin',
    manager: 'Manager',
    sales: 'Sales',
    employee: 'Employee',
    vendor: 'Vendor'
};

export const getFallbackRoute = (permissions = {}, user = null) => {
    const roleStr = String(user?.role || '').toLowerCase();
    if (roleStr === 'vendor') {
        return '/products';
    }
    if (roleStr === 'employee') {
        return '/dashboard';
    }

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

    return '/dashboard';
};


