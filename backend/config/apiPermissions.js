/**
 * Which permission each API request needs. Checked for every request that passes
 * `protect` (see middlewares/permissionMiddleware.js), so a screen's Create, Modify
 * and Delete switches hold for direct API calls as well as for the buttons.
 *
 * A rule covers the URLs under `prefix` (whole path segments; the longest matching
 * prefix wins). By default GET is View, POST is Create, PUT/PATCH is Modify and
 * DELETE is Delete on `key`.
 *  - `openRead`: reads are not checked. These masters are also lookup lists for
 *    other screens (the customer list in a quotation, branches in every form), so
 *    hiding their screen must not empty those lists. Their changes are checked.
 *  - `viewKeys`: reads are allowed with View on any of these screens, for data that
 *    other screens also show.
 *  - `routes`: exceptions keyed "METHOD /sub/path" (":name" matches one segment).
 *    The value is an action, { key, action }, { anyOf: [[key, action], ...] } or SKIP.
 *  - `onlyRoutes`: only these routes are checked; the controller decides the rest.
 *  - `resolveKeys(req, subPath)`: the screens a request belongs to, when the URL
 *    alone does not tell (an invoice and a GRN share /api/vouchers).
 */
const SKIP = 'skip';

const METHOD_ACTIONS = { GET: 'view', HEAD: 'view', POST: 'create', PUT: 'modify', PATCH: 'modify', DELETE: 'delete' };

const INVENTORY_KEYS = [
    'inventory_dashboard', 'inventory_items', 'inventory_warehouses', 'inventory_transfers',
    'inventory_adjustments', 'inventory_stock_counts', 'inventory_alerts', 'inventory_reports', 'purchase_grn'
];

const createOrModify = (key) => ({ anyOf: [[key, 'create'], [key, 'modify']] });

// Invoices are sale_invoices; purchase, return and voucher entries are the GRN register.
const voucherKeyForType = (type) => (/^invoice$/i.test(String(type || '').trim()) ? 'sale_invoices' : 'purchase_grn');

const resolveVoucherKeys = async (req, subPath) => {
    const type = req.body?.voucherType || req.query?.voucherType || req.query?.type;
    if (type) return [voucherKeyForType(type)];

    const id = subPath.split('/').filter(Boolean)[0];
    if (id && /^[a-f0-9]{24}$/i.test(id)) {
        const Voucher = require('../models/Voucher');
        const voucher = await Voucher.findById(id).select('voucherType').lean();
        if (voucher) return [voucherKeyForType(voucher.voucherType)];
    }
    return ['sale_invoices', 'purchase_grn'];
};

const importRule = (name, key, routes = { 'POST /': 'create' }) => ({ prefix: `/api/import/${name}`, key, onlyRoutes: routes });

