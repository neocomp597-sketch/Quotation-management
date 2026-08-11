import React, { useState } from 'react';
import CodeBlock from '../components/CodeBlock';
import { MdBook, MdSend, MdVpnKey, MdCheck, MdCode } from 'react-icons/md';

const MODULES = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', scope: 'dashboard', basePath: '/dashboard' },
    { id: 'customers', label: 'Customers', icon: '👥', scope: 'customers', basePath: '/customers' },
    { id: 'contacts', label: 'Contacts', icon: '📇', scope: 'contacts', basePath: '/contacts' },
    { id: 'leads', label: 'Leads & Enquiry', icon: '🎯', scope: 'leads', basePath: '/leads' },
    { id: 'deals', label: 'Sales Deals', icon: '💼', scope: 'deals', basePath: '/deals' },
    { id: 'products', label: 'Product Catalog', icon: '📦', scope: 'products', basePath: '/products' },
    { id: 'payroll', label: 'Payroll & HR', icon: '💵', scope: 'payroll', basePath: '/payroll' },
    { id: 'quotations', label: 'Quotations', icon: '📄', scope: 'quotations', basePath: '/quotations' },
    { id: 'cpq', label: 'CPQ Engine', icon: '⚙️', scope: 'cpq', basePath: '/cpq' },
    { id: 'sales_catalog', label: 'Catalog Submodules', icon: '🏷️', scope: 'products', basePath: '/sales/catalog' },
    { id: 'orders', label: 'Sales Orders', icon: '🛒', scope: 'orders', basePath: '/orders' },
    { id: 'clm', label: 'Contracts (CLM)', icon: '📑', scope: 'clm', basePath: '/clm' },
    { id: 'csm', label: 'Customer Service', icon: '🛠️', scope: 'csm', basePath: '/csm' },
    { id: 'tenders', label: 'Tenders & Bids', icon: '⚖️', scope: 'tenders', basePath: '/tenders' },
    { id: 'purchase', label: 'Material (GRN)', icon: '📦', scope: 'inventory', basePath: '/grn' },
    { id: 'planning', label: 'Planning Board', icon: '🗓️', scope: 'planning', basePath: '/planning' },
    { id: 'vendors', label: 'Vendors', icon: '🏢', scope: 'vendors', basePath: '/vendors' },
    { id: 'meetings', label: 'Meetings', icon: '📅', scope: 'meetings', basePath: '/meetings' },
    { id: 'reports', label: 'Reports & Analytics', icon: '📈', scope: 'analytics', basePath: '/reports' },
    { id: 'branches', label: 'Branches & Master', icon: '📍', scope: 'branches', basePath: '/branches' },
    { id: 'admin', label: 'Admin & System', icon: '🔒', scope: 'admin', basePath: '/admin' }
];

