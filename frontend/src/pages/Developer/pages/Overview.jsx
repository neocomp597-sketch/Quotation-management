import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import {
    MdVpnKey,
    MdBook,
    MdRocketLaunch,
    MdArrowForward,
    MdSearch,
    MdFilterList,
    MdCheckCircle,
    MdLayers,
    MdSpeed,
    MdCode
} from 'react-icons/md';

const ALL_SYSTEM_MODULES = [
    {
        categoryId: 'dashboard',
        categoryName: 'Dashboard & Intelligence',
        moduleTitle: 'Dashboard & Core System',
        icon: '📊',
        subModules: [
            { title: 'Overview Statistics', desc: 'Retrieve aggregated CRM metrics, monthly lead counts, active quotation totals, and conversion velocity.', endpoint: 'GET /api/v1/dashboard/stats', scope: 'dashboard.read', method: 'GET', modId: 'dashboard' },
            { title: 'Revenue KPI Summary', desc: 'Fetch top-line revenue snapshots, target achievements, and regional sales distribution.', endpoint: 'GET /api/v1/dashboard/revenue-summary', scope: 'dashboard.read', method: 'GET', modId: 'dashboard' }
        ]
    },
    {
        categoryId: 'master',
        categoryName: 'Master Data',
        moduleTitle: 'Master Directory & Entities',
        icon: '📁',
        subModules: [
            { title: 'Customers Master', desc: 'Manage customer accounts, corporate profiles, GSTIN validation, and billing addresses.', endpoint: 'GET /api/v1/customers', scope: 'customers.read', method: 'GET', modId: 'customers' },
            { title: 'Customer 360 Workspace', desc: 'Comprehensive customer 360 degree view including quotation history, orders, and interactions.', endpoint: 'GET /api/v1/customers/{id}/360', scope: 'customers.read', method: 'GET', modId: 'customers' },
            { title: 'Contacts Directory', desc: 'Corporate contact directory, designations, key decision makers, and direct lines.', endpoint: 'GET /api/v1/contacts', scope: 'contacts.read', method: 'GET', modId: 'contacts' },
            { title: 'Contact 360 Workspace', desc: 'Individual contact 360 view with activity logs, linked leads, and meeting notes.', endpoint: 'GET /api/v1/contacts/{id}/360', scope: 'contacts.read', method: 'GET', modId: 'contacts' },
            { title: 'Vendors Master', desc: 'Supplier and vendor master catalog, tax credentials, and supplier item mappings.', endpoint: 'GET /api/v1/vendors', scope: 'vendors.read', method: 'GET', modId: 'vendors' },
            { title: 'Vendor 360 Workspace', desc: 'Vendor performance 360 view with GRN history, item quotes, and supplier metrics.', endpoint: 'GET /api/v1/vendors/{id}/360', scope: 'vendors.read', method: 'GET', modId: 'vendors' },
            { title: 'Product Catalog', desc: 'Product master items, HSN/SAC codes, tax slabs, unit-of-measure pricing, and SKUs.', endpoint: 'GET /api/v1/products', scope: 'products.read', method: 'GET', modId: 'products' },
            { title: 'Employees Master', desc: 'Organization employee profiles, employment status, reporting managers, and departments.', endpoint: 'GET /api/v1/payroll/employees', scope: 'employees.read', method: 'GET', modId: 'payroll' },
            { title: 'Org Hierarchy Chart', desc: 'Fetch reporting trees, organizational nodes, and departmental sub-structures.', endpoint: 'GET /api/v1/payroll/org-chart', scope: 'employees.read', method: 'GET', modId: 'payroll' },
            { title: 'Department Master', desc: 'Company department definitions, cost centers, and head of department assignments.', endpoint: 'GET /api/v1/payroll/departments', scope: 'master.read', method: 'GET', modId: 'payroll' },
            { title: 'Designation Master', desc: 'Job roles, designation grades, and authorization bands across departments.', endpoint: 'GET /api/v1/payroll/designations', scope: 'master.read', method: 'GET', modId: 'payroll' },
            { title: 'Territory Master', desc: 'Regional boundaries, PIN code mappings, and geographic sales territory assignments.', endpoint: 'GET /api/v1/territories', scope: 'territories.read', method: 'GET', modId: 'branches' },
            { title: 'Branch Master', desc: 'Company branch offices, state registrations, GSTIN numbers, and warehouse locations.', endpoint: 'GET /api/v1/branches', scope: 'branches.read', method: 'GET', modId: 'branches' },
            { title: 'State Master', desc: 'State directory, GST state codes, and inter-state vs intra-state tax definitions.', endpoint: 'GET /api/v1/states', scope: 'master.read', method: 'GET', modId: 'branches' },
            { title: 'City Master', desc: 'Tier-1/2/3 city classifications, postal zones, and regional cluster codes.', endpoint: 'GET /api/v1/cities', scope: 'master.read', method: 'GET', modId: 'branches' },
            { title: 'Engineers Master', desc: 'Field service engineer profiles, technical certifications, and service zone mappings.', endpoint: 'GET /api/v1/csm/engineers', scope: 'csm.read', method: 'GET', modId: 'csm' },
            { title: 'MGR Master', desc: 'Material Group Reference (MGR) codes, product family categorizations, and segments.', endpoint: 'GET /api/v1/mgrs', scope: 'master.read', method: 'GET', modId: 'products' },
            { title: 'Product Attributes', desc: 'Dynamic technical specifications, configurable product parameters, and attributes.', endpoint: 'GET /api/v1/attributes', scope: 'products.read', method: 'GET', modId: 'products' },
            { title: 'Terms & Conditions', desc: 'Standard quotation clauses, legal disclaimers, payment terms, and warranty rules.', endpoint: 'GET /api/v1/terms', scope: 'master.read', method: 'GET', modId: 'quotations' },
            { title: 'Status Master', desc: 'Workflow status transitions, lifecycle stages, and color code mappings.', endpoint: 'GET /api/v1/statuses', scope: 'master.read', method: 'GET', modId: 'master' },
            { title: 'Serial Number Master', desc: 'Machine equipment serial numbers, barcode records, and dispatch tracking.', endpoint: 'GET /api/v1/serials', scope: 'master.read', method: 'GET', modId: 'master' },
            { title: 'Flowchart Builder', desc: 'Visual workflow diagrams, process maps, and custom approval sequence nodes.', endpoint: 'GET /api/v1/flowcharts', scope: 'master.read', method: 'GET', modId: 'master' }
        ]
    },
    {
        categoryId: 'payroll',
        categoryName: 'Payroll & HR',
        moduleTitle: 'Payroll & Human Resources',
        icon: '💵',
        subModules: [
            { title: 'Payroll Dashboard', desc: 'Summary of payroll cycles, gross disbursal figures, tax deductions, and active runs.', endpoint: 'GET /api/v1/payroll/dashboard', scope: 'payroll.read', method: 'GET', modId: 'payroll' },
            { title: 'Run Payroll Execution', desc: 'Execute monthly payroll processing, salary calculations, and allowance computations.', endpoint: 'POST /api/v1/payroll/runs', scope: 'payroll.write', method: 'POST', modId: 'payroll' },
            { title: 'Payments & Disbursal', desc: 'Bank payout files, batch transfer logs, and employee salary credit verifications.', endpoint: 'GET /api/v1/payroll/payments', scope: 'payroll.read', method: 'GET', modId: 'payroll' },
            { title: 'Employee Payslips', desc: 'Generate and retrieve itemized employee salary slips in PDF/JSON formats.', endpoint: 'GET /api/v1/payroll/payslips', scope: 'payroll.read', method: 'GET', modId: 'payroll' },
            { title: 'HR Letters & Documents', desc: 'Issue automated offer letters, increment letters, experience certificates, and NDAs.', endpoint: 'GET /api/v1/payroll/letters', scope: 'payroll.read', method: 'GET', modId: 'payroll' },
            { title: 'Payroll Reports', desc: 'PF returns, ESI compliance statements, Form 16 tax summaries, and payout audit logs.', endpoint: 'GET /api/v1/payroll/reports', scope: 'payroll.read', method: 'GET', modId: 'payroll' },
            { title: 'Payroll Configuration', desc: 'PF/ESI rules, professional tax brackets, TDS slabs, and salary structure settings.', endpoint: 'GET /api/v1/payroll/settings', scope: 'payroll.write', method: 'GET', modId: 'payroll' },
            { title: 'Payroll Masters', desc: 'Department and designation master definitions for HR payroll management.', endpoint: 'GET /api/v1/payroll/masters', scope: 'payroll.read', method: 'GET', modId: 'payroll' }
        ]
    },
    {
        categoryId: 'enquiry',
        categoryName: 'Enquiry & Leads',
        moduleTitle: 'Enquiries & Lead Management',
        icon: '🎯',
        subModules: [
            { title: 'Enquiry Register', desc: 'Capture web inquiries, incoming lead records, customer requirements, and channel sources.', endpoint: 'GET /api/v1/leads', scope: 'leads.read', method: 'GET', modId: 'leads' },
            { title: 'Capture Incoming Lead', desc: 'Programmatically submit leads from external landing pages, forms, or webhooks.', endpoint: 'POST /api/v1/leads', scope: 'leads.write', method: 'POST', modId: 'leads' },
            { title: 'Enquiry Analytics', desc: 'Lead volume trendlines, source attribution, response time metrics, and drop-off analysis.', endpoint: 'GET /api/v1/enquiries/analytics', scope: 'leads.read', method: 'GET', modId: 'leads' }
        ]
    },
    {
        categoryId: 'sales_pipeline',
        categoryName: 'Sales Pipeline',
        moduleTitle: 'Sales Pipeline & Opportunities',
        icon: '💼',
        subModules: [
            { title: 'Pipeline Dashboard', desc: 'Pipeline stage velocity, total open opportunity valuations, and deal distribution.', endpoint: 'GET /api/v1/sales/pipeline-summary', scope: 'deals.read', method: 'GET', modId: 'deals' },
            { title: 'Pipelines Configurator', desc: 'Custom sales pipeline stages, probability percentages, and stage gate requirements.', endpoint: 'GET /api/v1/sales/pipelines', scope: 'deals.read', method: 'GET', modId: 'deals' },
            { title: 'Deals Opportunities', desc: 'Manage qualified sales opportunities, target closure dates, and expected values.', endpoint: 'GET /api/v1/deals', scope: 'deals.read', method: 'GET', modId: 'deals' },
            { title: 'Deal Detail & Timeline', desc: 'Individual deal view with stage history, line item valuations, and notes.', endpoint: 'GET /api/v1/deals/{id}', scope: 'deals.read', method: 'GET', modId: 'deals' },
            { title: 'Sales Forecasting', desc: 'Weighted revenue projections, commit stage forecasts, and best-case estimates.', endpoint: 'GET /api/v1/sales/forecasts', scope: 'sales.read', method: 'GET', modId: 'deals' },
            { title: 'Sales Activity Logs', desc: 'Log customer calls, emails, product presentations, and sales representative tasks.', endpoint: 'GET /api/v1/sales/activities', scope: 'sales.read', method: 'GET', modId: 'deals' },
            { title: 'Sales Targets & Quotas', desc: 'Quota allocations, monthly rep targets, team achievements, and quota variance.', endpoint: 'GET /api/v1/sales/targets', scope: 'sales.read', method: 'GET', modId: 'deals' },
            { title: 'Sales Reports', desc: 'Rep performance, stage conversion time, and monthly sales pipeline activity.', endpoint: 'GET /api/v1/sales/reports', scope: 'sales.read', method: 'GET', modId: 'deals' }
        ]
    },
    {
        categoryId: 'meetings',
        categoryName: 'Appointments',
        moduleTitle: 'Appointments & Field Visits',
        icon: '📅',
        subModules: [
            { title: 'Appointments Register', desc: 'Schedule customer product demos, site inspection visits, and follow-up meetings.', endpoint: 'GET /api/v1/meetings', scope: 'meetings.read', method: 'GET', modId: 'meetings' },
            { title: 'Schedule Meeting', desc: 'Book appointment slots with customer contacts, set reminders, and log meeting agendas.', endpoint: 'POST /api/v1/meetings', scope: 'meetings.write', method: 'POST', modId: 'meetings' }
        ]
    },
    {
        categoryId: 'sales_catalog',
        categoryName: 'Product Submodules',
        moduleTitle: 'Catalog & Offerings Submodules',
        icon: '🏷️',
        subModules: [
            { title: 'Product Catalog Items', desc: 'Physical hardware products, machinery SKUs, and spare part catalogs.', endpoint: 'GET /api/v1/sales/catalog/products', scope: 'products.read', method: 'GET', modId: 'products' },
            { title: 'Service Catalog Offerings', desc: 'Professional services, installation packages, AMC coverage, and consulting.', endpoint: 'GET /api/v1/sales/catalog/services', scope: 'products.read', method: 'GET', modId: 'products' },
            { title: 'Product Bundles & Kits', desc: 'Pre-configured product bundles, starter kits, and promotional packages.', endpoint: 'GET /api/v1/sales/catalog/bundles', scope: 'products.read', method: 'GET', modId: 'products' },
            { title: 'Subscription Offerings', desc: 'SaaS subscriptions, recurring service licenses, and billing intervals.', endpoint: 'GET /api/v1/sales/catalog/subscriptions', scope: 'products.read', method: 'GET', modId: 'products' }
        ]
    },
    {
        categoryId: 'cpq_catalog',
        categoryName: 'CPQ & Pricing',
        moduleTitle: 'Configure Price Quote (CPQ)',
        icon: '⚙️',
        subModules: [
            { title: 'Price Books Master', desc: 'Tiered price lists, customer tier pricing, dealer rates, and list price revisions.', endpoint: 'GET /api/v1/cpq/price-books', scope: 'cpq.read', method: 'GET', modId: 'products' },
            { title: 'Pricing Rules Engine', desc: 'Quantity discount matrices, volume price breaks, and automated surcharge logic.', endpoint: 'GET /api/v1/cpq/pricing-rules', scope: 'cpq.read', method: 'GET', modId: 'products' },
            { title: 'Discount Policies', desc: 'Max allowable discount caps, margin protection thresholds, and approval rules.', endpoint: 'GET /api/v1/cpq/discounts', scope: 'cpq.read', method: 'GET', modId: 'products' },
            { title: 'Promotions & Offers', desc: 'Seasonal promotional codes, bundled packages, and limited-time discount campaigns.', endpoint: 'GET /api/v1/cpq/promotions', scope: 'cpq.read', method: 'GET', modId: 'products' },
            { title: 'Currency Exchange Rates', desc: 'Multi-currency exchange rates, base currency conversions, and FX spot rates.', endpoint: 'GET /api/v1/cpq/currencies', scope: 'cpq.read', method: 'GET', modId: 'products' },
            { title: 'Customer Pricing Dashboard', desc: 'Special customer contract pricing rates, negotiated discount tiers, and histories.', endpoint: 'GET /api/v1/sales/customer-pricing', scope: 'cpq.read', method: 'GET', modId: 'products' }
        ]
    },
    {
        categoryId: 'quotations',
        categoryName: 'Quotations & Orders',
        moduleTitle: 'Quotations & Invoicing',
        icon: '📄',
        subModules: [
            { title: 'Quotation Register', desc: 'Fetch generated sales quotations, line item details, taxes, grand totals, and status.', endpoint: 'GET /api/v1/quotations', scope: 'quotations.read', method: 'GET', modId: 'quotations' },
            { title: 'Generate Quotation', desc: 'Create complex commercial proposals with multi-item tax breakdown and terms.', endpoint: 'POST /api/v1/quotations', scope: 'quotations.write', method: 'POST', modId: 'quotations' },
            { title: 'Pending Approval Quotes', desc: 'Queue of high-value proposals awaiting commercial discount manager approval.', endpoint: 'GET /api/v1/quotations?status=pending_approval', scope: 'quotations.read', method: 'GET', modId: 'quotations' },
            { title: 'Approved Quotations', desc: 'Finalized and customer-approved quotation vouchers ready for sales order conversion.', endpoint: 'GET /api/v1/quotations?status=final', scope: 'quotations.read', method: 'GET', modId: 'quotations' },
            { title: 'Rejected Quotations', desc: 'Log of rejected commercial quotes with rejection rationale and revision notes.', endpoint: 'GET /api/v1/quotations?status=rejected', scope: 'quotations.read', method: 'GET', modId: 'quotations' },
            { title: 'Quote Conversion Analytics', desc: 'Win/loss ratio reports, deal conversion timelines, and quote cycle durations.', endpoint: 'GET /api/v1/quotations/conversion-report', scope: 'quotations.read', method: 'GET', modId: 'quotations' },
            { title: 'Guided Selling Wizard', desc: 'Interactive questionnaire endpoint to recommend optimal product catalog bundles.', endpoint: 'GET /api/v1/cpq/guided-selling', scope: 'cpq.read', method: 'GET', modId: 'quotations' },
            { title: 'Product Configurator', desc: 'Dynamic rules engine for custom product option assembly and pricing calculations.', endpoint: 'POST /api/v1/cpq/configurator', scope: 'cpq.write', method: 'POST', modId: 'quotations' },
            { title: 'Quote Price Simulator', desc: 'Real-time sandbox tool for estimating margins, freight cost, and net deal revenue.', endpoint: 'POST /api/v1/cpq/simulator', scope: 'cpq.read', method: 'POST', modId: 'quotations' },
            { title: 'Approval Workflows', desc: 'Hierarchical approval logs, discount override requests, and escalation histories.', endpoint: 'GET /api/v1/sales/approvals', scope: 'quotations.read', method: 'GET', modId: 'quotations' },
            { title: 'Invoices & Billing', desc: 'Tax invoices, proforma billing documents, payment collection status, and credit notes.', endpoint: 'GET /api/v1/invoices', scope: 'orders.read', method: 'GET', modId: 'orders' },
            { title: 'Sales Orders', desc: 'Confirmed customer sales orders, voucher numbers, delivery schedules, and fulfillment.', endpoint: 'GET /api/v1/orders', scope: 'orders.read', method: 'GET', modId: 'orders' }
        ]
    },
    {
        categoryId: 'clm',
        categoryName: 'Contracts (CLM)',
        moduleTitle: 'Contract Lifecycle Management',
        icon: '📑',
        subModules: [
            { title: 'CLM Overview Dashboard', desc: 'Active customer agreements, expiring contracts, renewal pipeline, and contract value.', endpoint: 'GET /api/v1/clm/dashboard', scope: 'clm.read', method: 'GET', modId: 'clm' },
            { title: 'Contracts Repository', desc: 'Master contract directory, executed agreements, milestone dates, and attachments.', endpoint: 'GET /api/v1/clm/contracts', scope: 'clm.read', method: 'GET', modId: 'clm' },
            { title: 'Draft New Contract', desc: 'Create contract record from template and clause parameters.', endpoint: 'POST /api/v1/clm/contracts', scope: 'clm.write', method: 'POST', modId: 'clm' },
            { title: 'Contract Templates', desc: 'Standardized legal agreement templates, MSA, SLA, NDA, and service agreement formats.', endpoint: 'GET /api/v1/clm/templates', scope: 'clm.read', method: 'GET', modId: 'clm' },
            { title: 'Clauses Library', desc: 'Pre-approved legal clauses, liability caps, indemnity statements, and governing law terms.', endpoint: 'GET /api/v1/clm/clauses', scope: 'clm.read', method: 'GET', modId: 'clm' },
            { title: 'CLM Approvals Queue', desc: 'Legal department review queue, non-standard clause exceptions, and signatures.', endpoint: 'GET /api/v1/clm/approvals', scope: 'clm.read', method: 'GET', modId: 'clm' },
            { title: 'Renewals Kanban', desc: 'Automated contract expiration alerts, 90-day renewal windows, and expansion tracking.', endpoint: 'GET /api/v1/clm/renewals', scope: 'clm.read', method: 'GET', modId: 'clm' },
            { title: 'CLM Reports', desc: 'Contract risk analysis, SLA compliance metrics, and contract cycle turnaround times.', endpoint: 'GET /api/v1/clm/reports', scope: 'clm.read', method: 'GET', modId: 'clm' },
            { title: 'CLM Settings', desc: 'Notification triggers, auto-renewal policies, and digital signature integration settings.', endpoint: 'GET /api/v1/clm/settings', scope: 'clm.write', method: 'GET', modId: 'clm' }
        ]
    },
    {
        categoryId: 'purchase',
        categoryName: 'Material (GRN)',
        moduleTitle: 'Material & Goods Receipt',
        icon: '📦',
        subModules: [
            { title: 'Goods Receipt Notes (GRN)', desc: 'Track incoming material receipts, vendor delivery notes, serials, and quality checks.', endpoint: 'GET /api/v1/grn', scope: 'inventory.read', method: 'GET', modId: 'purchase' },
            { title: 'Create GRN Entry', desc: 'Log new stock inward entry, serial verification, and warehouse shelf assignment.', endpoint: 'POST /api/v1/grn', scope: 'inventory.write', method: 'POST', modId: 'purchase' }
        ]
    },
    {
        categoryId: 'planning',
        categoryName: 'Planning Board',
        moduleTitle: 'Production & Planning Board',
        icon: '🗓️',
        subModules: [
            { title: 'Planning Board Matrix', desc: 'Resource capacity planning, production schedules, machine utilization, and lead times.', endpoint: 'GET /api/v1/planning', scope: 'planning.read', method: 'GET', modId: 'planning' },
            { title: 'What-If Simulations', desc: 'Capacity bottleneck simulation models, load balancing, and schedule forecasting.', endpoint: 'GET /api/v1/simulations', scope: 'planning.read', method: 'GET', modId: 'planning' }
        ]
    },
    {
        categoryId: 'csm',
        categoryName: 'Customer Service',
        moduleTitle: 'Customer Service Management (CSM)',
        icon: '🛠️',
        subModules: [
            { title: 'CSM Dashboard', desc: 'Open ticket counts, first response time KPIs, customer CSAT scores, and field visits.', endpoint: 'GET /api/v1/csm/dashboard', scope: 'csm.read', method: 'GET', modId: 'csm' },
            { title: 'Service Tickets Register', desc: 'Customer complaint tickets, severity levels, root cause categories, and resolution logs.', endpoint: 'GET /api/v1/csm/tickets', scope: 'csm.read', method: 'GET', modId: 'csm' },
            { title: 'Ticket Detail Workspace', desc: 'Individual ticket workspace with communication history, diagnostic notes, and status.', endpoint: 'GET /api/v1/csm/tickets/{id}', scope: 'csm.read', method: 'GET', modId: 'csm' },
            { title: 'Create Service Ticket', desc: 'Log a new customer breakdown, maintenance inquiry, or technical ticket.', endpoint: 'POST /api/v1/csm/tickets', scope: 'csm.write', method: 'POST', modId: 'csm' },
            { title: 'Field Service Visits', desc: 'Dispatch service engineers, track GPS check-in/out times, and log spare parts used.', endpoint: 'GET /api/v1/csm/visits', scope: 'csm.read', method: 'GET', modId: 'csm' },
            { title: 'Warranty & AMC Contracts', desc: 'Equipment warranty validation, annual maintenance contract dates, and coverage scope.', endpoint: 'GET /api/v1/csm/warranties-amc', scope: 'csm.read', method: 'GET', modId: 'csm' },
            { title: 'Service Knowledge Base', desc: 'Troubleshooting guides, error code manuals, technical diagrams, and FAQs.', endpoint: 'GET /api/v1/csm/kb', scope: 'csm.read', method: 'GET', modId: 'csm' },
            { title: 'CSM Config Masters', desc: 'SLA priority matrix, escalation tiers, service category codes, and resolution time limits.', endpoint: 'GET /api/v1/csm/masters', scope: 'csm.write', method: 'GET', modId: 'csm' },
            { title: 'Service Reports', desc: 'Engineer performance, mean time to repair (MTTR), and customer satisfaction trends.', endpoint: 'GET /api/v1/csm/reports', scope: 'csm.read', method: 'GET', modId: 'csm' }
        ]
    },
    {
        categoryId: 'tender',
        categoryName: 'Tenders & Bidding',
        moduleTitle: 'Tender & Bid Management',
        icon: '⚖️',
        subModules: [
            { title: 'Tender Overview Dashboard', desc: 'Summary of active government/private tenders, EMD deposits, and bid deadlines.', endpoint: 'GET /api/v1/tender/dashboard', scope: 'tenders.read', method: 'GET', modId: 'tenders' },
            { title: 'Tenders Register', desc: 'Master directory of tender notices, bid submission dates, eligibility, and document links.', endpoint: 'GET /api/v1/tender/register', scope: 'tenders.read', method: 'GET', modId: 'tenders' },
            { title: 'Create Tender Entry', desc: 'Register a new tender opportunity, assign bid manager, and attach RFP specifications.', endpoint: 'POST /api/v1/tender/register', scope: 'tenders.write', method: 'POST', modId: 'tenders' },
            { title: 'Tender Reports', desc: 'Bid win/loss analytics, EMD refund status, and tender valuation breakdown.', endpoint: 'GET /api/v1/tender/reports', scope: 'tenders.read', method: 'GET', modId: 'tenders' }
        ]
    },
    {
        categoryId: 'reports',
        categoryName: 'Reports & Analytics',
        moduleTitle: 'Reports & Business Intelligence',
        icon: '📈',
        subModules: [
            { title: 'Executive Reports Center', desc: 'Centralized directory of exportable business performance reports in Excel/PDF.', endpoint: 'GET /api/v1/reports', scope: 'analytics.read', method: 'GET', modId: 'reports' },
            { title: 'Payroll Reports', desc: 'PF returns, ESI statements, Form 16 summaries, and gross salary payout audit reports.', endpoint: 'GET /api/v1/payroll/reports', scope: 'payroll.read', method: 'GET', modId: 'payroll' },
            { title: 'Sales Analytics Charts', desc: 'Interactive charts for monthly sales trends, deal win velocity, and average order value.', endpoint: 'GET /api/v1/sales/analytics', scope: 'analytics.read', method: 'GET', modId: 'reports' },
            { title: 'Revenue Growth Analytics', desc: 'Year-over-year revenue comparisons, MRR/ARR growth metrics, and product contribution.', endpoint: 'GET /api/v1/sales/revenue-analytics', scope: 'analytics.read', method: 'GET', modId: 'reports' },
            { title: 'Customer Analytics', desc: 'Customer lifetime value (CLV), churn risk indicators, and RFM segmentation metrics.', endpoint: 'GET /api/v1/customers/analytics', scope: 'analytics.read', method: 'GET', modId: 'customers' },
            { title: 'Competitor Intelligence', desc: 'Competitor price benchmarks, feature matrix comparisons, and battle cards.', endpoint: 'GET /api/v1/sales/competitors', scope: 'sales.read', method: 'GET', modId: 'reports' },
            { title: 'AI Pricing Insights', desc: 'Machine-learning recommendations for win-optimal discount margins and deal pricing.', endpoint: 'GET /api/v1/sales/ai-pricing', scope: 'cpq.read', method: 'GET', modId: 'products' }
        ]
    },
    {
        categoryId: 'admin',
        categoryName: 'Admin & Security',
        moduleTitle: 'Administration & Access Control',
        icon: '🔒',
        subModules: [
            { title: 'Access Control & Permissions', desc: 'User role matrix, module RBAC authorization definitions, and scope boundaries.', endpoint: 'GET /api/v1/admin/authorization', scope: 'admin.read', method: 'GET', modId: 'admin' },
            { title: 'Salespersons Directory', desc: 'Sales representatives master list, commission rates, and branch manager assignments.', endpoint: 'GET /api/v1/salespersons', scope: 'admin.read', method: 'GET', modId: 'admin' },
            { title: 'Landing Plan Manager', desc: 'Whitelabel marketing landing plans, pricing packages, and feature configurations.', endpoint: 'GET /api/v1/admin/landing-plans', scope: 'admin.read', method: 'GET', modId: 'admin' }
        ]
    },
    {
        categoryId: 'platform',
        categoryName: 'Platform & System',
        moduleTitle: 'Platform & Developer Hub',
        icon: '⚙️',
        subModules: [
            { title: 'Super Admin Console Metrics', desc: 'Multi-tenant organization statistics, database health, and active user connections.', endpoint: 'GET /api/v1/super-admin', scope: 'system.read', method: 'GET', modId: 'platform' },
            { title: 'System Software Updates', desc: 'Software release notes, system upgrade history, patch notes, and feature flags.', endpoint: 'GET /api/v1/system-updates', scope: 'system.read', method: 'GET', modId: 'platform' },
            { title: 'Developer Audit Logs', desc: 'API access key request logs, rate limit hits, error tracebacks, and payload metrics.', endpoint: 'GET /api/v1/developer/logs', scope: 'system.read', method: 'GET', modId: 'platform' },
            { title: 'Footer Information Pages', desc: 'Public CMS pages, terms of service, privacy policy, and help center articles.', endpoint: 'GET /api/v1/info/{slug}', scope: 'system.read', method: 'GET', modId: 'platform' }
        ]
    }
];

