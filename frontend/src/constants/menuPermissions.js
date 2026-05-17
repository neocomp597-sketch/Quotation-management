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
            { key: 'master_products', label: 'Products', description: 'Product master records', defaultRoute: '/products' },
            { key: 'master_mgrs', label: 'MGRs', description: 'MGR master hierarchy', defaultRoute: '/mgrs' },
            { key: 'master_attributes', label: 'Attributes', description: 'Attribute master definitions', defaultRoute: '/attributes' },
            { key: 'master_terms', label: 'Terms', description: 'Terms and conditions master', defaultRoute: '/terms' },
            { key: 'master_territories', label: 'Territories', description: 'Territory master management', defaultRoute: '/territory-master' }
        ]
    },
    {
        key: 'enquiry',
        label: 'Enquiry',
        description: 'Leads, enquiries and analytics',
        defaultRoute: '/enquiries',
        children: [
            { key: 'enquiry_leads', label: 'Leads & Enquiries', description: 'Lead and enquiry records', defaultRoute: '/enquiries' },
            { key: 'enquiry_analytics', label: 'Analytics', description: 'Enquiry analytics dashboard', defaultRoute: '/enquiries/analytics' }
        ]
    },
    {
        key: 'quotation',
        label: 'Quotation',
        description: 'Quotation screens and actions',
        defaultRoute: '/quotations',
        children: [
            { key: 'quotation_list', label: 'Quotations', description: 'Quotation list and creation screens', defaultRoute: '/quotations' }
        ]
    },
    {
        key: 'sale',
        label: 'Sale',
        description: 'Sales voucher and invoice workflow',
        defaultRoute: '/vouchers',
        children: [
            { key: 'sale_invoices', label: 'Create Invoice', description: 'Sales voucher and invoice screens', defaultRoute: '/vouchers' }
        ]
    },
    {
        key: 'purchase',
        label: 'Purchase',
        description: 'Purchase and GRN navigation group',
        defaultRoute: null,
        children: [
            { key: 'purchase_grn', label: 'GRN', description: 'Goods receipt note screens', defaultRoute: null }
        ]
    },
    {
        key: 'planning',
        label: 'Planning',
        description: 'Revenue planning and simulation screens',
        defaultRoute: '/planning',
        children: [
            { key: 'planning_screen', label: 'Planning Screen', description: 'Revenue planning workspace', defaultRoute: '/planning' },
            { key: 'planning_simulations', label: 'Simulations', description: 'Planning simulation screens', defaultRoute: '/simulations' }
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
