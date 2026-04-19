export const MENU_PERMISSION_GROUPS = [
    { key: 'dashboard', label: 'Dashboard', description: 'Main dashboard overview', defaultRoute: '/dashboard' },
    { key: 'master', label: 'Master', description: 'Customers, vendors, products, MGRs, attributes and terms', defaultRoute: '/customers' },
    { key: 'enquiry', label: 'Enquiry', description: 'Leads, enquiries and analytics', defaultRoute: '/enquiries' },
    { key: 'quotation', label: 'Quotation', description: 'Quotation screens and actions', defaultRoute: '/quotations' },
    { key: 'sale', label: 'Sale', description: 'Sales voucher and invoice workflow', defaultRoute: '/vouchers' },
    { key: 'purchase', label: 'Purchase', description: 'Purchase and GRN navigation group', defaultRoute: null },
    { key: 'planning', label: 'Planning', description: 'Planning and simulation screens', defaultRoute: '/planning' },
    { key: 'reports', label: 'Reports', description: 'Reporting screens', defaultRoute: '/reports' },
    { key: 'settings', label: 'Settings', description: 'User and company settings', defaultRoute: '/settings' },
    { key: 'admin', label: 'Admin', description: 'Authorization and admin-only configuration', defaultRoute: '/admin/authorization' }
];

export const ROLE_LABELS = {
    admin: 'Admin',
    manager: 'Manager',
    sales: 'Sales'
};

export const getFallbackRoute = (permissions = {}) => {
    const firstAccessibleGroup = MENU_PERMISSION_GROUPS.find(
        (group) => group.defaultRoute && permissions?.[group.key]
    );

    return firstAccessibleGroup?.defaultRoute || '/';
};