const API_PERMISSION_RULES = [
    // ── Master ────────────────────────────────────────────────────────────
    { prefix: '/api/customers/analytics', key: 'master_customers' },
    {
        prefix: '/api/customers', key: 'master_customers', openRead: true,
        routes: { 'POST /bulk-delete': 'delete', 'PATCH /bulk-update': 'modify' }
    },
    { prefix: '/api/sites', key: 'master_customers', openRead: true },
    { prefix: '/api/cpq/contracts', key: 'master_customers' },
    {
        prefix: '/api/products', key: 'master_products', openRead: true,
        routes: { 'POST /bulk-delete': 'delete', 'PATCH /bulk-update': 'modify', 'PATCH /:id/vendor/:vendorId': 'modify' }
    },
    { prefix: '/api/categories', key: 'master_products', openRead: true },
    {
        // Attribute values are saved with a product, whether it is being added or edited
        prefix: '/api/product-attributes', key: 'master_products', openRead: true,
        routes: { 'POST /': createOrModify('master_products'), 'DELETE /:id': 'modify' }
    },
    { prefix: '/api/vendors', key: 'master_vendors', openRead: true },
    { prefix: '/api/vendor-catalog', key: 'master_vendors', openRead: true, routes: { 'POST /import': 'create' } },
    { prefix: '/api/contacts', key: 'master_contacts', openRead: true },
    { prefix: '/api/branches', key: 'master_branches', openRead: true },
    { prefix: '/api/state-master', key: 'state_master_create', openRead: true },
    { prefix: '/api/city-master', key: 'city_master', openRead: true, routes: { 'POST /upload': 'create' } },
    { prefix: '/api/attributes', key: 'master_attributes', openRead: true },
    { prefix: '/api/mgrs', key: 'master_mgrs', openRead: true, routes: { 'PUT /info': 'modify' } },
    { prefix: '/api/divisions', key: 'master_divisions', openRead: true },
    { prefix: '/api/segments', key: 'master_segments', openRead: true, routes: { 'POST /import': 'create' } },
    { prefix: '/api/statuses', key: 'master_statuses', openRead: true },
    { prefix: '/api/territories', key: 'master_territories', openRead: true },
    { prefix: '/api/terms', key: 'master_terms', openRead: true },
    {
        prefix: '/api/type-tests', key: 'master_type_tests', viewKeys: ['master_type_tests', 'master_products'],
        routes: {
            'POST /:id/certificate': 'modify',
            'POST /:id/renewal/start': 'modify',
            'POST /:id/progress': 'modify',
            'POST /:id/active': 'modify'
        }
    },
    {
        prefix: '/api/bom', key: 'master_bom',
        routes: {
            // A complaint shows the BOM of the serial it is raised against
            'GET /serial/:serialNumber': { anyOf: [['master_bom', 'view'], ['csm_tickets', 'view'], ['master_serials', 'view']] },
            'GET /ticket/:ticketId': { anyOf: [['master_bom', 'view'], ['csm_tickets', 'view'], ['master_serials', 'view']] },
            'POST /:id/assemblies': 'modify',
            'POST /:id/components/import': 'modify',
            'POST /:id/components': 'modify',
            'POST /:id/components/:lineId/move': 'modify',
            'POST /:id/renumber': 'modify',
            'PATCH /:id/status': 'modify'
        }
    },
    {
        prefix: '/api/serial-transfers', key: 'master_serials',
        routes: { 'POST /serials/:assetId/transfer': 'modify', 'POST /serials/:assetId/past-entry': 'modify' }
    },
    {
        prefix: '/api/payroll/employees', key: 'payroll_employees', openRead: true,
        routes: {
            'POST /sync-users': 'modify',
            'POST /batch-assign-branch-id': 'modify',
            'PUT /:id/reporting': 'modify',
            'PUT /:id/structure': 'modify',
            // KRAs are kept up to date from the org chart
            'PUT /:id/kra': SKIP
        }
    },
    { prefix: '/api/payroll/departments', key: 'payroll_employees', openRead: true },
    { prefix: '/api/payroll/designations', key: 'payroll_employees', openRead: true },
    {
        prefix: '/api/csm/masters', key: 'csm_masters', openRead: true,
        // Default masters are seeded on first use by any screen
        routes: { 'POST /seed': SKIP, 'POST /seed-mh': SKIP, 'POST /seed-kb': SKIP }
    },
    {
        prefix: '/api/flowcharts', key: 'flowchart_view',
        routes: { 'POST /generate': 'create', 'POST /import': 'create', 'POST /:id/restore/:versionId': 'modify' }
    },
    { prefix: '/api/salespersons', key: 'admin_salespersons', openRead: true },

    // ── Enquiry ───────────────────────────────────────────────────────────
    {
        prefix: '/api/enquiries', key: 'enquiry_leads',
        viewKeys: ['enquiry_leads', 'enquiry_analytics', 'meetings_list', 'quotation_list']
    },
    {
        prefix: '/api/analytics', key: 'enquiry_analytics', viewKeys: ['enquiry_analytics', 'reports_main'],
        routes: {
            'PUT /daily-report': { anyOf: [['enquiry_analytics', 'view'], ['reports_main', 'view']] },
            'POST /daily-report': { anyOf: [['enquiry_analytics', 'view'], ['reports_main', 'view']] }
        }
    },

    // ── Sales pipeline ────────────────────────────────────────────────────
    {
        prefix: '/api/sales/pipelines', key: 'sales_pipelines',
        viewKeys: ['sales_pipelines', 'sales_deals', 'sales_reports', 'sales_dashboard', 'sales_analytics'],
        // The deal board creates the default pipeline the first time it opens
        routes: { 'POST /seed-defaults': { anyOf: [['sales_pipelines', 'create'], ['sales_deals', 'view']] } }
    },
    {
        prefix: '/api/sales/deals', key: 'sales_deals', viewKeys: ['sales_deals', 'sales_activities'],
        routes: {
            'PATCH /:id/stage': 'modify',
            'PATCH /:id/lost': 'modify',
            'PATCH /:id/reopen': 'modify',
            'POST /:id/activity': 'modify'
        }
    },
    { prefix: '/api/sales/targets', key: 'sales_targets' },
    { prefix: '/api/sales/forecast', key: 'sales_forecasting', viewKeys: ['sales_forecasting', 'sales_dashboard', 'sales_reports'] },
    {
        prefix: '/api/sales/analytics', key: 'sales_analytics',
        viewKeys: ['sales_analytics', 'sales_reports', 'sales_dashboard', 'sales_activities']
    },

    // ── Appointments ──────────────────────────────────────────────────────
    { prefix: '/api/meetings', key: 'meetings_list' },

    // ── Catalog ───────────────────────────────────────────────────────────
    { prefix: '/api/cpq/competitors', key: 'sales_competitors' },
    { prefix: '/api/cpq/simulate', key: 'sales_cpq', routes: { 'POST /': 'view' } },
    { prefix: '/api/cpq/config-templates', key: 'sales_cpq' },
    { prefix: '/api/cpq/audit-logs', key: 'sales_price_management' },
    // Price books, rules and currencies also price every quotation
    {
        prefix: '/api/cpq', key: 'sales_price_management', openRead: true,
        // One call adds a product to a price book or updates its price
        routes: { 'POST /price-books/items': createOrModify('sales_price_management') }
    },

    // ── Quotations ────────────────────────────────────────────────────────
    { prefix: '/api/quotations/conversion-report', key: 'reports_main' },
    { prefix: '/api/quotations/reports', key: 'reports_main', viewKeys: ['reports_main', 'quotation_list'] },
    {
        // Drafts are autosaved while a quotation is being written or edited
        prefix: '/api/quotations/drafts', key: 'quotation_list',
        routes: { 'PUT /:draftKey': 'view', 'DELETE /:draftKey': 'view' }
    },
    {
        prefix: '/api/quotations', key: 'quotation_list',
        viewKeys: ['quotation_list', 'sales_approvals', 'reports_main', 'master_customers'],
        routes: {
            'PATCH /:id/status': { anyOf: [['quotation_list', 'modify'], ['sales_approvals', 'modify']] },
            'PATCH /:id/finalize': 'modify'
        }
    },
    {
        prefix: '/api/vouchers', key: 'sale_invoices', resolveKeys: resolveVoucherKeys,
        viewKeys: ['sale_invoices', 'purchase_grn', 'csm_tickets', 'csm_warranties_amc']
    },
    { prefix: '/api/orders', key: 'sales_orders', routes: { 'POST /:id/invoice': 'modify' } },

    // ── Contracts ─────────────────────────────────────────────────────────
    { prefix: '/api/clm', key: 'sales_contracts', routes: { 'POST /generate': 'create' } },

    // ── Inventory ─────────────────────────────────────────────────────────
    { prefix: '/api/inventory/warehouses', key: 'inventory_warehouses', viewKeys: INVENTORY_KEYS },
    { prefix: '/api/inventory/stock', key: 'inventory_items', viewKeys: ['inventory_items', 'inventory_dashboard'] },
    {
        prefix: '/api/inventory/transfers', key: 'inventory_transfers', viewKeys: ['inventory_transfers', 'inventory_dashboard'],
        routes: {
            'POST /:id/approve': 'modify',
            'POST /:id/dispatch': 'modify',
            'POST /:id/receive': 'modify',
            'POST /:id/reject': 'modify'
        }
    },
    {
        prefix: '/api/inventory/adjustments', key: 'inventory_adjustments',
        routes: { 'POST /:id/approve': 'modify', 'POST /:id/reject': 'modify' }
    },
    { prefix: '/api/inventory/counts', key: 'inventory_stock_counts', routes: { 'POST /:id/reconcile': 'modify' } },
    {
        prefix: '/api/inventory/alerts', key: 'inventory_alerts', viewKeys: ['inventory_alerts', 'inventory_dashboard'],
        routes: { 'POST /:id/resolve': 'modify' }
    },
    { prefix: '/api/inventory/reports', key: 'inventory_reports', viewKeys: ['inventory_reports', 'inventory_dashboard'] },
    // People added to an audit batch work in it without this permission; the
    // controller checks their access to each batch.
    { prefix: '/api/stock-audits', key: 'inventory_sap_audit', onlyRoutes: { 'POST /': 'create', 'DELETE /:id': 'delete' } },

    // ── Planning ──────────────────────────────────────────────────────────
    { prefix: '/api/planning', key: 'planning_screen', viewKeys: ['planning_screen', 'planning_simulations', 'reports_main'] },

    // ── Customer service ──────────────────────────────────────────────────
    { prefix: '/api/csm/dashboard', key: 'csm_dashboard' },
    { prefix: '/api/csm/reports', key: 'csm_reports' },
    {
        prefix: '/api/csm/tickets', key: 'csm_tickets', viewKeys: ['csm_tickets', 'csm_rca', 'csm_visits'],
        routes: {
            'PATCH /:id/assign': 'modify',
            'PATCH /:id/status': 'modify',
            // Photos attached while logging a ticket are saved as its first comment
            'POST /:id/comments': createOrModify('csm_tickets'),
            'POST /:id/reassign': 'modify',
            'PATCH /:id/escalate': 'modify',
            'POST /:id/feedback': 'modify',
            'PATCH /:id/location': 'modify',
            'PATCH /:id/rca': 'modify',
            'PATCH /:id/close': 'modify'
        }
    },
    // Contacts are added while a ticket is being logged or edited
    { prefix: '/api/csm/customer-contacts', key: 'csm_tickets', routes: { 'POST /': createOrModify('csm_tickets') } },
    {
        prefix: '/api/csm/visits', key: 'csm_visits',
        viewKeys: ['csm_visits', 'csm_dashboard', 'csm_tickets', 'csm_warranties_amc'],
        routes: { 'POST /:id/check-in': 'modify', 'POST /:id/check-out': 'modify', 'PATCH /:id/reschedule': 'modify' }
    },
    { prefix: '/api/csm/attendance', key: 'csm_attendance', routes: { 'POST /check-out': 'create' } },
    { prefix: '/api/csm/entitlements', key: 'csm_warranties_amc', viewKeys: ['csm_warranties_amc', 'csm_tickets'] },
    { prefix: '/api/csm/warranties', key: 'csm_warranties_amc', viewKeys: ['csm_warranties_amc', 'csm_tickets'] },
    { prefix: '/api/csm/amcs', key: 'csm_warranties_amc' },
    {
        prefix: '/api/csm/assets', key: 'csm_warranties_amc',
        viewKeys: ['csm_warranties_amc', 'csm_tickets', 'master_serials', 'master_customers'],
        routes: {
            // An asset is registered while its complaint is logged
            'POST /': { anyOf: [['csm_tickets', 'create'], ['csm_warranties_amc', 'create'], ['master_serials', 'create']] },
            'POST /single': { key: 'master_serials', action: 'create' },
            'POST /:id/return': { key: 'master_serials', action: 'modify' },
            // Saved entries cannot be changed; the controller answers these
            'PUT /:id': SKIP,
            'PATCH /:id': SKIP,
            'DELETE /:id': SKIP
        }
    },
    { prefix: '/api/csm/kb', key: 'csm_kb' },
    { prefix: '/api/csm/rca-reports', key: 'csm_rca' },

    // ── Tenders ───────────────────────────────────────────────────────────
    { prefix: '/api/tenders/dashboard', key: 'tender_dashboard' },
    { prefix: '/api/tenders', key: 'tender_register', viewKeys: ['tender_register', 'tender_reports', 'tender_dashboard'] },

    // ── Imports: each one adds records to its screen ─────────────────────────
    importRule('products', 'master_products'),
    importRule('customers', 'master_customers'),
    // Attribute values of products, like /api/product-attributes
    importRule('attributes', 'master_products', { 'POST /': createOrModify('master_products') }),
    importRule('attribute-master', 'master_attributes'),
    importRule('planning', 'planning_screen'),
    importRule('warranties', 'csm_warranties_amc'),
    importRule('amcs', 'csm_warranties_amc'),
    importRule('tickets', 'csm_tickets'),
    importRule('vendors', 'master_vendors'),
    importRule('price-books', 'sales_price_management'),
    importRule('price-book-items', 'sales_price_management', { 'POST /:priceBookId': 'modify' }),
    importRule('employees', 'payroll_employees'),
    importRule('contacts', 'master_contacts'),
    importRule('contracts', 'sales_contracts'),
    importRule('tenders', 'tender_register'),
    importRule('assets', 'master_serials'),

    // ── Settings ──────────────────────────────────────────────────────────
    { prefix: '/api/company-settings', key: 'settings_profile', openRead: true }
];

