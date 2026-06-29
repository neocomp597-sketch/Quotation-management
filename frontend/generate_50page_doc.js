import React from 'react';
import ReactPDF, { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 58,
    paddingHorizontal: 38,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    fontSize: 9,
    color: '#334155'
  },
  // Title Page Styles
  titlePageContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 70,
    paddingHorizontal: 30,
    borderWidth: 2,
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 10
  },
  mainSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20
  },
  metaBox: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 20,
    width: '80%',
    alignItems: 'center'
  },
  metaText: {
    fontSize: 9,
    color: '#475569',
    marginBottom: 6
  },
  
  // Standard Page Styles
  headerContainer: {
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
    paddingBottom: 5,
    marginBottom: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  pageTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  pageSub: {
    fontSize: 8.5,
    color: '#64748b'
  },
  pageMeta: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'right'
  },
  
  // Content Layout
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e3a8a',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    paddingLeft: 6,
    marginTop: 6,
    marginBottom: 5,
    textTransform: 'uppercase'
  },
  paragraph: {
    fontSize: 8.4,
    color: '#475569',
    lineHeight: 1.35,
    marginBottom: 5,
    textAlign: 'justify'
  },
  
  // Flowchart specific styles
  cpqFlowContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 9,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    backgroundColor: '#f8fafc',
  },
  cpqBox: {
    width: 410,
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    borderWidth: 1.5,
    backgroundColor: '#ffffff'
  },
  boxColorBlue: { borderColor: '#3b82f6', backgroundColor: '#f0f9ff' },
  boxColorPurple: { borderColor: '#8b5cf6', backgroundColor: '#faf5ff' },
  boxColorAmber: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  boxColorGreen: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  
  cpqBoxTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
    textTransform: 'uppercase',
    textAlign: 'center'
  },
  cpqBoxDesc: {
    fontSize: 7.1,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 1.25
  },
  arrowDown: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 1
  },
  checkpointGrid: {
    flexDirection: 'row',
    marginTop: 6,
    borderTopWidth: 0.7,
    borderTopColor: '#cbd5e1',
    paddingTop: 6
  },
  checkpointCard: {
    flex: 1,
    minHeight: 82,
    marginRight: 7,
    padding: 7,
    borderWidth: 0.8,
    borderColor: '#dbeafe',
    borderRadius: 4,
    backgroundColor: '#f8fafc'
  },
  checkpointCardLast: {
    marginRight: 0
  },
  checkpointTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#1e3a8a',
    textTransform: 'uppercase',
    marginBottom: 5
  },
  checkpointText: {
    fontSize: 6.5,
    lineHeight: 1.2,
    color: '#475569'
  },
  visualPanel: {
    marginTop: 6,
    padding: 7,
    borderWidth: 0.8,
    borderColor: '#d1d5db',
    borderRadius: 4,
    backgroundColor: '#ffffff'
  },
  visualTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    marginBottom: 5
  },
  visualRow: {
    flexDirection: 'row',
    alignItems: 'stretch'
  },
  miniStep: {
    flex: 1,
    minHeight: 40,
    padding: 5,
    marginRight: 5,
    borderWidth: 0.8,
    borderColor: '#bfdbfe',
    borderRadius: 4,
    backgroundColor: '#eff6ff'
  },
  miniStepLast: {
    marginRight: 0
  },
  miniStepNumber: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#1d4ed8',
    marginBottom: 3
  },
  miniStepText: {
    fontSize: 6.3,
    lineHeight: 1.22,
    color: '#334155'
  },
  chartArea: {
    flex: 1,
    marginRight: 8
  },
  chartBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  chartLabel: {
    width: 54,
    fontSize: 6.7,
    color: '#475569'
  },
  chartTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 2
  },
  chartBar: {
    height: 8,
    borderRadius: 2
  },
  chartNote: {
    width: 145,
    padding: 6,
    borderWidth: 0.8,
    borderColor: '#fde68a',
    borderRadius: 4,
    backgroundColor: '#fffbeb'
  },
  chartNoteTitle: {
    fontSize: 7.4,
    fontWeight: 'bold',
    color: '#92400e',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  chartNoteText: {
    fontSize: 6.3,
    lineHeight: 1.18,
    color: '#78350f'
  },
  moduleMap: {
    flexDirection: 'row',
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  moduleNode: {
    width: 88,
    minHeight: 25,
    padding: 4,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderRadius: 4,
    backgroundColor: '#faf5ff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  moduleNodeText: {
    fontSize: 6.3,
    fontWeight: 'bold',
    color: '#4c1d95',
    textAlign: 'center'
  },
  moduleArrow: {
    width: 22,
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center'
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 38,
    right: 38,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#94a3b8'
  }
});

const el = React.createElement;

// Generates 3 long paragraphs to completely fill standard page heights without whitespace
const getDetailedTextForPage = (pageNum, title) => {
  const p1 = `Under the operational architecture of ARCRM designed by Om Wagh, the system enforces precise data models to manage ${title}. Users navigating this section must verify input fields against registered company schemas before committing any actions. The interface uses custom validation gates, syntax filters, and live Redis cache lookups to speed up database responses and maintain low system latency. If network connection issues or updates occur during active sessions, data is stored in temporary state buffers so representatives do not lose active edits. Every action in this workspace triggers audit logs tracking the user ID, timestamp, and modified parameters to maintain complete compliance.`;
  
  const p2 = `For administrators managing ${title}, system control registers allow configuring roles, data validation parameters, and custom warning thresholds. The user profile menu displays active permission lists, helping verify access tiers before granting modify permissions. Changes to system properties, regional price books, or SLA priority metrics automatically trigger email notifications to regional managers. When running bulk updates or data exports, ensure the selected parameters align with active company filters to prevent data formatting errors.`;
  
  const p3 = `For general representatives, the workspace provides clear task indicators, alert markers for stuck deals, and live metrics to monitor daily activities. To access help documents or troubleshoot errors, reps can open the FAQ search bar from any interface dashboard. The central knowledge base contains articles detailing error resolution procedures, system configurations, and setup steps. Keeping records clean and updating statuses regularly ensures report metrics remain accurate for executive analysis.`;

  const p4 = `When exceptions occur in ${title}, users should capture the visible error message, confirm whether the issue is validation-related or permission-related, and then retry only after correcting the source record. Supervisors can use audit logs, status histories, and notification queues to trace incomplete transitions. Avoid changing master data directly during open approval cycles because downstream quotations, orders, tickets, and payroll batches may already reference the existing values.`;

  const p5 = `Reports linked to ${title} depend on disciplined updates. At the end of each working cycle, verify that dashboards show the latest owner, amount, quantity, territory, and status information. If values appear stale, refresh the relevant view and confirm that cache invalidation jobs have completed. Correctly maintained records reduce reconciliation time and give managers a reliable view of pipeline health, service load, commercial exposure, and operational risk.`;
  
  return [
    { type: 'section', text: '1. Operational Workflow Procedures' },
    { type: 'text', text: p1 },
    { type: 'section', text: '2. Administrator Controls & Guidelines' },
    { type: 'text', text: p2 },
    { type: 'section', text: '3. Representative Checklist & Tasks' },
    { type: 'text', text: p3 },
    { type: 'section', text: '4. Exception Handling & Escalation' },
    { type: 'text', text: p4 },
    { type: 'section', text: '5. Reporting & Review Closure' },
    { type: 'text', text: p5 }
  ];
};

// Flowchart description paragraphs in simple user-facing language
const getFlowchartDesc = (title) => {
  return [
    { type: 'section', text: 'How to read this flow' },
    { type: 'text', text: `This diagram shows the normal order of work for ${title}. Start from the first box, complete that action, then move to the next box. If any required information is missing, stop and correct it before moving forward.` },
    { type: 'section', text: 'What to check before finishing' },
    { type: 'text', text: 'Make sure the record is saved, the status is correct, the right person owns the next action, and the customer or employee details are easy to find later. If something looks wrong, edit the original record instead of creating a duplicate.' },
    { type: 'section', text: 'Who should use this' },
    { type: 'text', text: 'Sales users, service users, payroll users, managers, and admins can use these diagrams as a quick checklist while training new team members or reviewing daily work.' }
  ];
};

const getStandardCheckpoints = (title) => [
  {
    title: 'Before saving',
    text: `Check the important fields for ${title}: name, date, customer or employee, amount, status, owner, and any notes or attachments. A quick check prevents rework later.`
  },
  {
    title: 'Daily habit',
    text: 'Keep statuses updated, add clear notes, and avoid duplicate records. If you are not sure which screen to use, check the menu name and ask your manager before changing old data.'
  },
  {
    title: 'After saving',
    text: 'Open the list page or dashboard again and confirm the record appears correctly. If reports do not update immediately, refresh the page and check that filters are set correctly.'
  }
];

const getFlowchartCheckpoints = (title) => [
  {
    title: 'Start',
    text: `Begin ${title} only when the source record is clear and complete. For example, choose the correct customer, employee, product, or ticket before moving ahead.`
  },
  {
    title: 'Check',
    text: 'At each step, check the required fields and the status. If the system shows a warning, fix it first instead of skipping the step.'
  },
  {
    title: 'Finish',
    text: 'Save the record and confirm the next user can see it. The work is complete only when the status, owner, and notes are correct.'
  }
];

