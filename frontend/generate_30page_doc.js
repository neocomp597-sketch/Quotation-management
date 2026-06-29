import React from 'react';
import ReactPDF, { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    fontSize: 9,
    color: '#334155'
  },
  // Title Page Styles
  titlePageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderWidth: 2,
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 10
  },
  mainSub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40
  },
  metaBox: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 15,
    width: '80%',
    alignItems: 'center'
  },
  metaText: {
    fontSize: 8,
    color: '#475569',
    marginBottom: 4
  },
  
  // Standard Page Styles
  headerContainer: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f172a',
    paddingBottom: 6,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  pageTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  pageSub: {
    fontSize: 8,
    color: '#64748b'
  },
  pageMeta: {
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'right'
  },
  
  // Content Layout
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1e3a8a',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    paddingLeft: 6,
    marginVertical: 10,
    textTransform: 'uppercase'
  },
  paragraph: {
    fontSize: 8,
    color: '#475569',
    lineHeight: 1.4,
    marginBottom: 8,
    textAlign: 'justify'
  },
  codeBlock: {
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 4,
    marginVertical: 6,
    fontFamily: 'Courier',
    fontSize: 7,
    color: '#0f172a',
    borderWidth: 0.5,
    borderColor: '#e2e8f0'
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8
  },
  bulletChar: {
    width: 10,
    fontWeight: 'bold',
    color: '#3b82f6',
    fontSize: 8
  },
  bulletText: {
    flex: 1,
    fontSize: 7.5,
    color: '#475569',
    lineHeight: 1.3
  },
  
  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8'
  }
});

const el = React.createElement;