const SORTED_RULES = [...API_PERMISSION_RULES].sort((a, b) => b.prefix.length - a.prefix.length);

const segmentsMatch = (pattern, path) => {
    const want = pattern.split('/').filter(Boolean);
    const have = path.split('/').filter(Boolean);
    return want.length === have.length && want.every((segment, index) => segment.startsWith(':') || segment === have[index]);
};

const findRoute = (routes, method, subPath) => {
    if (!routes) return undefined;
    const match = Object.entries(routes).find(([pattern]) => {
        const [routeMethod, routePath] = pattern.split(' ');
        return routeMethod === method && segmentsMatch(routePath, subPath);
    });
    return match?.[1];
};

/** Normalised request path: no query, no trailing or doubled slashes, lower case (Express routes ignore case). */
const requestPath = (req) => {
    const path = String(req.originalUrl || req.url || '').split('?')[0].replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    return (path || '/').toLowerCase();
};

/**
 * The permission a request needs, as { anyOf: [[key, action], ...] } (any one of
 * them is enough), or null when the request is not checked here.
 */
const getApiRequirement = async (req) => {
    const method = String(req.method || '').toUpperCase();
    const defaultAction = METHOD_ACTIONS[method];
    if (!defaultAction) return null;

    const path = requestPath(req);
    const rule = SORTED_RULES.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`));
    if (!rule) return null;

    const subPath = path.slice(rule.prefix.length) || '/';
    let spec;
    if (rule.onlyRoutes) {
        spec = findRoute(rule.onlyRoutes, method, subPath);
        if (!spec) return null;
    } else {
        spec = findRoute(rule.routes, method, subPath);
    }
    if (spec === SKIP) return null;

    if (spec && typeof spec === 'object') {
        return spec.anyOf ? { anyOf: spec.anyOf } : { anyOf: [[spec.key || rule.key, spec.action]] };
    }

    if (!spec && defaultAction === 'view') {
        if (rule.openRead) return null;
        if (rule.viewKeys) return { anyOf: rule.viewKeys.map((key) => [key, 'view']) };
    }

    const action = spec || defaultAction;
    const keys = rule.resolveKeys ? await rule.resolveKeys(req, subPath) : [rule.key];
    return { anyOf: keys.map((key) => [key, action]) };
};

module.exports = {
    API_PERMISSION_RULES,
    SKIP,
    getApiRequirement
};