const renderCheckpointGrid = (items) => (
  el(View, { style: styles.checkpointGrid },
    items.map((item, idx) => el(View, {
      key: item.title,
      style: [styles.checkpointCard, idx === items.length - 1 && styles.checkpointCardLast]
    },
      el(Text, { style: styles.checkpointTitle }, item.title),
      el(Text, { style: styles.checkpointText }, item.text)
    ))
  )
);

const getVisualData = (pageNum, title) => {
  if (pageNum <= 14) {
    return {
      title: 'Daily master data check',
      steps: ['Search existing record', 'Enter clean details', 'Save and reuse'],
      bars: [
        ['Correct name', 92, '#3b82f6'],
        ['Contact details', 78, '#10b981'],
        ['Owner/status', 64, '#f59e0b']
      ],
      note: 'Good master data makes quotations, invoices, reports, and service records easier to use.',
      map: ['Master', 'Transaction', 'Report']
    };
  }
  if (pageNum <= 26) {
    return {
      title: 'Sales follow-up view',
      steps: ['Create record', 'Plan next action', 'Update result'],
      bars: [
        ['Follow-up date', 88, '#8b5cf6'],
        ['Deal value', 72, '#3b82f6'],
        ['Clear notes', 68, '#10b981']
      ],
      note: 'Sales screens work best when each enquiry or deal has a next action and a clear owner.',
      map: ['Enquiry', 'Deal', 'Quotation']
    };
  }
  if (pageNum <= 36) {
    return {
      title: 'Commercial document check',
      steps: ['Select customer', 'Check item and price', 'Share final document'],
      bars: [
        ['Customer', 86, '#3b82f6'],
        ['Price/tax', 82, '#f59e0b'],
        ['Terms', 60, '#10b981']
      ],
      note: 'Before sending any quotation or invoice, check customer, item, quantity, price, tax, and terms.',
      map: ['Price', 'Quote', 'Invoice']
    };
  }
  if (pageNum <= 41) {
    return {
      title: 'Planning and admin control',
      steps: ['Choose period', 'Review access', 'Check summary'],
      bars: [
        ['Period filter', 80, '#3b82f6'],
        ['User access', 74, '#8b5cf6'],
        ['Report total', 70, '#10b981']
      ],
      note: 'Planning and admin screens affect many users, so review filters, access, and totals before sharing results.',
      map: ['Plan', 'Review', 'Approve']
    };
  }
  if (pageNum <= 46) {
    return {
      title: 'Payroll monthly check',
      steps: ['Update employee', 'Calculate salary', 'Approve and pay'],
      bars: [
        ['Salary details', 90, '#3b82f6'],
        ['Deductions', 76, '#ef4444'],
        ['Payment status', 72, '#10b981']
      ],
      note: 'Payroll should be approved only after salary, deductions, bank details, and payment status are checked.',
      map: ['Employee', 'Run', 'Payslip']
    };
  }
  return {
    title: 'Customer service check',
    steps: ['Record issue', 'Assign owner', 'Close with notes'],
    bars: [
      ['Priority', 84, '#ef4444'],
      ['Owner', 74, '#3b82f6'],
      ['Resolution', 68, '#10b981']
    ],
    note: 'A ticket is complete only when the customer issue, owner, status, and resolution notes are clear.',
    map: ['Ticket', 'Visit', 'Closure']
  };
};

const renderVisualExplainer = (pageData, pageNum) => {
  const data = getVisualData(pageNum, pageData.title);
  return el(View, { style: styles.visualPanel, wrap: false },
    el(Text, { style: styles.visualTitle }, data.title),
    el(View, { style: styles.visualRow },
      data.steps.map((step, idx) => el(View, {
        key: step,
        style: [styles.miniStep, idx === data.steps.length - 1 && styles.miniStepLast]
      },
        el(Text, { style: styles.miniStepNumber }, `0${idx + 1}`),
        el(Text, { style: styles.miniStepText }, step)
      ))
    ),
    el(View, { style: [styles.visualRow, { marginTop: 9 }] },
      el(View, { style: styles.chartArea },
        data.bars.map(([label, value, color]) => el(View, { key: label, style: styles.chartBarRow },
          el(Text, { style: styles.chartLabel }, label),
          el(View, { style: styles.chartTrack },
            el(View, { style: [styles.chartBar, { width: `${value}%`, backgroundColor: color }] })
          )
        ))
      ),
      el(View, { style: styles.chartNote },
        el(Text, { style: styles.chartNoteTitle }, 'Quick explanation'),
        el(Text, { style: styles.chartNoteText }, data.note)
      )
    ),
    el(View, { style: styles.moduleMap },
      data.map.map((label, idx) => el(React.Fragment, { key: label },
        idx > 0 && el(Text, { style: styles.moduleArrow }, '>'),
        el(View, { style: styles.moduleNode },
          el(Text, { style: styles.moduleNodeText }, label)
        )
      ))
    )
  );
};