const CATEGORIES = [
    { id: 'all', label: 'All Modules' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'master', label: 'Master Data' },
    { id: 'payroll', label: 'Payroll & HR' },
    { id: 'enquiry', label: 'Enquiries & Leads' },
    { id: 'sales_pipeline', label: 'Sales Pipeline' },
    { id: 'meetings', label: 'Appointments' },
    { id: 'sales_catalog', label: 'Product Submodules' },
    { id: 'cpq_catalog', label: 'CPQ & Pricing' },
    { id: 'quotations', label: 'Quotations & Orders' },
    { id: 'clm', label: 'Contracts (CLM)' },
    { id: 'purchase', label: 'Material (GRN)' },
    { id: 'planning', label: 'Planning Board' },
    { id: 'csm', label: 'Customer Service' },
    { id: 'tender', label: 'Tenders & Bidding' },
    { id: 'reports', label: 'Reports & Analytics' },
    { id: 'admin', label: 'Admin & Security' },
    { id: 'platform', label: 'Platform & System' }
];

const Overview = () => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Total counts calculations
    const totalModulesCount = ALL_SYSTEM_MODULES.length;
    const totalEndpointsCount = useMemo(() => {
        return ALL_SYSTEM_MODULES.reduce((acc, cat) => acc + cat.subModules.length, 0);
    }, []);

    // Filter modules based on category tab & search query
    const filteredModules = useMemo(() => {
        let result = ALL_SYSTEM_MODULES;

        if (selectedCategory !== 'all') {
            result = result.filter(mod => mod.categoryId === selectedCategory);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.map(mod => {
                const filteredSubs = mod.subModules.filter(sub =>
                    sub.title.toLowerCase().includes(query) ||
                    sub.desc.toLowerCase().includes(query) ||
                    sub.endpoint.toLowerCase().includes(query) ||
                    sub.scope.toLowerCase().includes(query)
                );
                return { ...mod, subModules: filteredSubs };
            }).filter(mod => mod.subModules.length > 0);
        }

        return result;
    }, [selectedCategory, searchQuery]);

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-[#006c49] via-[#059669] to-[#10b981] p-8 rounded-3xl text-white space-y-4 shadow-xl shadow-[#006c49]/15 relative overflow-hidden">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white font-extrabold text-[10px] tracking-widest uppercase border border-white/30">
                    <MdRocketLaunch size={14} />
                    <span>Enterprise Public REST API Platform</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                    ARCRM Enterprise Modules & API Reference Directory
                </h1>
                <p className="text-emerald-100 text-sm max-w-3xl font-semibold leading-relaxed">
                    Build bi-directional enterprise integrations, automate CRM workflows, and sync customer, payroll, sales, contracts, and service data across all {totalModulesCount} system modules and {totalEndpointsCount}+ sub-module API endpoints.
                </p>
                <div className="pt-2 flex flex-wrap gap-4">
                    <Link
                        to="/developer/api-reference"
                        className="px-6 py-3 rounded-2xl bg-white hover:bg-slate-50 text-[#006c49] font-black text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 active:scale-95"
                    >
                        <MdBook size={16} />
                        <span>Interactive API Explorer</span>
                        <MdArrowForward size={16} />
                    </Link>
                    <Link
                        to="/developer/api-keys"
                        className="px-6 py-3 rounded-2xl bg-emerald-900/40 hover:bg-emerald-900/60 border border-white/30 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                        <MdVpnKey size={16} />
                        <span>Generate Access Key</span>
                    </Link>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        <MdLayers className="text-[#006c49]" size={16} />
                        <span>System Modules</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{totalModulesCount} Modules</div>
                    <div className="text-xs font-semibold text-slate-500">Fully Documented</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        <MdCode className="text-[#006c49]" size={16} />
                        <span>Sub-Module APIs</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{totalEndpointsCount}+ Endpoints</div>
                    <div className="text-xs font-semibold text-slate-500">JSON REST Format</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        <MdCheckCircle className="text-[#006c49]" size={16} />
                        <span>JSON Envelope</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900">Standardized</div>
                    <div className="text-xs font-semibold text-slate-500">Succeeded/Data/Page</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        <MdSpeed className="text-[#006c49]" size={16} />
                        <span>Avg API Latency</span>
                    </div>
                    <div className="text-2xl font-black text-[#006c49]">&lt; 45 ms</div>
                    <div className="text-xs font-semibold text-slate-500">99.9% Uptime SLA</div>
                </div>
            </div>

            {/* Base Endpoint URL Box */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Environment Base Endpoint URLs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 font-mono text-xs">
                        <div className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Production Environment</div>
                        <div className="font-bold text-[#006c49] text-sm">https://arcrm.co.in/api/v1</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 font-mono text-xs">
                        <div className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Sandbox Environment</div>
                        <div className="font-bold text-amber-700 text-sm">https://sandbox.arcrm.co.in/api/v1</div>
                    </div>
                </div>
            </div>

            {/* Standard API Envelope Response Box */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Standard API Response Envelope</h3>
                    <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">Standard JSON</span>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    All API endpoints return responses encapsulated strictly inside the standard JSON envelope with <code className="text-[#006c49] font-mono">succeeded</code> status boolean, <code className="text-[#006c49] font-mono">message</code> summary, <code className="text-[#006c49] font-mono">data</code> payload array/object, and <code className="text-[#006c49] font-mono">pagination</code> metadata.
                </p>
                <CodeBlock code={`{
  "succeeded": true,
  "message": "Operation completed successfully",
  "data": [
    {
      "id": "65cb7f92a10e82c1",
      "customerName": "Acme Global Solutions",
      "companyName": "Acme Corp",
      "email": "contact@acme.com",
      "mobile": "+91 9876543210",
      "status": "Active"
    }
  ],
  "pagination": {
    "pageIndex": 1,
    "pageSize": 25,
    "totalCount": 1,
    "totalPages": 1
  }
}`} language="json" title="Standard Response Envelope Schema" />
            </div>

            {/* Interactive Module Filter & Search Bar */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">System Modules & Sub-Modules Directory</h2>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">Explore REST API endpoints across all {totalModulesCount} system modules.</p>
                    </div>

                    {/* Search Input */}
                    <div className="relative min-w-[280px]">
                        <MdSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search sub-modules, endpoints, scopes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-semibold outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#006c49]/10 transition-all"
                        />
                    </div>
                </div>

                {/* Category Pills Slider */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0 flex items-center gap-1 pr-2 border-r border-slate-200">
                        <MdFilterList size={14} /> Filter
                    </span>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                selectedCategory === cat.id
                                    ? 'bg-[#006c49] text-white shadow-md shadow-[#006c49]/20'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* System Modules List */}
                {filteredModules.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
                        <div className="text-3xl">🔍</div>
                        <h3 className="text-base font-black text-slate-900">No matching sub-module APIs found</h3>
                        <p className="text-xs text-slate-500 font-semibold max-w-sm mx-auto">
                            Try adjusting your search query or category filter to locate the desired API module.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {filteredModules.map(modCategory => (
                            <div key={modCategory.categoryId} className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{modCategory.icon}</span>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 tracking-tight">{modCategory.moduleTitle}</h3>
                                            <span className="text-[11px] font-bold text-[#006c49] uppercase tracking-wider">{modCategory.categoryName}</span>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-mono text-xs font-bold border border-slate-200">
                                        {modCategory.subModules.length} Sub-Modules
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {modCategory.subModules.map((sub, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#006c49]/40 transition-all flex flex-col justify-between space-y-3 group"
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                                                        sub.method === 'GET' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                                        sub.method === 'POST' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                        sub.method === 'PATCH' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                                        'bg-rose-100 text-rose-800 border border-rose-200'
                                                    }`}>
                                                        {sub.method}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold border border-slate-200">
                                                        Scope: {sub.scope}
                                                    </span>
                                                </div>

                                                <h4 className="text-sm font-black text-slate-900 group-hover:text-[#006c49] transition-colors">
                                                    {sub.title}
                                                </h4>

                                                <p className="text-xs text-slate-600 font-medium leading-relaxed min-h-[36px]">
                                                    {sub.desc}
                                                </p>
                                            </div>

                                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between font-mono text-[11px]">
                                                <span className="text-[#006c49] font-bold truncate max-w-[190px]" title={sub.endpoint}>
                                                    {sub.endpoint}
                                                </span>
                                                <Link
                                                    to="/developer/api-reference"
                                                    className="text-[10px] font-sans font-bold uppercase text-slate-400 hover:text-[#006c49] shrink-0 flex items-center gap-1 transition-colors"
                                                >
                                                    <span>Test Explorer</span>
                                                    <span>➔</span>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Overview;