const ENDPOINT_MAP = {
    dashboard: [
        { method: 'GET', path: '/dashboard/stats', summary: 'Get System Overview KPIs', scope: 'dashboard.read', desc: 'Retrieve aggregated CRM metrics, monthly lead counts, quotation totals, and conversion rates.' },
        { method: 'GET', path: '/dashboard/revenue-summary', summary: 'Get Revenue Summary', scope: 'dashboard.read', desc: 'Fetch top-line revenue snapshots, target achievements, and regional distribution.' }
    ],
    customers: [
        { method: 'GET', path: '/customers', summary: 'List All Customers', scope: 'customers.read', desc: 'Retrieve a paginated list of company customer records with search filter support.' },
        { method: 'GET', path: '/customers/{id}', summary: 'Get Customer Details', scope: 'customers.read', desc: 'Fetch single customer profile by MongoDB object identifier.' },
        { method: 'GET', path: '/customers/{id}/360', summary: 'Customer 360 Workspace', scope: 'customers.read', desc: 'Complete 360 degree view of customer quotations, orders, and interactions.' },
        { method: 'POST', path: '/customers', summary: 'Create New Customer', scope: 'customers.write', desc: 'Create a new customer with contact details, GSTIN, and billing address.' },
        { method: 'PATCH', path: '/customers/{id}', summary: 'Update Customer Profile', scope: 'customers.write', desc: 'Update specific fields of an existing customer record.' },
        { method: 'DELETE', path: '/customers/{id}', summary: 'Delete Customer', scope: 'customers.write', desc: 'Remove a customer record permanently from your organization.' }
    ],
    contacts: [
        { method: 'GET', path: '/contacts', summary: 'List Contacts Directory', scope: 'contacts.read', desc: 'Retrieve corporate contact directory entries.' },
        { method: 'GET', path: '/contacts/{id}', summary: 'Get Contact Details', scope: 'contacts.read', desc: 'Fetch individual decision maker contact details.' },
        { method: 'GET', path: '/contacts/{id}/360', summary: 'Contact 360 Workspace', scope: 'contacts.read', desc: 'Contact 360 view with activity history and meeting notes.' },
        { method: 'POST', path: '/contacts', summary: 'Create Contact', scope: 'contacts.write', desc: 'Add a new contact to a customer or lead record.' }
    ],
    leads: [
        { method: 'GET', path: '/leads', summary: 'List Sales Inquiries', scope: 'leads.read', desc: 'Fetch incoming leads and inquiry records.' },
        { method: 'GET', path: '/leads/{id}', summary: 'Get Lead Details', scope: 'leads.read', desc: 'Fetch lead valuation and product requirement details.' },
        { method: 'POST', path: '/leads', summary: 'Capture New Lead', scope: 'leads.write', desc: 'Submit a new incoming sales lead.' },
        { method: 'GET', path: '/enquiries/analytics', summary: 'Lead Conversion Analytics', scope: 'leads.read', desc: 'Lead volume trendlines, source attribution, and conversion drop-off.' }
    ],
    deals: [
        { method: 'GET', path: '/deals', summary: 'List Sales Pipeline Deals', scope: 'deals.read', desc: 'Retrieve all active deals across pipeline stages.' },
        { method: 'GET', path: '/deals/{id}', summary: 'Get Deal Timeline & Details', scope: 'deals.read', desc: 'Fetch deal stage history and opportunity line items.' },
        { method: 'POST', path: '/deals', summary: 'Create Deal', scope: 'deals.write', desc: 'Create a new deal opportunity.' },
        { method: 'GET', path: '/sales/pipelines', summary: 'List Sales Pipelines', scope: 'deals.read', desc: 'Fetch sales pipeline stage definitions and win probability ratios.' },
        { method: 'GET', path: '/sales/forecasts', summary: 'Sales Revenue Forecast', scope: 'sales.read', desc: 'Weighted revenue projections and commit stage estimates.' },
        { method: 'GET', path: '/sales/activities', summary: 'Sales Rep Activity Logs', scope: 'sales.read', desc: 'Log customer calls, presentations, and sales tasks.' },
        { method: 'GET', path: '/sales/targets', summary: 'Sales Targets & Quotas', scope: 'sales.read', desc: 'Quota allocations and team monthly achievements.' }
    ],
    products: [
        { method: 'GET', path: '/products', summary: 'List Product Catalog', scope: 'products.read', desc: 'Retrieve product master list with HSN codes, tax slabs, and unit prices.' },
        { method: 'POST', path: '/products', summary: 'Create Catalog Product', scope: 'products.write', desc: 'Add a new product SKU to master catalog.' },
        { method: 'GET', path: '/attributes', summary: 'List Product Attributes', scope: 'products.read', desc: 'Fetch configurable product attributes and specifications.' },
        { method: 'GET', path: '/mgrs', summary: 'List Material Group References (MGR)', scope: 'products.read', desc: 'Retrieve product family segment reference codes.' }
    ],
    sales_catalog: [
        { method: 'GET', path: '/sales/catalog/products', summary: 'Hardware Products Catalog', scope: 'products.read', desc: 'Physical machinery, hardware items, and equipment SKUs.' },
        { method: 'GET', path: '/sales/catalog/services', summary: 'Professional Services Catalog', scope: 'products.read', desc: 'Service packages, installation fees, and consulting.' },
        { method: 'GET', path: '/sales/catalog/bundles', summary: 'Product Bundles & Kits', scope: 'products.read', desc: 'Pre-packaged product bundles and starter kits.' },
        { method: 'GET', path: '/sales/catalog/subscriptions', summary: 'SaaS Subscriptions', scope: 'products.read', desc: 'Recurring license offerings and billing terms.' }
    ],
    payroll: [
        { method: 'GET', path: '/payroll/dashboard', summary: 'Payroll Overview Metrics', scope: 'payroll.read', desc: 'Get current payroll run summary, total gross disbursal, and employee counts.' },
        { method: 'GET', path: '/payroll/employees', summary: 'List Employee Roster', scope: 'payroll.read', desc: 'Retrieve organization employee profiles and active designations.' },
        { method: 'POST', path: '/payroll/runs', summary: 'Execute Payroll Run', scope: 'payroll.write', desc: 'Trigger monthly salary processing and tax calculations.' },
        { method: 'GET', path: '/payroll/payments', summary: 'Bank Disbursal Logs', scope: 'payroll.read', desc: 'Bank payout files and salary credit verifications.' },
        { method: 'GET', path: '/payroll/payslips', summary: 'Retrieve Employee Payslips', scope: 'payroll.read', desc: 'Fetch itemized employee salary slips.' },
        { method: 'GET', path: '/payroll/letters', summary: 'HR Generated Letters', scope: 'payroll.read', desc: 'Offer letters, increment notices, and experience certificates.' },
        { method: 'GET', path: '/payroll/reports', summary: 'Payroll Compliance Reports', scope: 'payroll.read', desc: 'PF returns, ESI statements, and Form 16 summaries.' }
    ],
    quotations: [
        { method: 'GET', path: '/quotations', summary: 'List Quotations', scope: 'quotations.read', desc: 'Retrieve generated commercial quotations with status filters.' },
        { method: 'POST', path: '/quotations', summary: 'Create Quotation Proposal', scope: 'quotations.write', desc: 'Generate multi-item quote with taxes and payment terms.' },
        { method: 'GET', path: '/quotations/conversion-report', summary: 'Quote Conversion Report', scope: 'quotations.read', desc: 'Win/loss ratio reports and quote cycle durations.' },
        { method: 'GET', path: '/terms', summary: 'List Standard Terms & Conditions', scope: 'quotations.read', desc: 'Retrieve commercial terms clauses and legal disclaimers.' }
    ],
    cpq: [
        { method: 'GET', path: '/cpq/price-books', summary: 'List Price Books', scope: 'cpq.read', desc: 'Tiered price lists, customer tier rates, and list revisions.' },
        { method: 'GET', path: '/cpq/pricing-rules', summary: 'List Pricing Rules', scope: 'cpq.read', desc: 'Quantity price breaks, volume rules, and surcharge logic.' },
        { method: 'GET', path: '/cpq/discounts', summary: 'Discount Policies', scope: 'cpq.read', desc: 'Max discount limits and margin protection caps.' },
        { method: 'GET', path: '/sales/customer-pricing', summary: 'Customer Special Rates', scope: 'cpq.read', desc: 'Contracted customer pricing agreements and discount tiers.' },
        { method: 'POST', path: '/cpq/configurator', summary: 'Run Product Configurator', scope: 'cpq.write', desc: 'Dynamic assembly rules engine for complex product packages.' },
        { method: 'POST', path: '/cpq/simulator', summary: 'Simulate Deal Pricing', scope: 'cpq.read', desc: 'Estimate margins, freight fees, and net proposal revenue.' }
    ],
    orders: [
        { method: 'GET', path: '/orders', summary: 'List Sales Orders', scope: 'orders.read', desc: 'Retrieve confirmed customer vouchers, sales orders, and invoices.' },
        { method: 'POST', path: '/orders', summary: 'Create Sales Order', scope: 'orders.write', desc: 'Convert an approved quotation into a binding sales order.' },
        { method: 'GET', path: '/invoices', summary: 'List Invoices & Billing', scope: 'orders.read', desc: 'Tax invoices, proforma billing documents, and collection status.' }
    ],
    clm: [
        { method: 'GET', path: '/clm/contracts', summary: 'List Legal Contracts', scope: 'clm.read', desc: 'Master contract directory, executed agreements, and milestone dates.' },
        { method: 'POST', path: '/clm/contracts', summary: 'Draft New Contract', scope: 'clm.write', desc: 'Create contract record from template and clause parameters.' },
        { method: 'GET', path: '/clm/templates', summary: 'Contract Templates Library', scope: 'clm.read', desc: 'Standardized MSA, SLA, NDA, and agreement formats.' },
        { method: 'GET', path: '/clm/renewals', summary: 'Contract Renewals Pipeline', scope: 'clm.read', desc: 'Upcoming 90-day contract expiration notices and expansion leads.' }
    ],
    csm: [
        { method: 'GET', path: '/csm/tickets', summary: 'List Service Tickets', scope: 'csm.read', desc: 'Customer complaint tickets, severity levels, and resolution logs.' },
        { method: 'GET', path: '/csm/tickets/{id}', summary: 'Ticket Workspace Detail', scope: 'csm.read', desc: 'Ticket workspace with communication history and notes.' },
        { method: 'POST', path: '/csm/tickets', summary: 'Create Service Ticket', scope: 'csm.write', desc: 'Log a new equipment breakdown or service inquiry ticket.' },
        { method: 'GET', path: '/csm/visits', summary: 'Field Service Visits', scope: 'csm.read', desc: 'Dispatched service engineer visits and on-site inspection logs.' },
        { method: 'GET', path: '/csm/warranties-amc', summary: 'Warranty & AMC Contracts', scope: 'csm.read', desc: 'Equipment warranty validity and annual service contracts.' }
    ],
    tenders: [
        { method: 'GET', path: '/tender/dashboard', summary: 'Tender Overview Dashboard', scope: 'tenders.read', desc: 'Active tenders summary, bid valuations, and deadlines.' },
        { method: 'GET', path: '/tender/register', summary: 'List Tenders Register', scope: 'tenders.read', desc: 'Master directory of tender notices, bid submission dates, and EMDs.' },
        { method: 'POST', path: '/tender/register', summary: 'Register New Tender', scope: 'tenders.write', desc: 'Add new tender opportunity with RFP requirements.' },
        { method: 'GET', path: '/tender/reports', summary: 'Tender Win/Loss Analytics', scope: 'tenders.read', desc: 'Tender bid outcomes, win percentages, and EMD refund logs.' }
    ],
    purchase: [
        { method: 'GET', path: '/grn', summary: 'List Goods Receipt Notes', scope: 'inventory.read', desc: 'Track incoming material receipts, vendor delivery notes, and serials.' },
        { method: 'POST', path: '/grn', summary: 'Create GRN Entry', scope: 'inventory.write', desc: 'Log new stock inward entry and warehouse allocation.' }
    ],
    planning: [
        { method: 'GET', path: '/planning', summary: 'Planning Matrix Data', scope: 'planning.read', desc: 'Resource capacity planning, production schedules, and utilization.' },
        { method: 'GET', path: '/simulations', summary: 'What-If Capacity Models', scope: 'planning.read', desc: 'Capacity bottleneck simulation models and load balancing.' }
    ],
    vendors: [
        { method: 'GET', path: '/vendors', summary: 'List Vendors', scope: 'vendors.read', desc: 'Retrieve vendor master directory and GSTIN numbers.' },
        { method: 'GET', path: '/vendors/{id}/360', summary: 'Vendor 360 Workspace', scope: 'vendors.read', desc: 'Vendor performance 360 view with GRN history and item quotes.' },
        { method: 'POST', path: '/vendors', summary: 'Create Vendor', scope: 'vendors.write', desc: 'Create new supplier vendor profile.' }
    ],
    meetings: [
        { method: 'GET', path: '/meetings', summary: 'List Scheduled Meetings', scope: 'meetings.read', desc: 'Fetch customer meeting schedule.' },
        { method: 'POST', path: '/meetings', summary: 'Schedule Meeting', scope: 'meetings.write', desc: 'Schedule a new customer visit or demo.' }
    ],
    reports: [
        { method: 'GET', path: '/reports', summary: 'List Standard Reports', scope: 'analytics.read', desc: 'Centralized directory of exportable business performance reports.' },
        { method: 'GET', path: '/sales/analytics', summary: 'Sales Analytics Charts', scope: 'analytics.read', desc: 'Monthly sales trendlines and average order size.' },
        { method: 'GET', path: '/sales/revenue-analytics', summary: 'Revenue Growth Metrics', scope: 'analytics.read', desc: 'Year-over-year revenue comparisons and growth metrics.' },
        { method: 'GET', path: '/customers/analytics', summary: 'Customer Lifetime Analytics', scope: 'analytics.read', desc: 'CLV scores, churn risk, and RFM customer segments.' },
        { method: 'GET', path: '/sales/competitors', summary: 'Competitor Intelligence', scope: 'sales.read', desc: 'Competitor price benchmarks and battle cards.' },
        { method: 'GET', path: '/sales/ai-pricing', summary: 'AI Pricing Insights', scope: 'cpq.read', desc: 'ML recommendations for optimal deal pricing.' }
    ],
    branches: [
        { method: 'GET', path: '/branches', summary: 'List Office Branches', scope: 'branches.read', desc: 'Retrieve company branch master directory.' },
        { method: 'GET', path: '/territories', summary: 'List Territory Zones', scope: 'branches.read', desc: 'Regional PIN code mappings and sales territory bounds.' },
        { method: 'GET', path: '/states', summary: 'List State Directory', scope: 'branches.read', desc: 'State directory and GST state codes.' },
        { method: 'GET', path: '/cities', summary: 'List City Master', scope: 'branches.read', desc: 'Tier-1/2/3 city classifications.' }
    ],
    admin: [
        { method: 'GET', path: '/admin/authorization', summary: 'RBAC Access Matrix', scope: 'admin.read', desc: 'User role matrix and scope authorization limits.' },
        { method: 'GET', path: '/salespersons', summary: 'Salespersons Roster', scope: 'admin.read', desc: 'Sales representative directory and manager assignments.' },
        { method: 'GET', path: '/admin/landing-plans', summary: 'Landing Plan Manager', scope: 'admin.read', desc: 'Whitelabel plans and marketing configurations.' },
        { method: 'GET', path: '/super-admin', summary: 'Super Admin Metrics', scope: 'system.read', desc: 'Tenant statistics and database health.' },
        { method: 'GET', path: '/system-updates', summary: 'System Release Updates', scope: 'system.read', desc: 'Changelog history and feature flags.' }
    ]
};