// Detailed user manual page objects (30 Pages)
const docPages = [
  // Page 1: Title
  {
    type: 'title',
    title: 'ARCRM User Manual',
    subtitle: 'End-to-End Operational Guide & System Walkthroughs',
    content: [
      'Document Version: v5.2-UserManual',
      'Author: Om Wagh',
      'System: ARCRM Multi-Tenant Enterprise Solution',
      'Target Audience: General Users, Sales Representatives, CSM Engineers, and Administrators',
      'Published: June 2026'
    ]
  },
  // Page 2: Table of Contents
  {
    type: 'toc',
    title: 'Table of Contents',
    subtitle: 'Operational Guide Structure & Chapters',
    content: [
      'Page 1: Title Page & Document Meta',
      'Page 2: Table of Contents',
      'Page 3: Chapter 1: Introduction to ARCRM System',
      'Page 4: Chapter 2: Interface Navigation & Layouts',
      'Page 5: Chapter 3: User Accounts & Security Settings',
      'Page 6: Chapter 4: Territory Management System',
      'Page 7: Chapter 5: Creating & Onboarding Customers',
      'Page 8: Chapter 6: Managing CRM Contact Persons',
      'Page 9: Chapter 7: Logging Leads & Business Enquiries',
      'Page 10: Chapter 8: Scheduling Client Meetings & History',
      'Page 11: Chapter 9: Using the Deal Board & Stages',
      'Page 12: Chapter 10: Unified Activity Timeline logs',
      'Page 13: Chapter 11: Sales Quotas & Target Allocations',
      'Page 14: Chapter 12: Sales Forecasts & Target Metrics',
      'Page 15: Chapter 13: Managing Product Catalog Inventory',
      'Page 16: Chapter 14: Price Books Configuration Guides',
      'Page 17: Chapter 15: Implementing Pricing Rules & Promos',
      'Page 18: Chapter 16: Product Option Templates Configuration',
      'Page 19: Chapter 17: Utilizing Guided Selling Simulators',
      'Page 20: Chapter 18: Creating & Editing Quotations',
      'Page 21: Chapter 19: Understanding Margin Protection Rules',
      'Page 22: Chapter 20: Drafting, Autosaves, & Versions',
      'Page 23: Chapter 21: Sales Orders Conversion & Vouchers',
      'Page 24: Chapter 22: CSM Support Desk & Ticket Logs',
      'Page 25: Chapter 23: Warranties & AMC Coverage Lookups',
      'Page 26: Chapter 24: Field Service Visits Check-In System',
      'Page 27: Chapter 25: Authoring FAQs & Self-Service articles',
      'Page 28: Chapter 26: Employee Structure Profiles in Payroll',
      'Page 29: Chapter 27: Processing Monthly Payroll runs',
      'Page 30: Chapter 28: strategic Revenue Workspace & Backups'
    ]
  },
  // Page 3: Chapter 1: Introduction
  {
    type: 'standard',
    title: '3. Chapter 1: Introduction to ARCRM',
    subtitle: 'System Concept and Global Tenant Isolation',
    content: [
      { type: 'section', text: 'Welcome to ARCRM' },
      { type: 'text', text: 'ARCRM is an integrated corporate management platform tailored for enterprise resource planning, customer relationship management, sales configure-price-quote (CPQ) cycles, field customer service management, and salary payroll calculations. By integrating these systems, ARCRM provides cross-department data flows with full operational visibility.' },
      { type: 'section', text: 'Tenant Isolation Guarantee' },
      { type: 'text', text: 'The platform operates as a secure multi-tenant environment. When you log in, your profile is bounded to your company organization. Database calls are automatically filtered to your company context, preventing cross-tenant leakage. Managers can oversee all company records, while sales agents are locked to their respective territories.' }
    ]
  },
  // Page 4: Chapter 2: Interface Navigation
  {
    type: 'standard',
    title: '4. Chapter 2: Interface Navigation',
    subtitle: 'User Dashboard Layout and Page Controls',
    content: [
      { type: 'section', text: 'Main Dashboard Interface' },
      { type: 'text', text: 'Upon authenticating, users view the Dashboard. The screen features a left navigation sidebar, a top application header, and the main workspaces. The sidebar groups related options together, such as CRM, Sales, CPQ, CSM, and Payroll.' },
      { type: 'section', text: 'Menu Navigation' },
      { type: 'text', text: 'Hovering over sidebar items displays submenu flyouts. Key metrics (leads captured, open tickets, monthly sales volume) are featured in dashboard panels. Active layouts resize automatically to fit desktop, tablet, and mobile screens.' }
    ]
  },
  // Page 5: Chapter 3: User Accounts
  {
    type: 'standard',
    title: '5. Chapter 3: User Accounts',
    subtitle: 'Managing Account Statuses, Roles, and Sessions',
    content: [
      { type: 'section', text: 'Profile Configurations' },
      { type: 'text', text: 'To update user details, navigate to Settings > Profile. Users can modify display names, update contact numbers, and view assigned security roles. User passwords can be updated under the security settings panel.' },
      { type: 'section', text: 'Assigned User Roles' },
      { type: 'text', text: 'User roles control system permissions: Admin users manage system configurations; Managers oversee company sales and service queues; Sales reps create deals and quotes; Field engineers handle service visits. Account deactivations take effect immediately, revoking access tokens.' }
    ]
  },
  // Page 6: Chapter 4: Territory Management
  {
    type: 'standard',
    title: '6. Chapter 4: Territory Management',
    subtitle: 'Configuring Geolocation Nodes and Assignments',
    content: [
      { type: 'section', text: 'Territory Setup' },
      { type: 'text', text: 'Territory nodes define sales boundaries. To configure territories, navigate to Masters > Territories. Admins can create regions by specifying country codes, state tags, cities, and pincode lists.' },
      { type: 'section', text: 'Staff Assignment' },
      { type: 'text', text: 'Managers assign sales reps and engineers to territories. When a client is onboarded, the system matches the addresses to these territories. If matches are found, it routes records to the assigned representative.' }
    ]
  },
  // Page 7: Chapter 5: Onboarding Customers
  {
    type: 'standard',
    title: '7. Chapter 5: Onboarding Customers',
    subtitle: 'Adding Customer Profiles and Handling Duplicates',
    content: [
      { type: 'section', text: 'Customer Profile Onboarding' },
      { type: 'text', text: 'To onboard a corporate customer, select Masters > Customers and click Add Customer. Enter the legal company name, billing addresses, shipping addresses, mobile contacts, and tax GSTIN numbers.' },
      { type: 'section', text: 'Automatic Duplicate Check' },
      { type: 'text', text: 'During entry, the platform verifies fields against existing records. If matches on GSTIN, email, or mobile are found, a warning displays, showing the existing profile link. This prevents duplicate profiles and keeps the directory clean.' }
    ]
  },
  // Page 8: Chapter 6: Managing CRM Contact Persons
  {
    type: 'standard',
    title: '8. Chapter 6: Managing CRM Contact Persons',
    subtitle: 'Integrated Dropdowns and Designation Masters',
    content: [
      { type: 'section', text: 'Adding Contact Persons' },
      { type: 'text', text: 'To record client personnel, go to CRM > Contacts. Replaced text inputs with interactive selections: the Company Name is chosen from registered clients, and the Designation dropdown lists standard titles.' },
      { type: 'section', text: 'Inline Quick Add Modals' },
      { type: 'text', text: 'If a designation is missing, click + Quick Add next to the selection. A modal opens where you can create, modify, or delete designations. Saving an entry selects it instantly, avoiding the need to exit the form.' }
    ]
  },
  // Page 9: Chapter 7: Logging Leads & Enquiries
  {
    type: 'standard',
    title: '9. Chapter 7: Logging Leads & Enquiries',
    subtitle: 'Managing Marketing Enquiries and Routing',
    content: [
      { type: 'section', text: 'Enquiry Registrations' },
      { type: 'text', text: 'Sales reps log inbound enquiries at CRM > Leads. Details include enquiry sources (e.g. Web portal, cold call, email), contact names, interest details, and products.' },
      { type: 'section', text: 'Lead Qualifications' },
      { type: 'text', text: 'Reps review interest levels and assign priorities. If qualified, click Convert to Deal. This action generates a deal record on the active Sales Pipeline Board and copies the customer profile details automatically.' }
    ]
  },
  // Page 10: Chapter 8: Scheduling Client Meetings
  {
    type: 'standard',
    title: '10. Chapter 8: Scheduling Client Meetings',
    subtitle: 'Appointment Trackers and Activity Notes',
    content: [
      { type: 'section', text: 'Booking Meetings' },
      { type: 'text', text: 'To log interactions, select CRM > Meetings. Enter meeting titles, schedule dates, select attendees, and assign responsibilities. Scheduled meetings sync to representative calendars.' },
      { type: 'section', text: 'Meeting Minutes' },
      { type: 'text', text: 'After meetings, reps edit the status to completed and log outcome summaries. These follow-up actions and notes feed into the customer\'s historical timeline.' }
    ]
  },
  // Page 11: Chapter 9: Using the Deal Board
  {
    type: 'standard',
    title: '11. Chapter 9: Using the Deal Board',
    subtitle: 'Sales Stage Columns and Drag-and-Drop Operations',
    content: [
      { type: 'section', text: 'Visual Deal Board' },
      { type: 'text', text: 'The Deal Board displays business opportunities categorized by stages. Columns track progress (e.g., Discovery, Proposal, Negotiation, Won, Lost) to show the overall pipeline.' },
      { type: 'section', text: 'Card Drag Operations' },
      { type: 'text', text: 'Drag opportunity cards across columns to update deal stages. Visual colors indicate deal health, alert flags indicate stuck deals, and potential values adjust dynamically.' }
    ]
  },
  // Page 12: Chapter 10: Unified Activity Timeline
  {
    type: 'standard',
    title: '12. Chapter 10: Unified Activity Timeline',
    subtitle: 'Logging Interactions and Document Histories',
    content: [
      { type: 'section', text: 'Chronological Streams' },
      { type: 'text', text: 'Selecting a deal displays the Unified Activity Timeline, logging interactions (emails, phone call summaries, meetings, status changes, and quotes) chronologically.' },
      { type: 'section', text: 'Activity Entry logs' },
      { type: 'text', text: 'Reps can add custom activities (e.g., telephone note) and attach PDF specs. Timeline summaries ensure all team members stay aligned on client developments.' }
    ]
  },
  // Page 13: Chapter 11: Sales Quotas
  {
    type: 'standard',
    title: '13. Chapter 11: Sales Quotas',
    subtitle: 'Managers Setting Quota Targets and Rules',
    content: [
      { type: 'section', text: 'Target Allocations' },
      { type: 'text', text: 'To allocate quotas, managers navigate to Sales > Target Management. Targets can be defined by financial year and assigned to individual reps or regional territories.' },
      { type: 'section', text: 'Quota Categories' },
      { type: 'text', text: 'Targets support multiple performance metrics: total deal values, quotation counts, and product-specific volumes. These configurations drive sales team comparison metrics.' }
    ]
  },
  // Page 14: Chapter 12: Sales Forecasts
  {
    type: 'standard',
    title: '14. Chapter 12: Sales Forecasts',
    subtitle: 'Analyzing Pipeline Velocities and Achievements',
    content: [
      { type: 'section', text: 'Weighted Projections' },
      { type: 'text', text: 'Sales Forecasting uses historical win rates and deal stage stages to project revenue. Projections are split by month to compare with actual wins.' },
      { type: 'section', text: 'Performance Rankings' },
      { type: 'text', text: 'Analytics charts compare quota metrics with closed-won sales figures, highlighting top performers and warning of pipeline gaps.' }
    ]
  },
  // Page 15: Chapter 13: Managing Product Catalog
  {
    type: 'standard',
    title: '15. Chapter 13: Managing Product Catalog',
    subtitle: 'Configuring Product Inventory and Pricing Models',
    content: [
      { type: 'section', text: 'Catalog Registrations' },
      { type: 'text', text: 'To manage products, navigate to CPQ > Catalog. Products can be added with SKU codes, names, categories, standard base costs, tax rates, and default units (UOM).' },
      { type: 'section', text: 'Product Maintenance' },
      { type: 'text', text: 'Deactivating items preserves historical records but hides them from simulators. Service bundles can be defined to group core products with support SLAs.' }
    ]
  },
  // Page 16: Chapter 14: Price Books Configuration
  {
    type: 'standard',
    title: '16. Chapter 14: Price Books Configuration',
    subtitle: 'Managing Base Matrices and Currency Conversions',
    content: [
      { type: 'section', text: 'Price Book Setup' },
      { type: 'text', text: 'To manage item prices, go to CPQ > Price Books. Price Books let you define price lists for specific target groups (e.g. Standard, Region-Specific, VIP Client).' },
      { type: 'section', text: 'Foreign Currency Conversions' },
      { type: 'text', text: 'Price lists support alternative currency setups. When creating quotes, select the currency (e.g., USD, EUR) to convert standard prices using live currency matrices.' }
    ]
  },
  // Page 17: Chapter 15: Pricing Rules & Promos
  {
    type: 'standard',
    title: '17. Chapter 15: Pricing Rules & Promos',
    subtitle: 'Configuring Automatic Discounts and Promos',
    content: [
      { type: 'section', text: 'Discount Rules setup' },
      { type: 'text', text: 'Pricing rules automate discounts. Managers set rules at CPQ > Pricing Rules, defining volume discount thresholds (e.g., buying 50+ units applies 5% off).' },
      { type: 'section', text: 'Scheduling Rules' },
      { type: 'text', text: 'Rules can be scheduled by date ranges to automate holiday promotions. The system evaluates and applies matching rules during quote creation.' }
    ]
  },
  // Page 18: Chapter 16: Product Option Templates
  {
    type: 'standard',
    title: '18. Chapter 16: Product Option Templates',
    subtitle: 'CPQ Option Selections and Configurator templates',
    content: [
      { type: 'section', text: 'Product Option Rules' },
      { type: 'text', text: 'Product option templates manage complex component structures. To configure, navigate to CPQ > Option Templates and select a base product SKU.' },
      { type: 'section', text: 'Enforcing Selections' },
      { type: 'text', text: 'Option groups define item bundles (e.g., choosing motor size requires matching enclosures). Selecting options adds predefined cost modifiers to the base rate.' }
    ]
  },
  // Page 19: Chapter 17: Guided Selling Simulators
  {
    type: 'standard',
    title: '19. Chapter 17: Utilizing Guided Selling Simulators',
    subtitle: 'Guided Product Filter sand Quotation Sandboxes',
    content: [
      { type: 'section', text: 'Guided Selector Flows' },
      { type: 'text', text: 'To use guided selling, select CPQ > Guided Selling. Reps complete questionnaires with client specifications (application type, budget limits) to filter the catalog.' },
      { type: 'section', text: 'Quote Simulation' },
      { type: 'text', text: 'Reps can adjust quantities and discounts in a simulation sandbox to preview margin metrics and taxes before saving quotes to client profiles.' }
    ]
  },
  // Page 20: Chapter 18: Creating & Editing Quotations
  {
    type: 'standard',
    title: '20. Chapter 18: Creating & Editing Quotations',
    subtitle: 'Draft Autosaves, Line items, and Customer Selects',
    content: [
      { type: 'section', text: 'Quote Creation Steps' },
      { type: 'text', text: 'To create quotes, go to Sales > Quotations and click Create Quote. Select the onboarded Customer to load their billing data and territory details.' },
      { type: 'section', text: 'Line Items Configuration' },
      { type: 'text', text: 'Add products to the quotation table. Reps can choose configured options, apply manual discounts, set delivery locations, and view total calculations.' }
    ]
  },
  // Page 21: Chapter 19: Margin Protection Engine
  {
    type: 'standard',
    title: '21. Chapter 19: Understanding Margin Protection Rules',
    subtitle: 'Gross Margin Thresholds and Automated Block rules',
    content: [
      { type: 'section', text: 'Margin Calculations' },
      { type: 'text', text: 'The Margin Protection Engine acts as a gatekeeper during quotation saves, calculating line margins based on standard costs and selling prices.' },
      { type: 'section', text: 'Enforcement Thresholds' },
      { type: 'text', text: 'Negative margins are blocked by HTTP 400 responses. Sub-10% margins redirect the quote status to "Pending Approval", requiring manager sign-off before printing.' }
    ]
  },
  // Page 22: Chapter 20: Revisions, Drafts & Versions
  {
    type: 'standard',
    title: '22. Chapter 20: Revisions, Drafts & Versions',
    subtitle: 'Autosave Recovery, Versions, and Lock terms',
    content: [
      { type: 'section', text: 'Autosave Recovery' },
      { type: 'text', text: 'The system autosaves work-in-progress drafts to Redis every 30 seconds. If a connection drops, reps can restore their active session upon returning.' },
      { type: 'section', text: 'Quotation Versions' },
      { type: 'text', text: 'Updating finalized quotes saves snapshots in the QuotationVersion history. Reps can compare revisions and restore previous quotation versions.' }
    ]
  },
  // Page 23: Chapter 21: Sales Orders & Billing
  {
    type: 'standard',
    title: '23. Chapter 21: Sales Orders & Billing',
    subtitle: 'Order Conversion, Invoicing, and Voucher Logs',
    content: [
      { type: 'section', text: 'Order Conversions' },
      { type: 'text', text: 'Once approved, select Convert to Sales Order. This updates the quote status to ordered and locks pricing under customer agreement contract terms.' },
      { type: 'section', text: 'Billing Invoices' },
      { type: 'text', text: 'The conversion generates a printable invoice and logs transaction details to voucher tables, providing financial audits.' }
    ]
  },
  // Page 24: Chapter 22: CSM Ticket Desk Operations
  {
    type: 'standard',
    title: '24. Chapter 22: CSM Ticket Desk Operations',
    subtitle: 'Logging Support Tickets and SLA Priority tracking',
    content: [
      { type: 'section', text: 'Support Ticket Intake' },
      { type: 'text', text: 'To log support requests, navigate to CSM > Tickets. Support tickets register product details, customer serial numbers, and client descriptions.' },
      { type: 'section', text: 'SLA Priority Clocks' },
      { type: 'text', text: 'SLA priority matrices assign response and resolution timelines. If a ticket is placed in "Pending Customer" status, the SLA timer is paused to prevent unfair breaches.' }
    ]
  },
  // Page 25: Chapter 23: Warranties & AMC Coverage
  {
    type: 'standard',
    title: '25. Chapter 23: Warranties & AMC Coverage',
    subtitle: 'Tracking Serial Numbers and Active Contracts',
    content: [
      { type: 'section', text: 'Entitlement Verification' },
      { type: 'text', text: 'When creating support tickets, the system checks the Product Serial Number. It queries active Warranty registers and AMC contracts.' },
      { type: 'section', text: 'Status Actions' },
      { type: 'text', text: 'Active coverage sets the billing status to free. Inactive or expired coverage flags the ticket as billable, prompting the rep to link invoices or quotes.' }
    ]
  },
  // Page 26: Chapter 24: Field Service Visits Check-In
  {
    type: 'standard',
    title: '26. Chapter 24: Field Service Visits Check-In',
    subtitle: 'GPS Verification and Visit Closures',
    content: [
      { type: 'section', text: 'Scheduling Field Visits' },
      { type: 'text', text: 'Managers schedule service visits from tickets, assigning field engineers. Engineers receive dispatch details on mobile screens.' },
      { type: 'section', text: 'GPS Location Verification' },
      { type: 'text', text: 'Engineers perform Check-In and Check-Out actions. The application captures the exact mobile GPS coordinates and timestamps, verifying engineer presence on-site.' }
    ]
  },
  // Page 27: Chapter 25: Authoring FAQs
  {
    type: 'standard',
    title: '27. Chapter 25: Authoring FAQs',
    subtitle: 'Publishing Self-Service Knowledge Base articles',
    content: [
      { type: 'section', text: 'Self-Service Index' },
      { type: 'text', text: 'FAQ articles are cataloged by category (e.g., hardware, software). Reps use keywords to lookup troubleshooting articles directly from support tickets.' },
      { type: 'section', text: 'Resolution Linkage' },
      { type: 'text', text: 'Closing support tickets allows referencing the resolving KB article, linking solutions to issues to improve future resolution times.' }
    ]
  },
  // Page 28: Chapter 26: Employee Structure Profiles
  {
    type: 'standard',
    title: '28. Chapter 26: Employee Structure Profiles',
    subtitle: 'Payroll Profiles, salary templates, and allowances',
    content: [
      { type: 'section', text: 'Employee Salary Profiles' },
      { type: 'text', text: 'Salary records map structural breakdowns for employees, detailing basic pay, HRA, allowances, professional taxes (PT), provident fund (PF), and deductions.' },
      { type: 'section', text: 'Audit Logging' },
      { type: 'text', text: 'Every modification to an employee\'s salary structure is logged in the PayrollAuditLog table, tracking user IDs, changes, and timestamps.' }
    ]
  },
  // Page 29: Chapter 27: Processing Monthly Payroll
  {
    type: 'standard',
    title: '29. Chapter 27: Processing Monthly Payroll',
    subtitle: 'Run Batch Cycles, Slip Disbursements, and HR Letters',
    content: [
      { type: 'section', text: 'Monthly Run Stages' },
      { type: 'text', text: 'Processes payroll in structured phases: Run Created -> Calculated -> Locked -> Approved. Approved runs disburse net pay and payslips.' },
      { type: 'section', text: 'Letter Document Generator' },
      { type: 'text', text: 'HR generates offer, appointment, promotion, and relieving letters dynamically from templates, automatically recording logs.' }
    ]
  },
  // Page 30: Chapter 28: Strategic Revenue Planning
  {
    type: 'standard',
    title: '30. Chapter 28: Strategic Revenue Planning',
    subtitle: 'Planners Budgets, Simulations, and Deployment PM2',
    content: [
      { type: 'section', text: 'Revenue Planning Workspace' },
      { type: 'text', text: 'Planners manage annual budgets. The planning screen compiles segment-wise and SBU-wise targets, allowing simulations and historical year modifications.' },
      { type: 'section', text: 'Deployment Procedures' },
      { type: 'text', text: 'Vite builds compile production client bundles. The Express backend is initiated using server scripts. PM2 or Docker is recommended for scaling production containers.' }
    ]
  }
];