// Detailed user manual page list (Exactly 50 Pages with high text density to fill pages)
const docPages = [
  // Page 1: Title
  {
    type: 'title',
    title: 'ARCRM User Manual',
    subtitle: 'Step-by-Step Functional Guide & Corporate Reference Blueprint',
    content: [
      'Document Code: ARCRM-UM-2026-V5',
      'Author: Om Wagh',
      'Architecture: Multi-Tenant Enterprise Solution',
      'Applicability: Sales Reps, Managers, Service Engineers, and Admins',
      'Published: June 2026'
    ]
  },
  // Page 2: Table of Contents Part 1
  {
    type: 'toc',
    title: 'Table of Contents (Part 1)',
    subtitle: 'User Manual Chapters & Page References (1 - 25)',
    content: [
      'Page 1: Title Page & Document Meta Data',
      'Page 2: Table of Contents (Part 1)',
      'Page 3: Table of Contents (Part 2)',
      'Page 4: Chapter 1: Introduction to ARCRM System',
      'Page 5: Chapter 1: Platform Multi-Tenant Isolation',
      'Page 6: Chapter 1: System Security Standards',
      'Page 7: Chapter 2: Master Data Management Introduction',
      'Page 8: Chapter 2: Onboarding Customers and Vendors',
      'Page 9: Flowchart: Master Data Onboarding Lifecycle',
      'Page 10: Chapter 2: Territory Nodes Assignments',
      'Page 11: Chapter 3: CRM: Leads & Enquiries Onboarding',
      'Page 12: Chapter 3: CRM: Qualification Workflows',
      'Page 13: Flowchart: Enquiry-to-Lead Qualification Flow',
      'Page 14: Chapter 3: CRM: Contacts Directory Setup',
      'Page 15: Chapter 3: CRM: Meeting Schedule Management',
      'Page 16: Chapter 4: Sales Pipeline & Deal Boards',
      'Page 17: Chapter 4: Drag-and-Drop Stage Rules',
      'Page 18: Flowchart: Sales Pipeline Transitions',
      'Page 19: Chapter 4: Sales Quotas & Targets Setting',
      'Page 20: Chapter 4: Performance Analytics & Forecasts',
      'Page 21: Chapter 5: CPQ Product Catalog Indexing',
      'Page 22: Flowchart: Catalog Options Configuration',
      'Page 23: Chapter 5: Option Templates and Modifiers',
      'Page 24: Chapter 5: SKU Pricing and Cost Bases',
      'Page 25: Chapter 6: CPQ Price Books Configuration'
    ]
  },
  // Page 3: Table of Contents Part 2
  {
    type: 'toc',
    title: 'Table of Contents (Part 2)',
    subtitle: 'User Manual Chapters & Page References (26 - 50)',
    content: [
      'Page 26: Flowchart: Price Book Lookup Hierarchy',
      'Page 27: Chapter 6: Multi-Currency Exchange Systems',
      'Page 28: Chapter 6: Regional Price Rule Overrides',
      'Page 29: Chapter 7: CPQ Pricing Rules & Promos',
      'Page 30: Flowchart: Pricing & Discount Calculation Flow',
      'Page 31: Chapter 7: Quantity Discount Tiers Setup',
      'Page 32: Chapter 7: Campaign Promotions Scheduling',
      'Page 33: Chapter 8: CPQ Guided Selling Operations',
      'Page 34: Flowchart: Guided Product Selection Process',
      'Page 35: Chapter 8: Sales Sandboxes & Simulations',
      'Page 36: Chapter 8: Interactive Client Questionnaires',
      'Page 37: Chapter 9: Sales Quotation Creation Guide',
      'Page 38: Flowchart: Quotation Version Lifecycle',
      'Page 39: Chapter 9: Draft Autosaves (Redis Recovery)',
      'Page 40: Chapter 9: Quotation Revision Tracking',
      'Page 41: Chapter 9: Locking Customer Price Agreements',
      'Page 42: Chapter 10: CPQ Margin Protection Engine (MPE)',
      'Page 43: Flowchart: Margin Approval Workflows',
      'Page 44: Chapter 10: Approval Queue Routing Rules',
      'Page 45: Chapter 10: Manager Approvals Overrides',
      'Page 46: Flowchart: Order-to-Billing Conversion Flow',
      'Page 47: Chapter 11: CSM Support Desk & Ticket Logs',
      'Page 48: Flowchart: CSM Support Ticket Lifecycle',
      'Page 49: Chapter 11: CSM Warranty & AMC Entitlement Verification',
      'Page 50: Flowchart: Payroll Monthly Run Batch Cycle'
    ]
  },
  // Page 4: Chapter 1: Introduction to ARCRM System
  {
    type: 'standard',
    title: '4. Chapter 1: Introduction to ARCRM System',
    subtitle: 'Platform Core Concept & High-Level Functionality',
    content: getDetailedTextForPage(4, 'the ARCRM System Interface')
  },
  // Page 5: Chapter 1: Platform Multi-Tenant Isolation
  {
    type: 'standard',
    title: '5. Chapter 1: Platform Multi-Tenant Isolation',
    subtitle: 'Understanding Data Security & Row-Level Logical Filters',
    content: getDetailedTextForPage(5, 'Multi-Tenant Context and Database Isolation rules')
  },
  // Page 6: Chapter 1: System Security Standards
  {
    type: 'standard',
    title: '6. Chapter 1: System Security Standards',
    subtitle: 'Encryption, Authentication, and Token Lifecycle Management',
    content: getDetailedTextForPage(6, 'System Security Protocols and Access Tokens')
  },
  // Page 7: Chapter 2: Master Data Management Introduction
  {
    type: 'standard',
    title: '7. Chapter 2: Master Data Management Introduction',
    subtitle: 'Structuring Core Corporate Assets and Registries',
    content: getDetailedTextForPage(7, 'Core Registries and Entity Mappings')
  },
  // Page 8: Chapter 2: Onboarding Customers and Vendors
  {
    type: 'standard',
    title: '8. Chapter 2: Onboarding Customers and Vendors',
    subtitle: 'Operational Onboarding Procedures and Validation Rules',
    content: getDetailedTextForPage(8, 'Corporate Clients and Vendors Onboarding')
  },
  // Page 9: Flowchart: Master Data Onboarding Lifecycle
  {
    type: 'flowchart',
    title: '9. Flowchart: Master Data Onboarding Lifecycle',
    subtitle: 'Interactive Flowchart of Master Record Registration',
    steps: [
      { title: '1. User Data Entry', desc: 'Representative inputs customer profile fields (Name, Addresses, GSTIN, Email, Phone).' },
      { title: '2. Duplicate Verification', desc: 'Backend validates fields against existing records. Overlapping GSTIN or phone triggers warnings.' },
      { title: '3. Territory Assignment Routing', desc: 'Engine parses address state/city/pincode to auto-assign territory and rep.' },
      { title: '4. Master Record Locked', desc: 'Saves record with tenant reference ID and routes to the assigned representative.' }
    ]
  },
  // Page 10: Chapter 2: Territory Nodes Assignments
  {
    type: 'standard',
    title: '10. Chapter 2: Territory Nodes Assignments',
    subtitle: 'Mapping Sales Representatives to Geolocation Boundaries',
    content: getDetailedTextForPage(10, 'Territory Assignment and Mapping rules')
  },
  // Page 11: Chapter 3: CRM: Leads & Enquiries Onboarding
  {
    type: 'standard',
    title: '11. Chapter 3: CRM: Leads & Enquiries Onboarding',
    subtitle: 'Capturing Business Interest and Marketing Records',
    content: getDetailedTextForPage(11, 'Inbound Business Enquiries capture')
  },
  // Page 12: Chapter 3: CRM: Qualification Workflows
  {
    type: 'standard',
    title: '12. Chapter 3: CRM: Qualification Workflows',
    subtitle: 'Evaluating Opportunities and Transitioning to Pipeline',
    content: getDetailedTextForPage(12, 'CRM pipeline Qualification Checklists')
  },
  // Page 13: Flowchart: Enquiry-to-Lead Qualification Flow
  {
    type: 'flowchart',
    title: '13. Flowchart: Enquiry-to-Lead Qualification Flow',
    subtitle: 'Operational Flowchart of CRM Pipeline Qualification',
    steps: [
      { title: '1. Inbound Log', desc: 'Enquiry created via web form, phone call, or email source.' },
      { title: '2. Contact Verification', desc: 'Reps contact prospect, log requirements, and check budgets.' },
      { title: '3. Qualification Check', desc: 'If qualified, rep clicks Convert to Deal to progress the opportunity.' },
      { title: '4. Board Pipeline Sync', desc: 'Opportunity is logged on the Sales Pipeline Board under stage 1.' }
    ]
  },
  // Page 14: Chapter 3: CRM: Contacts Directory Setup
  {
    type: 'standard',
    title: '14. Chapter 3: CRM: Contacts Directory Setup',
    subtitle: 'Managing Contact Directory Entries and Core Attributes',
    content: getDetailedTextForPage(14, 'Customer Contact directories configuration')
  },
  // Page 15: Chapter 3: CRM: Meeting Schedule Management
  {
    type: 'standard',
    title: '15. Chapter 3: CRM: Meeting Schedule Management',
    subtitle: 'Scheduling Client Appointments and Interaction Histories',
    content: getDetailedTextForPage(15, 'Client Meetings Calendar Booking logs')
  },
  // Page 16: Chapter 4: Sales Pipeline & Deal Boards
  {
    type: 'standard',
    title: '16. Chapter 4: Sales Pipeline & Deal Boards',
    subtitle: 'Using the Kanban Board and Sales Opportunity Funnels',
    content: getDetailedTextForPage(16, 'Kanban Opportunity board views')
  },
  // Page 17: Chapter 4: Drag-and-Drop Stage Rules
  {
    type: 'standard',
    title: '17. Chapter 4: Drag-and-Drop Stage Rules',
    subtitle: 'Enforcing Progression Gates and Valuation Updates',
    content: getDetailedTextForPage(17, 'Sales stage transitions and validation rules')
  },
  // Page 18: Flowchart: Sales Pipeline Transitions
  {
    type: 'flowchart',
    title: '18. Flowchart: Sales Pipeline Transitions',
    subtitle: 'Operational Flowchart of Kanban Deal Pipeline',
    steps: [
      { title: '1. Discovery Stage', desc: 'Deal created in column 1. Value set to estimated sales potential.' },
      { title: '2. Proposal Stage', desc: 'Rep links quotation. Value weighted by stage probability (e.g. 50%).' },
      { title: '3. Negotiation Stage', desc: 'Manager reviews margin overrides and updates deal parameters.' },
      { title: '4. Closed Won / Lost', desc: 'Sets deal state. Won converts to order; Lost records reasons.' }
    ]
  },
  // Page 19: Chapter 4: Sales Quotas & Targets Setting
  {
    type: 'standard',
    title: '19. Chapter 4: Sales Quotas & Targets Setting',
    subtitle: 'Configuring Quota Limits and Quota Timeframes',
    content: getDetailedTextForPage(19, 'Sales Representative target allocations configurations')
  },
  // Page 20: Chapter 4: Performance Analytics & Forecasts
  {
    type: 'standard',
    title: '20. Chapter 4: Performance Analytics & Forecasts',
    subtitle: 'Analyzing Pipeline Achievements vs Target Goals',
    content: getDetailedTextForPage(20, 'Sales forecasting and actuals analytics dashboards')
  },
  // Page 21: Chapter 5: CPQ Product Catalog Indexing
  {
    type: 'standard',
    title: '21. Chapter 5: CPQ Product Catalog Indexing',
    subtitle: 'Catalog Inventory Specifications and Product Configs',
    content: getDetailedTextForPage(21, 'Product Catalog specifications')
  },
  // Page 22: Flowchart: Catalog Options Configuration
  {
    type: 'flowchart',
    title: '22. Flowchart: Catalog Options Configuration',
    subtitle: 'Operational Flowchart of Product Options Mapping',
    steps: [
      { title: '1. Select Base Product SKU', desc: 'Choose a primary item code from the catalog to link option parameters.' },
      { title: '2. Define Option Groups', desc: 'Configure option categories (e.g. Dimensions, Custom Colors).' },
      { title: '3. Assign Price/Cost Modifiers', desc: 'Add pricing offsets to selections, modifying base rates dynamically.' },
      { title: '4. Map Dependency Rules', desc: 'Enforce selection rules (e.g., color A requires finish B).' }
    ]
  },
  // Page 23: Chapter 5: Option Templates and Modifiers
  {
    type: 'standard',
    title: '23. Chapter 5: Option Templates and Modifiers',
    subtitle: 'CPQ Option Configuration Rules & Pricing Modifiers',
    content: getDetailedTextForPage(23, 'Product configuration template rules')
  },
  // Page 24: Chapter 5: SKU Pricing and Cost Bases
  {
    type: 'standard',
    title: '24. Chapter 5: SKU Pricing and Cost Bases',
    subtitle: 'Cost Calculations, Margin Bases, and Valuation Rules',
    content: getDetailedTextForPage(24, 'Product cost bases and margin validations')
  },
  // Page 25: Chapter 6: CPQ Price Books Configuration
  {
    type: 'standard',
    title: '25. Chapter 6: CPQ Price Books Configuration',
    subtitle: 'Managing Base Matrices and Currency Conversions',
    content: getDetailedTextForPage(25, 'Price Book hierarchies and matrices configuration')
  },
  // Page 26: Flowchart: Price Book Lookup Hierarchy
  {
    type: 'flowchart',
    title: '26. Flowchart: Price Book Lookup Hierarchy',
    subtitle: 'System Logic Flowchart of Price Lookup Priority',
    steps: [
      { title: '1. Check Custom Client Price', desc: 'Verifies active price agreement contracts for the customer.' },
      { title: '2. Check Region-Specific Price Book', desc: 'If missing, queries regional price lists matching customer territory.' },
      { title: '3. Fallback to Standard Price Book', desc: 'If regional is missing, retrieves price from default price books.' },
      { title: '4. Dynamic Tax Conversion', desc: 'Applies conversions and adds GST rates based on state codes.' }
    ]
  },
  // Page 27: Chapter 6: Multi-Currency Exchange Systems
  {
    type: 'standard',
    title: '27. Chapter 6: Multi-Currency Exchange Systems',
    subtitle: 'Managing Exchange Matrices and Global Trade Rates',
    content: getDetailedTextForPage(27, 'Foreign Currency conversions and calculations')
  },
  // Page 28: Chapter 6: Regional Price Rule Overrides
  {
    type: 'standard',
    title: '28. Chapter 6: Regional Price Rule Overrides',
    subtitle: 'Creating Local Price Book Overrides and Rules',
    content: getDetailedTextForPage(28, 'Regional price rule overrides')
  },
  // Page 29: Chapter 7: CPQ Pricing Rules & Promos
  {
    type: 'standard',
    title: '29. Chapter 7: CPQ Pricing Rules & Promos',
    subtitle: 'Configuring Automatic Discounts and Promos',
    content: getDetailedTextForPage(29, 'Dynamic pricing discount rules configuration')
  },
  // Page 30: Flowchart: Pricing & Discount Calculation Flow
  {
    type: 'flowchart',
    title: '30. Flowchart: Pricing & Discount Calculation Flow',
    subtitle: 'Calculation Logic Flowchart of CPQ Discount Rules',
    steps: [
      { title: '1. Resolve Base Item Price', desc: 'Queries price books hierarchy to determine item base rates.' },
      { title: '2. Check Volume Quantity Tiers', desc: 'Checks line item quantities to apply percentage discount tiers.' },
      { title: '3. Apply Promo Code Rules', desc: 'Applies discount offsets if valid coupon codes are entered.' },
      { title: '4. Re-calculate Taxable GST', desc: 'Calculates taxable values and adds regional state GST percentages.' }
    ]
  },
  // Page 31: Chapter 7: Quantity Discount Tiers Setup
  {
    type: 'standard',
    title: '31. Chapter 7: Quantity Discount Tiers Setup',
    subtitle: 'Configuring Volume Discount Break-Points and Rules',
    content: getDetailedTextForPage(31, 'Quantity discount break-point configurations')
  },
  // Page 32: Chapter 7: Campaign Promotions Scheduling
  {
    type: 'standard',
    title: '32. Chapter 7: Campaign Promotions Scheduling',
    subtitle: 'Creating Date-Bounded Marketing Campaign Rules',
    content: getDetailedTextForPage(32, 'Promotions scheduling and campaign rules')
  },
  // Page 33: Chapter 8: CPQ Guided Selling Operations
  {
    type: 'standard',
    title: '33. Chapter 8: CPQ Guided Selling Operations',
    subtitle: 'Guided Product Filter sand Quotation Sandboxes',
    content: getDetailedTextForPage(33, 'Guided selling search flows')
  },
  // Page 34: Flowchart: Guided Product Selection Process
  {
    type: 'flowchart',
    title: '34. Flowchart: Guided Product Selection Process',
    subtitle: 'Operational Flowchart of Guided Selling Search Engine',
    steps: [
      { title: '1. Initiate Questionnaire', desc: 'Rep logs application parameters (application type, budget range).' },
      { title: '2. Query Catalog Filter', desc: 'Engine matches responses against catalog rules and options.' },
      { title: '3. Display Matching SKUs', desc: 'Presents recommended configurations and pricing summaries.' },
      { title: '4. Populate Quotation Builder', desc: 'Selecting options copies details to active quotation tables.' }
    ]
  },
  // Page 35: Chapter 8: Sales Sandboxes & Simulations
  {
    type: 'standard',
    title: '35. Chapter 8: Sales Sandboxes & Simulations',
    subtitle: 'Estimating Pricing Structures without Database Saves',
    content: getDetailedTextForPage(35, 'Sales sandbox simulation configuration')
  },
  // Page 36: Chapter 8: Interactive Client Questionnaires
  {
    type: 'standard',
    title: '36. Chapter 8: Interactive Client Questionnaires',
    subtitle: 'Configuring Interactive Search Selection Criteria Rules',
    content: getDetailedTextForPage(36, 'Guided questionnaires criteria fields config')
  },
  // Page 37: Chapter 9: Sales Quotation Creation Guide
  {
    type: 'standard',
    title: '37. Chapter 9: Sales Quotation Creation Guide',
    subtitle: 'Step-by-Step Instructions for Generating Quotations',
    content: getDetailedTextForPage(37, 'Creating and editing quotations')
  },
  // Page 38: Flowchart: Quotation Version Lifecycle
  {
    type: 'flowchart',
    title: '38. Flowchart: Quotation Version Lifecycle',
    subtitle: 'System Data Flowchart of Quote State Management',
    steps: [
      { title: '1. Create Draft Quote', desc: 'Reps draft details. Progress is autosaved to Redis every 30s.' },
      { title: '2. Check Margin Rules', desc: 'Engine validates line margins. Pends approval if margin < 10%.' },
      { title: '3. Approved & Locked', desc: 'Finalizing quotes locks version histories and client pricing.' },
      { title: '4. Revision Updates', desc: 'Editing final quotes saves snapshots, incrementing versions.' }
    ]
  },
  // Page 39: Chapter 9: Draft Autosaves (Redis Recovery)
  {
    type: 'standard',
    title: '39. Chapter 9: Draft Autosaves (Redis Recovery)',
    subtitle: 'Understanding Dynamic Draft Saves and Session Backups',
    content: getDetailedTextForPage(39, 'Redis session backups and recovery')
  },
  // Page 40: Chapter 9: Quotation Revision Tracking
  {
    type: 'standard',
    title: '40. Chapter 9: Quotation Revision Tracking',
    subtitle: 'Comparing Document Versions and Restoring Snapshots',
    content: getDetailedTextForPage(40, 'Quotation version revision history tracking')
  },
  // Page 41: Chapter 9: Locking Customer Price Agreements
  {
    type: 'standard',
    title: '41. Chapter 9: Locking Customer Price Agreements',
    subtitle: 'Converting Quotations into Locked Customer Contracts',
    content: getDetailedTextForPage(41, 'Customer price agreements and contracts locking')
  },
  // Page 42: Chapter 10: CPQ Margin Protection Engine (MPE)
  {
    type: 'standard',
    title: '42. Chapter 10: CPQ Margin Protection Engine (MPE)',
    subtitle: 'Understanding Gross Margin Threshold Validation Rules',
    content: getDetailedTextForPage(42, 'Margin Protection Engine validation rules')
  },
  // Page 43: Flowchart: Margin Approval Workflows
  {
    type: 'flowchart',
    title: '43. Flowchart: Margin Approval Workflows',
    subtitle: 'Operational Flowchart of CPQ Approval Routing',
    steps: [
      { title: '1. Calculate Line Margin', desc: 'Checks selling price vs base costs for all quotation lines.' },
      { title: '2. Evaluate Limit Rules', desc: 'Bypass if margin >= 10%. Block if margin < 0%.' },
      { title: '3. Route to Manager Queue', desc: 'If margin is 0%-9.9%, set to "Pending Approval" and queue.' },
      { title: '4. Sign-off Release', desc: 'Manager approves quote to update status to "Final", enabling print.' }
    ]
  },
  // Page 44: Chapter 10: Approval Queue Routing Rules
  {
    type: 'standard',
    title: '44. Chapter 10: Approval Queue Routing Rules',
    subtitle: 'Managing Escalation Paths and Approval Status logs',
    content: getDetailedTextForPage(44, 'Admin approvals queues routing rules')
  },
  // Page 45: Chapter 10: Manager Approvals Overrides
  {
    type: 'standard',
    title: '45. Chapter 10: Manager Approvals Overrides',
    subtitle: 'Reviewing Price Overrides and Signing Off Queue items',
    content: getDetailedTextForPage(45, 'Manager price overrides and queue release guides')
  },
  // Page 46: Flowchart: Order-to-Billing Conversion Flow
  {
    type: 'flowchart',
    title: '46. Flowchart: Order-to-Billing Conversion Flow',
    subtitle: 'Operational Flowchart of Order Billing Lifecycle',
    steps: [
      { title: '1. Finalize Quotation', desc: 'Set quote status to final once approved.' },
      { title: '2. Convert to Sales Order', desc: 'Updates status to ordered, locking items.' },
      { title: '3. Create Billing Invoice', desc: 'Generates invoice number and outputs billing details.' },
      { title: '4. Log Ledger Voucher', desc: 'Logs ledger entry reference to ledger voucher tables.' }
    ]
  },
  // Page 47: Chapter 11: CSM Support Desk & Ticket Logs
  {
    type: 'standard',
    title: '47. Chapter 11: CSM Support Desk & Ticket Logs',
    subtitle: 'Logging Support Cases and Priority SLA Timelines',
    content: getDetailedTextForPage(47, 'CSM customer support desk operations')
  },
  // Page 48: Flowchart: CSM Support Ticket Lifecycle
  {
    type: 'flowchart',
    title: '48. Flowchart: CSM Support Ticket Lifecycle',
    subtitle: 'Service Flowchart of Ticket Intake & SLA Resolution',
    steps: [
      { title: '1. Ticket Created', desc: 'Log case with category, priority, and product serial number.' },
      { title: '2. Warranty Verification', desc: 'Check serial records to verify active AMC coverage.' },
      { title: '3. Dispatch field visit', desc: 'Assign field engineers. Mobile check-in logs GPS coordinates.' },
      { title: '4. Log Resolution & CSAT', desc: 'Confirm resolution to close ticket and trigger survey.' }
    ]
  },
  // Page 49: Chapter 11: CSM Warranty & AMC Verification
  {
    type: 'standard',
    title: '49. Chapter 11: CSM Warranty & AMC Verification',
    subtitle: 'Managing Serial Number Entitlements and Contracts',
    content: getDetailedTextForPage(49, 'Warranties registers and AMC contracts verification')
  },
  // Page 50: Flowchart: Payroll Monthly Run Batch Cycle
  {
    type: 'flowchart',
    title: '50. Flowchart: Payroll Monthly Run Batch Cycle',
    subtitle: 'HR Payroll Flowchart of Monthly Runs & Slip Disbursements',
    steps: [
      { title: '1. Create Run Batch', desc: 'Managers configure run templates for employee salary records.' },
      { title: '2. Calculate Allowances', desc: 'Calculates base pay, allowances, and tax deductions.' },
      { title: '3. Run Locked', desc: 'Run is locked, preventing additions, and logs changes.' },
      { title: '4. Payslip Disbursement', desc: 'Approves run to disburse slips and record payment details.' }
    ]
  }
];