const ApiReference = () => {
    const [selectedModule, setSelectedModule] = useState('customers');
    const [selectedEndpointIndex, setSelectedEndpointIndex] = useState(0);

    // Interactive Try It runner
    const [apiKey, setApiKey] = useState('');
    const [testPath, setTestPath] = useState('/customers');
    const [testMethod, setTestMethod] = useState('GET');
    const [testBody, setTestBody] = useState('{\n  "customerName": "Acme Global Solutions",\n  "companyName": "Acme Corp",\n  "mobile": "+91 9876543210"\n}');
    const [running, setRunning] = useState(false);
    const [responseResult, setResponseResult] = useState(null);

    const activeEndpoints = ENDPOINT_MAP[selectedModule] || [];
    const activeEndpoint = activeEndpoints[selectedEndpointIndex] || activeEndpoints[0];

    const handleSelectModule = (modId) => {
        setSelectedModule(modId);
        setSelectedEndpointIndex(0);
        const firstEp = (ENDPOINT_MAP[modId] || [])[0];
        if (firstEp) {
            setTestPath(firstEp.path.replace('{id}', '65cb7f92a10e82c1'));
            setTestMethod(firstEp.method);
        }
    };

    const handleSelectEndpoint = (ep, idx) => {
        setSelectedEndpointIndex(idx);
        setTestPath(ep.path.replace('{id}', '65cb7f92a10e82c1'));
        setTestMethod(ep.method);
    };

    const handleExecuteRequest = async (e) => {
        e.preventDefault();
        try {
            setRunning(true);
            setResponseResult(null);

            const headers = { 'Content-Type': 'application/json' };
            if (apiKey.trim()) {
                headers['Authorization'] = `Bearer ${apiKey.trim()}`;
            }

            const options = { method: testMethod, headers };
            if (['POST', 'PATCH', 'PUT'].includes(testMethod) && testBody.trim()) {
                options.body = testBody;
            }

            const startTime = Date.now();
            const res = await fetch(`https://arcrm.co.in/api/v1${testPath}`, options);
            const duration = Date.now() - startTime;

            let data;
            try { data = await res.json(); } catch (err) { data = { raw: await res.text() }; }

            setResponseResult({
                status: res.status,
                durationMs: duration,
                headers: Object.fromEntries(res.headers.entries()),
                body: data
            });
        } catch (error) {
            console.error('Request Execution Error:', error);
            setResponseResult({
                status: 0,
                error: error.message || 'Failed to connect to API server'
            });
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <MdBook className="text-[#006c49]" size={26} />
                    API Explorer & Interactive Console
                </h1>
                <p className="text-slate-500 text-xs font-medium mt-1">
                    Explore API documentation across all system modules, inspect schemas, and execute live HTTP requests directly against your environment.
                </p>
            </div>

            {/* Module Selector Pills */}
            <div className="flex flex-wrap gap-2 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm max-h-[160px] overflow-y-auto custom-scrollbar">
                {MODULES.map(mod => (
                    <button
                        key={mod.id}
                        onClick={() => handleSelectModule(mod.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                            selectedModule === mod.id
                                ? 'bg-[#006c49] text-white shadow-md shadow-[#006c49]/20'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <span>{mod.icon}</span>
                        <span>{mod.label}</span>
                    </button>
                ))}
            </div>

            {/* 2-Column API Explorer Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Endpoints Directory Column */}
                <div className="lg:col-span-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 mb-2">
                        {selectedModule.toUpperCase()} ENDPOINTS ({activeEndpoints.length})
                    </div>
                    <div className="space-y-1">
                        {activeEndpoints.map((ep, idx) => {
                            const isSelected = selectedEndpointIndex === idx;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => handleSelectEndpoint(ep, idx)}
                                    className={`p-3 rounded-2xl cursor-pointer border transition-all ${
                                        isSelected
                                            ? 'bg-[#006c49]/10 border-[#006c49]/40 text-slate-900 shadow-sm'
                                            : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                                            ep.method === 'GET' ? 'bg-emerald-100 text-emerald-800' :
                                            ep.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                                            ep.method === 'PATCH' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                        }`}>
                                            {ep.method}
                                        </span>
                                        <span className="font-mono text-xs font-bold text-slate-800">{ep.path}</span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-900 mt-1">{ep.summary}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Interactive Inspector & Sandbox Column */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Endpoint Details Card */}
                    {activeEndpoint && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-black uppercase ${
                                            activeEndpoint.method === 'GET' ? 'bg-emerald-100 text-emerald-800' :
                                            activeEndpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                                            activeEndpoint.method === 'PATCH' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                        }`}>
                                            {activeEndpoint.method}
                                        </span>
                                        <h2 className="text-lg font-black text-slate-900">{activeEndpoint.summary}</h2>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium mt-1">{activeEndpoint.desc}</p>
                                </div>
                                <span className="px-3 py-1 bg-slate-100 text-slate-700 font-mono text-xs font-bold rounded-lg border border-slate-200">
                                    Scope: {activeEndpoint.scope}
                                </span>
                            </div>

                            {/* Endpoint Path Banner */}
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs font-bold text-[#006c49]">
                                https://arcrm.co.in/api/v1{activeEndpoint.path}
                            </div>

                            {/* Standard Response JSON Preview */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Standard Response Payload</h4>
                                <CodeBlock code={`{
  "succeeded": true,
  "message": "Operation completed successfully",
  "data": [
    {
      "id": "65cb7f92a10e82c1",
      "status": "Active",
      "createdAt": "2026-08-11T12:00:00Z"
    }
  ],
  "pagination": {
    "pageIndex": 1,
    "pageSize": 25,
    "totalCount": 1,
    "totalPages": 1
  }
}`} language="json" title="Standard 200 OK Response Envelope" />
                            </div>
                        </div>
                    )}

                    {/* Interactive Sandbox Form */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <MdSend className="text-[#006c49]" size={18} />
                            Interactive HTTP Sandbox Console
                        </h3>

                        <form onSubmit={handleExecuteRequest} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">API Key Bearer Token</label>
                                <div className="flex bg-slate-50 rounded-xl border border-slate-200 overflow-hidden font-mono text-xs">
                                    <span className="px-3 py-2.5 bg-slate-100 text-slate-500 font-bold shrink-0 border-r border-slate-200">Bearer</span>
                                    <input
                                        type="text"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="arcrm_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                                        className="w-full bg-transparent px-3 py-2.5 text-[#006c49] font-bold outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Method</label>
                                    <select
                                        value={testMethod}
                                        onChange={(e) => setTestMethod(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs font-bold"
                                    >
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="PATCH">PATCH</option>
                                        <option value="DELETE">DELETE</option>
                                    </select>
                                </div>

                                <div className="md:col-span-3">
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Resource Path</label>
                                    <input
                                        type="text"
                                        value={testPath}
                                        onChange={(e) => setTestPath(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-[#006c49] font-bold outline-none"
                                    />
                                </div>
                            </div>

                            {['POST', 'PATCH'].includes(testMethod) && (
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">JSON Payload Body</label>
                                    <textarea
                                        value={testBody}
                                        onChange={(e) => setTestBody(e.target.value)}
                                        rows="4"
                                        className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs outline-none resize-y text-slate-900 font-medium"
                                    ></textarea>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={running}
                                className="px-6 py-3 rounded-xl bg-[#006c49] hover:bg-[#005237] text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-[#006c49]/20 flex items-center gap-2"
                            >
                                <MdSend size={16} />
                                <span>{running ? 'Executing Request...' : 'Send Live Request'}</span>
                            </button>
                        </form>

                        {/* Live Response Result Box */}
                        {responseResult && (
                            <div className="pt-4 border-t border-slate-100 space-y-2">
                                <div className="flex items-center justify-between text-xs font-mono">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-500">Status:</span>
                                        <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                                            responseResult.status >= 200 && responseResult.status < 300 
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                                        }`}>
                                            {responseResult.status || 'Connection Error'}
                                        </span>
                                    </div>
                                    {responseResult.durationMs && (
                                        <span className="text-slate-400 font-sans font-bold">{responseResult.durationMs} ms</span>
                                    )}
                                </div>

                                <CodeBlock 
                                    code={JSON.stringify(responseResult.body || responseResult.error, null, 2)} 
                                    language="json" 
                                    title="Live HTTP Response JSON" 
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApiReference;