// PDF Document component builder
const createDocument = () => {
  const pages = docPages.map((pageData, index) => {
    const pageNum = index + 1;
    
    // Render Title Page specifically
    if (pageData.type === 'title') {
      return el(Page, { key: pageNum, size: 'A4', style: styles.page },
        el(View, { style: styles.titlePageContainer },
          el(Text, { style: [styles.mainTitle, { marginTop: 100 }] }, pageData.title),
          el(Text, { style: styles.mainSub }, pageData.subtitle),
          el(View, { style: [styles.metaBox, { marginTop: 150 }] },
            pageData.content.map((line, idx) => el(Text, { key: idx, style: styles.metaText }, line))
          )
        ),
        el(View, { style: styles.footer },
          el(Text, null, 'ARCRM USER REFERENCE DOCUMENT'),
          el(Text, null, `Page ${pageNum} of 30`)
        )
      );
    }
    
    // Render Table of Contents specifically
    if (pageData.type === 'toc') {
      return el(Page, { key: pageNum, size: 'A4', style: styles.page },
        el(View, { style: styles.headerContainer },
          el(View, null,
            el(Text, { style: styles.pageTitle }, pageData.title),
            el(Text, { style: styles.pageSub }, pageData.subtitle)
          ),
          el(View, null,
            el(Text, { style: styles.pageMeta }, 'Section: Index'),
            el(Text, { style: styles.pageMeta }, 'DocRef: TOC-1')
          )
        ),
        el(Text, { style: styles.sectionTitle }, 'User Manual Chapters Index'),
        el(View, { style: { flexDirection: 'column', marginVertical: 10 } },
          pageData.content.map((item, idx) => {
            const parts = item.split(': ');
            const displayTitle = parts[0];
            const pageName = parts[1];
            return el(View, { key: idx, style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 } },
              el(Text, { style: { fontSize: 7.5, color: '#334155', fontWeight: 'bold' } }, displayTitle),
              el(Text, { style: { fontSize: 7.5, color: '#64748b' } }, pageName)
            );
          })
        ),
        el(View, { style: styles.footer },
          el(Text, null, 'ARCRM User Manual - Author: Om Wagh'),
          el(Text, null, `Page ${pageNum} of 30`)
        )
      );
    }
    
    // Render Standard Pages
    return el(Page, { key: pageNum, size: 'A4', style: styles.page },
      el(View, { style: styles.headerContainer },
        el(View, null,
          el(Text, { style: styles.pageTitle }, pageData.title),
          el(Text, { style: styles.pageSub }, pageData.subtitle)
        ),
        el(View, null,
          el(Text, { style: styles.pageMeta }, `Section: ${pageNum <= 12 ? 'Introduction & CRM' : pageNum <= 23 ? 'Commercials & CPQ' : 'Operations & HR'}`),
          el(Text, { style: styles.pageMeta }, `DocRef: UM-${pageNum}`)
        )
      ),
      
      el(View, { style: { flex: 1 } },
        pageData.content.map((block, idx) => {
          if (block.type === 'section') {
            return el(Text, { key: idx, style: styles.sectionTitle }, block.text);
          }
          if (block.type === 'text') {
            return el(Text, { key: idx, style: styles.paragraph }, block.text);
          }
          if (block.type === 'code') {
            return el(Text, { key: idx, style: styles.codeBlock }, block.text);
          }
          return null;
        })
      ),
      
      el(View, { style: styles.footer },
        el(Text, null, 'ARCRM User Manual - Author: Om Wagh'),
        el(Text, null, `Page ${pageNum} of 30`)
      )
    );
  });
  
  return el(Document, null, ...pages);
};

// Save file to filesystem
const outputPath = './System_30Page_Manual.pdf';
ReactPDF.render(createDocument(), outputPath)
  .then(() => console.log('Successfully generated System_30Page_Manual.pdf at ' + outputPath))
  .catch((err) => {
    console.error('Error generating PDF:', err);
    process.exit(1);
  });