const simpleContent = ({ purpose, steps = [], tips = [], result }) => ([
  { type: 'section', text: 'What this screen is for' },
  { type: 'text', text: purpose },
  { type: 'section', text: 'How to use it' },
  { type: 'text', text: steps.join(' ') },
  { type: 'section', text: 'Good working habit' },
  { type: 'text', text: tips.join(' ') },
  { type: 'section', text: 'Expected result' },
  { type: 'text', text: result }
]);

const flowSteps = (steps) => steps.map((step, index) => ({
  title: `${index + 1}. ${step.title}`,
  desc: step.desc
}));

// Plain-English manual based on the actual app routes and menu modules.
const manualPages = [
  {
    type: 'title',
    title: 'ARCRM User Manual',
    subtitle: 'Simple Guide for Daily Use',
    content: [
      'Document Code: ARCRM-UM-2026-V6',
      'For: Sales, Service, Payroll, Managers, and Admin Users',
      'System Areas: CRM, Sales, Planning, Payroll, Customer Service, Reports',
      'Style: Easy steps, simple words, and practical checks',
      'Published: June 2026'
    ]
  },
  {
    type: 'toc',
    title: 'Table of Contents (Part 1)',
    subtitle: 'Pages 1 to 25',
    content: [
      'Page 1: Title Page',
      'Page 2: Table of Contents Part 1',
      'Page 3: Table of Contents Part 2',
      'Page 4: Login and Home Dashboard',
      'Page 5: User Roles and Access',
      'Page 6: Basic Navigation',
      'Page 7: Customers',
      'Page 8: Vendors',
      'Page 9: Flowchart: Add a New Customer',
      'Page 10: Contacts',
      'Page 11: Products',
      'Page 12: MGR and Attributes',
      'Page 13: Flowchart: Product Setup',
      'Page 14: Terms and Territories',
      'Page 15: Enquiry Register',
      'Page 16: Create or Edit Enquiry',
      'Page 17: Flowchart: Enquiry to Deal',
      'Page 18: Enquiry Analytics',
      'Page 19: Appointments',
      'Page 20: Sales Dashboard',
      'Page 21: Deals Board',
      'Page 22: Flowchart: Deal Follow-up',
      'Page 23: Sales Pipelines',
      'Page 24: Forecasting and Targets',
      'Page 25: Sales Activities'
    ]
  },
  {
    type: 'toc',
    title: 'Table of Contents (Part 2)',
    subtitle: 'Pages 26 to 50',
    content: [
      'Page 26: Sales Reports and Analytics',
      'Page 27: Quotations List',
      'Page 28: Create Quotation',
      'Page 29: Flowchart: Quotation to Invoice',
      'Page 30: Sales Invoices',
      'Page 31: GRN Purchase Entry',
      'Page 32: Price Management',
      'Page 33: CPQ Guided Selling',
      'Page 34: Flowchart: Price Check',
      'Page 35: Approvals and Contracts',
      'Page 36: Orders and Revenue Analytics',
      'Page 37: Planning Screen',
      'Page 38: Flowchart: Planning Entry',
      'Page 39: Simulations and Reports',
      'Page 40: Settings',
      'Page 41: Admin Authorization',
      'Page 42: Payroll Employees',
      'Page 43: Payroll Runs',
      'Page 44: Flowchart: Monthly Payroll',
      'Page 45: Payroll Payments and Payslips',
      'Page 46: Payroll Letters and Reports',
      'Page 47: Customer Service Dashboard',
      'Page 48: Support Tickets',
      'Page 49: Flowchart: Ticket Resolution',
      'Page 50: Warranty, AMC, Knowledge Base, and Service Visits'
    ]
  },
  {
    type: 'standard',
    title: '4. Login and Home Dashboard',
    subtitle: 'Start work and check the day at a glance',
    content: simpleContent({
      purpose: 'Use the login page to enter the system. After login, the dashboard gives a quick view of important work such as enquiries, quotations, sales, planning, service, or payroll depending on your access.',
      steps: ['Enter your email and password.', 'Open Dashboard from the left menu.', 'Use the cards, charts, and lists to see what needs attention today.'],
      tips: ['If a menu is missing, your role may not have access.', 'Do not share your password.', 'Log out when using a shared computer.'],
      result: 'You should know what work is pending and which module to open next.'
    })
  },
  {
    type: 'standard',
    title: '5. User Roles and Access',
    subtitle: 'Understand why some screens are hidden',
    content: simpleContent({
      purpose: 'The system shows screens based on your role. Admin users manage setup and permissions. Managers review team work. Sales, service, and payroll users work on their assigned records.',
      steps: ['Ask the admin to assign the correct role.', 'Open only the modules needed for your job.', 'If access is blocked, request permission instead of using another user account.'],
      tips: ['Access control protects company data.', 'Managers should review access when a person changes department or role.'],
      result: 'Each user sees the correct menus and can work without changing data outside their responsibility.'
    })
  },
  {
    type: 'standard',
    title: '6. Basic Navigation',
    subtitle: 'Move around the system confidently',
    content: simpleContent({
      purpose: 'Most screens follow the same pattern: search or filter records, open a record, add or edit details, save, and return to the list.',
      steps: ['Use the left menu to open a module.', 'Use Search, Filter, New, Edit, View, Save, Delete, Import, or Export where available.', 'Check toast messages at the top right after saving.'],
      tips: ['Use filters before assuming a record is missing.', 'Read required field marks before saving.', 'Keep notes short but clear.'],
      result: 'You can find records faster and avoid creating duplicate entries.'
    })
  },
  {
    type: 'standard',
    title: '7. Customers',
    subtitle: 'Maintain customer master records',
    content: simpleContent({
      purpose: 'The Customers screen stores company names, contact details, GST or tax details, address, sales owner, and other customer information used in enquiries, quotations, planning, and service.',
      steps: ['Open Master > Customers.', 'Click New or Edit.', 'Fill the customer name, address, contact details, and owner.', 'Save and check the customer appears in the list.'],
      tips: ['Search before adding a customer.', 'Keep spelling consistent.', 'Update old contact details before creating a quotation.'],
      result: 'Sales and service teams can select the correct customer everywhere in the system.'
    })
  },
  {
    type: 'standard',
    title: '8. Vendors',
    subtitle: 'Maintain supplier details',
    content: simpleContent({
      purpose: 'The Vendors screen stores supplier information used for products, purchase work, GRN, and internal reference.',
      steps: ['Open Master > Vendors.', 'Add vendor name, address, phone, email, and other details.', 'Save changes and review the vendor list.'],
      tips: ['Keep vendor names unique.', 'Update inactive vendors instead of deleting if old records still refer to them.'],
      result: 'Purchase and product teams can select vendors correctly during daily work.'
    })
  },
  {
    type: 'flowchart',
    title: '9. Flowchart: Add a New Customer',
    subtitle: 'Simple customer creation flow',
    steps: flowSteps([
      { title: 'Search First', desc: 'Check if the customer already exists.' },
      { title: 'Enter Details', desc: 'Add name, address, phone, email, and tax details.' },
      { title: 'Assign Owner', desc: 'Select sales person or territory if required.' },
      { title: 'Save and Check', desc: 'Save and confirm the customer appears in the list.' }
    ])
  },
  {
    type: 'standard',
    title: '10. Contacts',
    subtitle: 'Manage people connected to customers',
    content: simpleContent({
      purpose: 'Contacts are individual people such as buyers, decision makers, accounts staff, or service contacts. They help teams call, email, and follow up with the right person.',
      steps: ['Open Master > Contacts.', 'Add the person name, phone, email, company, and role.', 'Link the contact to the correct customer where possible.'],
      tips: ['Use real names and clear job titles.', 'Mark old numbers or emails as updated instead of keeping wrong details.'],
      result: 'Users can quickly find who to contact for sales, service, billing, or support.'
    })
  },
  {
    type: 'standard',
    title: '11. Products',
    subtitle: 'Maintain item and service records',
    content: simpleContent({
      purpose: 'Products store item names, codes, categories, prices, vendor links, and other details used in quotations, invoices, planning, and reports.',
      steps: ['Open Master > Products.', 'Add or edit product details.', 'Check category, price, tax, vendor, and active status.', 'Save and test by searching the product.'],
      tips: ['Use one product code for one item.', 'Do not create a new product just to change a price; update price records where applicable.'],
      result: 'Users can select the correct product while making quotations, invoices, and plans.'
    })
  },
  {
    type: 'standard',
    title: '12. MGR and Attributes',
    subtitle: 'Group products and add product details',
    content: simpleContent({
      purpose: 'MGR and Attributes help classify products. MGR is used for grouping. Attributes are details like size, material, type, model, or other product features.',
      steps: ['Open Master > MGRs to manage product groups.', 'Open Master > Attributes to define extra product details.', 'Link attributes carefully so users see the right options.'],
      tips: ['Keep names short and meaningful.', 'Avoid duplicate attribute names with slightly different spelling.'],
      result: 'Products become easier to search, filter, quote, and report.'
    })
  },
  {
    type: 'flowchart',
    title: '13. Flowchart: Product Setup',
    subtitle: 'Simple product setup flow',
    steps: flowSteps([
      { title: 'Create Group', desc: 'Set MGR or category if required.' },
      { title: 'Add Product', desc: 'Enter product name, code, price, and tax.' },
      { title: 'Add Details', desc: 'Attach attributes, vendor, and other useful data.' },
      { title: 'Use in Work', desc: 'Select the product in quotation, planning, or invoice.' }
    ])
  },
  {
    type: 'standard',
    title: '14. Terms and Territories',
    subtitle: 'Set common terms and sales areas',
    content: simpleContent({
      purpose: 'Terms store common text used in quotations or documents. Territories help divide customers or sales responsibility by area.',
      steps: ['Open Master > Terms to add payment, warranty, or delivery terms.', 'Open Master > Territories to create sales areas and assign users.', 'Use clear names that teams can understand.'],
      tips: ['Review terms before using them in customer documents.', 'Keep territory assignments updated when team members change.'],
      result: 'Quotations and customer ownership become more consistent.'
    })
  },
  {
    type: 'standard',
    title: '15. Enquiry Register',
    subtitle: 'Track customer enquiries',
    content: simpleContent({
      purpose: 'The Enquiry Register stores incoming customer interest from phone, email, website, visits, or referrals. It helps sales teams track new opportunities.',
      steps: ['Open Enquiry > Enquiry Register.', 'Search, filter, and review open enquiries.', 'Open an enquiry to update status, requirement, follow-up date, or notes.'],
      tips: ['Enter enquiries as soon as possible.', 'Use clear requirement notes so another person can continue the conversation.'],
      result: 'No customer enquiry is missed, and managers can see enquiry progress.'
    })
  },
  {
    type: 'standard',
    title: '16. Create or Edit Enquiry',
    subtitle: 'Record customer needs clearly',
    content: simpleContent({
      purpose: 'Use Create Enquiry to capture customer name, contact person, requirement, source, expected value, stage, owner, and next follow-up.',
      steps: ['Click New Enquiry.', 'Select or add the customer.', 'Enter requirement and expected date.', 'Assign owner and save.', 'Update the enquiry after every call or meeting.'],
      tips: ['Do not leave follow-up date blank.', 'Write notes that explain what the customer wants and what was promised.'],
      result: 'The sales team has a clear next action for every enquiry.'
    })
  },
  {
    type: 'flowchart',
    title: '17. Flowchart: Enquiry to Deal',
    subtitle: 'Move interest into sales pipeline',
    steps: flowSteps([
      { title: 'Receive Enquiry', desc: 'Record the customer request.' },
      { title: 'Qualify Need', desc: 'Check budget, product fit, and urgency.' },
      { title: 'Create Deal', desc: 'Move qualified enquiries to the deal board.' },
      { title: 'Follow Up', desc: 'Track calls, quotations, and next action.' }
    ])
  },
  {
    type: 'standard',
    title: '18. Enquiry Analytics',
    subtitle: 'Understand enquiry performance',
    content: simpleContent({
      purpose: 'Analytics helps managers see enquiry count, source, status, conversion, and team performance.',
      steps: ['Open Enquiry > Analytics.', 'Select date range or filters.', 'Review charts and lists.', 'Use insights to follow up delayed enquiries.'],
      tips: ['Check filters before reading numbers.', 'Compare current period with previous period for a better view.'],
      result: 'Managers know which enquiries need attention and which sources are working best.'
    })
  },
  {
    type: 'standard',
    title: '19. Appointments',
    subtitle: 'Plan meetings and visits',
    content: simpleContent({
      purpose: 'Appointments help teams schedule customer meetings, calls, demos, and follow-up visits.',
      steps: ['Open Appointments.', 'Create a new appointment with customer, date, time, owner, and purpose.', 'After the meeting, update notes and next action.'],
      tips: ['Keep meeting outcomes short and useful.', 'Do not delete old meetings if they explain customer history.'],
      result: 'Everyone can see planned and completed customer interactions.'
    })
  },
  {
    type: 'standard',
    title: '20. Sales Dashboard',
    subtitle: 'Review sales work quickly',
    content: simpleContent({
      purpose: 'The Sales Dashboard gives a quick view of pipeline value, open deals, targets, activities, and team progress.',
      steps: ['Open Sales Pipeline > Sales Dashboard.', 'Review the summary cards.', 'Check charts for delayed or important items.', 'Open the related list for action.'],
      tips: ['Use the dashboard at the start of the day.', 'Do not treat dashboard numbers as final until filters are checked.'],
      result: 'Sales users and managers know what needs attention first.'
    })
  },
  {
    type: 'standard',
    title: '21. Deals Board',
    subtitle: 'Manage opportunities by stage',
    content: simpleContent({
      purpose: 'The Deals Board shows opportunities in stages such as discovery, proposal, negotiation, won, or lost. It helps users move work step by step.',
      steps: ['Open Sales Pipeline > Deals.', 'Create or open a deal.', 'Update value, stage, owner, expected close date, and notes.', 'Move the deal only when the stage is truly complete.'],
      tips: ['Keep close dates realistic.', 'Add notes after every important customer conversation.'],
      result: 'The sales pipeline shows the real status of active opportunities.'
    })
  },
  {
    type: 'flowchart',
    title: '22. Flowchart: Deal Follow-up',
    subtitle: 'Keep deals moving',
    steps: flowSteps([
      { title: 'Create Deal', desc: 'Add customer, value, owner, and stage.' },
      { title: 'Add Activity', desc: 'Record call, meeting, demo, or email.' },
      { title: 'Send Quote', desc: 'Create quotation when customer is ready.' },
      { title: 'Close Deal', desc: 'Mark won or lost with clear reason.' }
    ])
  },
  {
    type: 'standard',
    title: '23. Sales Pipelines',
    subtitle: 'Set stages for sales work',
    content: simpleContent({
      purpose: 'Sales Pipelines define the stages used on the Deals Board. Admins or managers can create stages that match the company sales process.',
      steps: ['Open Sales Pipeline > Pipelines.', 'Create or edit pipeline stages.', 'Keep stage names simple and in the correct order.'],
      tips: ['Too many stages make daily use difficult.', 'Change stages carefully because reports depend on them.'],
      result: 'All sales users follow the same process and reports become easier to read.'
    })
  },
  {
    type: 'standard',
    title: '24. Forecasting and Targets',
    subtitle: 'Plan expected sales and goals',
    content: simpleContent({
      purpose: 'Forecasting shows expected revenue. Targets show planned sales goals for users, teams, or periods.',
      steps: ['Open Forecasting to review expected revenue.', 'Open Targets to set or review sales goals.', 'Compare target, forecast, and actual work regularly.'],
      tips: ['Update deal values and close dates before reviewing forecast.', 'Targets should be reviewed with the team.'],
      result: 'Managers can see whether the sales team is on track.'
    })
  },
  {
    type: 'standard',
    title: '25. Sales Activities',
    subtitle: 'See calls, meetings, and actions',
    content: simpleContent({
      purpose: 'Sales Activities brings together follow-ups, calls, meetings, and deal notes so managers can review work history.',
      steps: ['Open Sales Pipeline > Activities.', 'Filter by user, customer, date, or deal.', 'Review pending and completed actions.'],
      tips: ['Record activities soon after they happen.', 'Use clear notes so managers understand the status without asking again.'],
      result: 'The team has a shared history of customer communication.'
    })
  },
  {
    type: 'standard',
    title: '26. Sales Reports and Analytics',
    subtitle: 'Review sales results',
    content: simpleContent({
      purpose: 'Reports and Analytics show pipeline movement, stuck deals, win/loss information, salesperson performance, and revenue trends.',
      steps: ['Open Sales Reports or Sales Analytics.', 'Choose filters such as date, user, stage, or pipeline.', 'Export or discuss the results if needed.'],
      tips: ['Always check filter dates before sharing numbers.', 'Use reports to improve follow-up, not only to review past work.'],
      result: 'Managers get a clear view of team performance and problem areas.'
    })
  },
  {
    type: 'standard',
    title: '27. Quotations List',
    subtitle: 'View and manage quotations',
    content: simpleContent({
      purpose: 'The Quotations list shows all saved quotations. Users can search, open, edit, finalize, or review quotation status.',
      steps: ['Open Sales > Quotations.', 'Search by customer, quotation number, status, or date.', 'Open the quotation to view details or continue editing.'],
      tips: ['Do not create a new quotation if an editable draft already exists.', 'Check quotation status before sending to customer.'],
      result: 'All customer offers are easy to find and review.'
    })
  },
  {
    type: 'standard',
    title: '28. Create Quotation',
    subtitle: 'Prepare customer quotation',
    content: simpleContent({
      purpose: 'Create Quotation is used to select customer, add products, quantities, prices, taxes, discounts, terms, and notes before sharing the offer.',
      steps: ['Click New Quotation.', 'Select customer and contact.', 'Add products and quantities.', 'Check price, tax, discount, and terms.', 'Save, preview, and finalize when ready.'],
      tips: ['Check product and price carefully before finalizing.', 'Use saved terms to avoid typing mistakes.'],
      result: 'A clean quotation is ready for review, printing, or sending to the customer.'
    })
  },
  {
    type: 'flowchart',
    title: '29. Flowchart: Quotation to Invoice',
    subtitle: 'From offer to billing',
    steps: flowSteps([
      { title: 'Create Quote', desc: 'Add customer, items, price, tax, and terms.' },
      { title: 'Review Quote', desc: 'Check totals, discounts, and notes.' },
      { title: 'Finalize', desc: 'Lock or approve the quotation when ready.' },
      { title: 'Create Invoice', desc: 'Use approved details for billing.' }
    ])
  },
  {
    type: 'standard',
    title: '30. Sales Invoices',
    subtitle: 'Create outward invoice',
    content: simpleContent({
      purpose: 'Sales Invoices record billing to customers. They include customer details, products, quantities, tax, totals, and invoice status.',
      steps: ['Open Sales > Create Invoice.', 'Select customer and add items.', 'Check tax and totals.', 'Save and review the invoice.'],
      tips: ['Use correct customer billing details.', 'Do not change finalized invoice values without approval.'],
      result: 'The invoice is saved and can be viewed or printed when needed.'
    })
  },
  {
    type: 'standard',
    title: '31. GRN Purchase Entry',
    subtitle: 'Record received material',
    content: simpleContent({
      purpose: 'GRN records goods received from vendors. It helps purchase and inventory teams keep track of incoming material.',
      steps: ['Open Purchase > GRN.', 'Create a new GRN.', 'Select vendor, add products, quantity, date, and reference details.', 'Save and review the entry.'],
      tips: ['Match received quantity with physical material.', 'Keep vendor and product names correct.'],
      result: 'Material receipt is recorded and available for later review.'
    })
  },
  {
    type: 'standard',
    title: '32. Price Management',
    subtitle: 'Manage price books, discounts, and currency',
    content: simpleContent({
      purpose: 'Price Management controls price books, pricing rules, discounts, promotions, and currency rates used in sales and quotations.',
      steps: ['Open the required price management tab.', 'Add or update prices and rules.', 'Check dates, customer or region, and active status.', 'Test pricing on a quotation when needed.'],
      tips: ['Small price changes can affect many quotations.', 'Keep expired promotions inactive.'],
      result: 'Users see the right price while preparing quotations and sales documents.'
    })
  },
  {
    type: 'standard',
    title: '33. CPQ Guided Selling',
    subtitle: 'Help users choose the right product',
    content: simpleContent({
      purpose: 'Guided Selling and Configurator screens help sales users select products based on customer needs, options, and pricing.',
      steps: ['Open Sales CPQ > Guided Selling or Configurator.', 'Answer customer requirement questions.', 'Review suggested products or options.', 'Use the result in quotation preparation.'],
      tips: ['Confirm customer requirement before selecting options.', 'Do not promise options that are not available in product setup.'],
      result: 'Sales users can prepare more accurate product suggestions.'
    })
  },
  {
    type: 'flowchart',
    title: '34. Flowchart: Price Check',
    subtitle: 'Check price before quote',
    steps: flowSteps([
      { title: 'Choose Customer', desc: 'Select customer and region.' },
      { title: 'Choose Product', desc: 'Select item, quantity, and options.' },
      { title: 'Apply Rules', desc: 'Check price book, discount, promotion, and tax.' },
      { title: 'Confirm Total', desc: 'Review final amount before sharing.' }
    ])
  },
  {
    type: 'standard',
    title: '35. Approvals and Contracts',
    subtitle: 'Review special deals and agreements',
    content: simpleContent({
      purpose: 'Approvals help managers review special prices, discounts, or deal decisions. Contracts store customer agreements and important commercial terms.',
      steps: ['Open Sales > Approvals to review pending items.', 'Approve, reject, or ask for correction.', 'Open Contracts to add or view customer agreements.'],
      tips: ['Write a reason when rejecting or approving special cases.', 'Keep contract dates and customer links correct.'],
      result: 'Important sales decisions are reviewed and documented.'
    })
  },
  {
    type: 'standard',
    title: '36. Orders and Revenue Analytics',
    subtitle: 'Track confirmed business',
    content: simpleContent({
      purpose: 'Orders show confirmed customer work. Revenue Analytics helps managers understand sales value, trends, and revenue movement.',
      steps: ['Open Sales > Orders to view or update orders.', 'Open Revenue Analytics to review revenue by date, customer, product, or team.', 'Use filters for accurate review.'],
      tips: ['Keep order status updated.', 'Check source data before sharing revenue numbers.'],
      result: 'Confirmed business and revenue trends are visible to the team.'
    })
  },
  {
    type: 'standard',
    title: '37. Planning Screen',
    subtitle: 'Enter and review revenue plan',
    content: simpleContent({
      purpose: 'Planning is used to prepare revenue plans by customer, product, month, status, and business group. It supports management review and forecasting.',
      steps: ['Open Planning > Planning Screen.', 'Select financial year and filters.', 'Add or edit planning entries.', 'Review totals and summary views.'],
      tips: ['Enter customer and product carefully.', 'Use the correct month and status.', 'Avoid editing previous-year data unless you have permission.'],
      result: 'The company has a clear plan for expected revenue.'
    })
  },
  {
    type: 'flowchart',
    title: '38. Flowchart: Planning Entry',
    subtitle: 'Add a planning record',
    steps: flowSteps([
      { title: 'Select Year', desc: 'Choose the correct financial year.' },
      { title: 'Add Details', desc: 'Select customer, product, MGR, month, and status.' },
      { title: 'Enter Value', desc: 'Add planned value or quantity.' },
      { title: 'Review Summary', desc: 'Check totals and reports after saving.' }
    ])
  },
  {
    type: 'standard',
    title: '39. Simulations and Reports',
    subtitle: 'Test scenarios and export data',
    content: simpleContent({
      purpose: 'Simulations help test possible sales or planning changes. Reports give downloadable and reviewable data for management.',
      steps: ['Open Simulations to try planned changes.', 'Open Reports for summary or export.', 'Use filters before downloading data.'],
      tips: ['Do not treat simulation values as final data.', 'Share reports with filter details so others understand the numbers.'],
      result: 'Managers can study possible outcomes and review actual records.'
    })
  },
  {
    type: 'standard',
    title: '40. Settings',
    subtitle: 'Manage company and profile details',
    content: simpleContent({
      purpose: 'Settings stores company profile, address, bank details, signatory, default terms, and footer page content.',
      steps: ['Open Settings.', 'Update only the section you need.', 'Save and check documents or footer pages if the change affects them.'],
      tips: ['Company settings can appear on printed documents.', 'Review spelling and bank details carefully.'],
      result: 'Documents and company information show correct details.'
    })
  },
  {
    type: 'standard',
    title: '41. Admin Authorization',
    subtitle: 'Control who can access what',
    content: simpleContent({
      purpose: 'Authorization lets admins decide which roles can see and use each module.',
      steps: ['Open Admin > Authorization.', 'Select a role.', 'Turn module permissions on or off.', 'Save and ask the user to refresh or log in again.'],
      tips: ['Give only the access a user needs.', 'Review permissions when staff changes roles.'],
      result: 'Users see the correct menus and company data remains protected.'
    })
  },
  {
    type: 'standard',
    title: '42. Payroll Employees',
    subtitle: 'Maintain employee salary profiles',
    content: simpleContent({
      purpose: 'Payroll Employees stores employee personal details, job details, bank details, salary structure, and deductions.',
      steps: ['Open Payroll > Employees.', 'Add or edit employee profile.', 'Enter salary components and deductions.', 'Save and review before payroll run.'],
      tips: ['Check PAN, Aadhaar, bank account, joining date, department, and designation.', 'Salary changes should be reviewed before monthly payroll.'],
      result: 'Employee salary details are ready for payroll calculation.'
    })
  },
  {
    type: 'standard',
    title: '43. Payroll Runs',
    subtitle: 'Calculate salary for a month',
    content: simpleContent({
      purpose: 'Payroll Runs create monthly salary batches. Admins can calculate, review, lock, and approve payroll.',
      steps: ['Open Payroll > Run Payroll.', 'Create a run for the month.', 'Calculate salary.', 'Review employee summaries.', 'Lock and approve only after checking.'],
      tips: ['Do not approve before checking deductions and payments.', 'Keep payroll settings updated before calculation.'],
      result: 'Monthly payroll is calculated and ready for payslips and payment records.'
    })
  },
  {
    type: 'flowchart',
    title: '44. Flowchart: Monthly Payroll',
    subtitle: 'Simple payroll run flow',
    steps: flowSteps([
      { title: 'Prepare Employees', desc: 'Update salary and bank details.' },
      { title: 'Create Run', desc: 'Select month and create payroll batch.' },
      { title: 'Calculate and Review', desc: 'Check earnings, deductions, and net pay.' },
      { title: 'Approve and Pay', desc: 'Approve run, record payments, and issue payslips.' }
    ])
  },
  {
    type: 'standard',
    title: '45. Payroll Payments and Payslips',
    subtitle: 'Record salary payment and view slips',
    content: simpleContent({
      purpose: 'Payments records salary payment status, mode, date, and reference. Payslips let users view or issue salary slips.',
      steps: ['Open Payroll > Payments to update payment details.', 'Open Payroll > Payslips to view salary slips.', 'Confirm payment status after salary is paid.'],
      tips: ['Use correct transaction reference.', 'Do not mark payment complete until money is actually processed.'],
      result: 'Salary payment records and payslips are clear and ready for review.'
    })
  },
  {
    type: 'standard',
    title: '46. Payroll Letters and Reports',
    subtitle: 'Generate HR letters and payroll reports',
    content: simpleContent({
      purpose: 'Letters help prepare offer, appointment, promotion, and relieving letters. Payroll Reports show salary, deductions, allocation, and audit details.',
      steps: ['Open Payroll > Letters to create or review a letter.', 'Open Payroll > Reports to view payroll summaries.', 'Use filters and download if needed.'],
      tips: ['Review letter text before sharing.', 'Check report period before exporting.'],
      result: 'HR documents and payroll summaries are available in one place.'
    })
  },
  {
    type: 'standard',
    title: '47. Customer Service Dashboard',
    subtitle: 'Review support work',
    content: simpleContent({
      purpose: 'The Customer Service dashboard shows ticket counts, service status, pending work, and service performance.',
      steps: ['Open Customer Service > CSM Dashboard.', 'Review open, pending, and closed work.', 'Open related tickets or reports for details.'],
      tips: ['Use the dashboard to start the service day.', 'Follow up high priority tickets first.'],
      result: 'Service managers know which customer issues need attention.'
    })
  },
  {
    type: 'standard',
    title: '48. Support Tickets',
    subtitle: 'Create and resolve customer issues',
    content: simpleContent({
      purpose: 'Tickets record customer complaints, service requests, priority, category, owner, status, and resolution notes.',
      steps: ['Open Customer Service > Tickets Management.', 'Create or open a ticket.', 'Add customer, issue, priority, category, owner, and notes.', 'Update status as work progresses.'],
      tips: ['Write the issue clearly.', 'Add resolution notes before closing.', 'Do not close a ticket until the customer issue is handled.'],
      result: 'Customer support work is traceable from creation to closure.'
    })
  },
  {
    type: 'flowchart',
    title: '49. Flowchart: Ticket Resolution',
    subtitle: 'Close service issues properly',
    steps: flowSteps([
      { title: 'Create Ticket', desc: 'Record customer and issue details.' },
      { title: 'Assign Owner', desc: 'Set priority, category, and responsible person.' },
      { title: 'Work on Issue', desc: 'Add visit, notes, or warranty details.' },
      { title: 'Close Ticket', desc: 'Add resolution and confirm status.' }
    ])
  },
  {
    type: 'standard',
    title: '50. Warranty, AMC, Knowledge Base, and Service Visits',
    subtitle: 'Support service teams after ticket creation',
    content: simpleContent({
      purpose: 'Warranty and AMC screens track customer entitlements. Knowledge Base stores help articles. Service Visits schedule and record field engineer work.',
      steps: ['Open Warranty & AMC to check coverage.', 'Open Knowledge Base for common fixes and FAQs.', 'Open Field Service Visits to schedule or review visits.', 'Update records after service is complete.'],
      tips: ['Check warranty or AMC before promising free service.', 'Use knowledge articles to solve repeated issues faster.', 'Keep visit notes clear.'],
      result: 'Service teams can support customers with accurate coverage, helpful instructions, and clear visit history.'
    })
  }
];

// PDF Document component builder
const createDocument = () => {
  const pages = manualPages.map((pageData, index) => {
    const pageNum = index + 1;
    
    // Render Title Page specifically
    if (pageData.type === 'title') {
      return el(Page, { key: pageNum, size: 'A4', style: styles.page },
        el(View, { style: styles.titlePageContainer },
          el(View, null,
            el(Text, { style: styles.mainTitle }, pageData.title),
            el(Text, { style: styles.mainSub }, pageData.subtitle)
          ),
          el(View, { style: styles.metaBox },
            pageData.content.map((line, idx) => el(Text, { key: idx, style: styles.metaText }, line))
          )
        ),
        el(View, { style: styles.footer },
          el(Text, null, 'ARCRM USER REFERENCE MANUAL'),
          el(Text, null, `Page ${pageNum} of 50`)
        )
      );
    }
    
    // Render Table of Contents
    if (pageData.type === 'toc') {
      return el(Page, { key: pageNum, size: 'A4', style: styles.page },
        el(View, { style: styles.headerContainer },
          el(View, null,
            el(Text, { style: styles.pageTitle }, pageData.title),
            el(Text, { style: styles.pageSub }, pageData.subtitle)
          ),
          el(View, null,
            el(Text, { style: styles.pageMeta }, 'Section: Index'),
            el(Text, { style: styles.pageMeta }, `DocRef: TOC-${pageNum === 2 ? '1' : '2'}`)
          )
        ),
        el(Text, { style: styles.sectionTitle }, 'User Manual Chapters Index'),
        el(View, { style: { flexDirection: 'column', marginTop: 5 } },
          pageData.content.map((item, idx) => {
            const parts = item.split(': ');
            const displayTitle = parts[0];
            const pageName = parts[1];
            return el(View, { key: idx, style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4.2 } },
              el(Text, { style: { fontSize: 8.2, color: '#334155', fontWeight: 'bold' } }, displayTitle),
              el(Text, { style: { fontSize: 8.2, color: '#64748b' } }, pageName)
            );
          })
        ),
        el(View, { style: styles.footer },
          el(Text, null, 'ARCRM User Manual - Author: Om Wagh'),
          el(Text, null, `Page ${pageNum} of 50`)
        )
      );
    }
    
    // Render Flowchart Pages
    if (pageData.type === 'flowchart') {
      const flowchartDescData = getFlowchartDesc(pageData.title.substring(11));
      
      return el(Page, { key: pageNum, size: 'A4', style: styles.page },
        el(View, { style: styles.headerContainer },
          el(View, null,
            el(Text, { style: styles.pageTitle }, pageData.title),
            el(Text, { style: styles.pageSub }, pageData.subtitle)
          ),
          el(View, null,
            el(Text, { style: styles.pageMeta }, 'Section: Flowchart Diagram'),
            el(Text, { style: styles.pageMeta }, `DocRef: FC-${pageNum}`)
          )
        ),
        
        el(Text, { style: styles.sectionTitle }, 'Sequence Diagram'),
        el(View, { style: styles.cpqFlowContainer, wrap: false },
          pageData.steps.map((step, idx) => {
            const isLast = idx === pageData.steps.length - 1;
            const boxColors = [styles.boxColorBlue, styles.boxColorPurple, styles.boxColorAmber, styles.boxColorGreen];
            const currentBoxColor = boxColors[idx % boxColors.length];
            
            return el(React.Fragment, { key: idx },
              el(View, { style: [styles.cpqBox, currentBoxColor] },
                el(Text, { style: styles.cpqBoxTitle }, step.title),
                el(Text, { style: styles.cpqBoxDesc }, step.desc)
              ),
              !isLast && el(Text, { style: styles.arrowDown }, 'v')
            );
          })
        ),
        
        el(View, null,
          flowchartDescData.map((block, idx) => {
            if (block.type === 'section') {
              return el(Text, { key: idx, style: styles.sectionTitle }, block.text);
            }
            if (block.type === 'text') {
              return el(Text, { key: idx, style: styles.paragraph }, block.text);
            }
            return null;
          })
        ),

        renderVisualExplainer(pageData, pageNum),

        renderCheckpointGrid(getFlowchartCheckpoints(pageData.title.substring(11))),
        
        el(View, { style: styles.footer },
          el(Text, null, 'ARCRM User Manual - Author: Om Wagh'),
          el(Text, null, `Page ${pageNum} of 50`)
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
          el(Text, { style: styles.pageMeta }, `Section: ${pageNum <= 15 ? 'Introduction & CRM' : pageNum <= 35 ? 'Commercials & CPQ' : 'Operations & HR'}`),
          el(Text, { style: styles.pageMeta }, `DocRef: UM-${pageNum}`)
        )
      ),
      
      el(View, null,
        pageData.content.map((block, idx) => {
          if (block.type === 'section') {
            return el(Text, { key: idx, style: styles.sectionTitle }, block.text);
          }
          if (block.type === 'text') {
            return el(Text, { key: idx, style: styles.paragraph }, block.text);
          }
          return null;
        })
      ),

      renderVisualExplainer(pageData, pageNum),

      renderCheckpointGrid(getStandardCheckpoints(pageData.title.replace(/^\d+\.\s*/, ''))),
      
      el(View, { style: styles.footer },
        el(Text, null, 'ARCRM User Manual - Author: Om Wagh'),
        el(Text, null, `Page ${pageNum} of 50`)
      )
    );
  });
  
  return el(Document, null, ...pages);
};

// Save file to filesystem
const outputPath = './ARCRM_50Page_UserManual.pdf';
ReactPDF.render(createDocument(), outputPath)
  .then(() => console.log('Successfully generated ARCRM_50Page_UserManual.pdf at ' + outputPath))
  .catch((err) => {
    console.error('Error generating PDF:', err);
    process.exit(1);
  });
