import React from 'react';
import ReactPDF, { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    backgroundColor: '#f8fafc',
    fontSize: 9,
    color: '#334155'
  },
  headerContainer: {
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
    paddingBottom: 8,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  subtitle: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 3,
    fontWeight: 'medium'
  },
  meta: {
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'right'
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e293b',
    backgroundColor: '#cbd5e1',
    padding: 5,
    borderRadius: 3,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  
  // Page 1: Arch columns
  archContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  archColumn: {
    width: '32%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8
  },
  archColHeader: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#1e3a8a',
    borderBottomWidth: 1.5,
    borderBottomColor: '#3b82f6',
    paddingBottom: 3,
    marginBottom: 6,
    textTransform: 'uppercase',
    textAlign: 'center'
  },
  flowBox: {
    padding: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    marginBottom: 5
  },
  flowTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#1e293b',
    textTransform: 'uppercase',
    marginBottom: 1.5
  },
  flowDesc: {
    fontSize: 6.5,
    color: '#64748b',
    lineHeight: 1.1
  },

  // Connectors
  arrowDown: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 2
  },
  
  // Footer
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8'
  },

  // Page 2 & 3: Flow list & Grid cards
  cpqFlowContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginVertical: 5
  },
  cpqBox: {
    width: 320,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: '#ffffff'
  },
  boxColorBlue: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  boxColorPurple: { borderColor: '#8b5cf6', backgroundColor: '#f5f3ff' },
  boxColorAmber: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  boxColorGreen: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  boxColorCyan: { borderColor: '#06b6d4', backgroundColor: '#ecfeff' },
  boxColorSlate: { borderColor: '#64748b', backgroundColor: '#f8fafc' },
  
  cpqBoxTitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 2,
    textTransform: 'uppercase',
    textAlign: 'center'
  },
  cpqBoxDesc: {
    fontSize: 7,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 1.2
  },

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 5
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 5,
    padding: 8,
    marginBottom: 8
  },
  cardHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 3,
    marginBottom: 5,
    textTransform: 'uppercase'
  },
  cardItem: {
    flexDirection: 'row',
    marginBottom: 2,
    lineHeight: 1.2
  },
  cardBullet: {
    width: 8,
    fontWeight: 'bold',
    color: '#3b82f6',
    fontSize: 7
  },
  cardText: {
    flex: 1,
    fontSize: 7,
    color: '#475569'
  }
});

const el = React.createElement;

const SystemFlowchartPDF = () => el(Document, null,
  // Page 1: Overview & Architecture
  el(Page, { size: 'A4', style: styles.page },
    el(View, { style: styles.headerContainer },
      el(View, null,
        el(Text, { style: styles.title }, 'NeoComp Suite: System Map'),
        el(Text, { style: styles.subtitle }, 'Core Architecture & High-Level Module Interactions')
      ),
      el(View, null,
        el(Text, { style: styles.meta }, 'Scope: All Modules & Workflows'),
        el(Text, { style: styles.meta }, 'Enterprise Reference Blueprint')
      )
    ),

    el(Text, { style: styles.sectionTitle }, '1. High-Level Enterprise Data Flow Architecture'),

    el(View, { style: styles.archContainer },
      // Column 1: Demand & Sales Pipeline
      el(View, { style: styles.archColumn },
        el(Text, { style: styles.archColHeader }, 'Sales & Demand Gen'),
        el(View, { style: styles.flowBox },
          el(Text, { style: styles.flowTitle }, '1. Enquiry & Leads'),
          el(Text, { style: styles.flowDesc }, 'Captures initial business inquiries. Automatically detects duplicates and runs territory assignment rules.')
        ),
        el(View, { style: styles.flowBox },
          el(Text, { style: styles.flowTitle }, '2. Meetings Log'),
          el(Text, { style: styles.flowDesc }, 'Schedules appointments, tracks interactions, and logs customer meeting history.')
        ),
        el(View, { style: styles.flowBox },
          el(Text, { style: styles.flowTitle }, '3. Sales Pipeline & Deals'),
          el(Text, { style: styles.flowDesc }, 'Manages deals in visual pipelines. Tracks salesperson activities, targets, and monthly forecasts.')
        )
      ),

      // Column 2: Commercials & CPQ Engine
      el(View, { style: styles.archColumn },
        el(Text, { style: styles.archColHeader }, 'Commercials & CPQ'),
        el(View, { style: styles.flowBox },
          el(Text, { style: styles.flowTitle }, '4. Product & Pricing Master'),
          el(Text, { style: styles.flowDesc }, 'Defines products, price books, promotions, and discount policies.')
        ),
        el(View, { style: styles.flowBox },
          el(Text, { style: styles.flowTitle }, '5. Guided Selling & Simulator'),
          el(Text, { style: styles.flowDesc }, 'Aids salespeople in selecting optimal items. Simulates margins and discounts instantly.')
        ),
        el(View, { style: styles.flowBox },
          el(Text, { style: styles.flowTitle }, '6. Quotation & Approvals'),
          el(Text, { style: styles.flowDesc }, 'Saves quotation versions, applies SLA-bound margin check rules (<10% pends approval).')
        )
      ),

      // Column 3: Back-Office & Operations
      el(View, { style: styles.archColumn },
        el(Text, { style: styles.archColHeader }, 'Operations & Back-Office'),
        el(View, { style: styles.flowBox },
          el(Text, { style: styles.flowTitle }, '7. Sales Orders & Billing'),
          el(Text, { style: styles.flowDesc }, 'Converts finalized quotes into sales orders, books invoices, and logs ledger vouchers.')
        ),
        el(View, { style: styles.flowBox },
          el(Text, { style: styles.flowTitle }, '8. CSM Support Tickets'),
          el(Text, { style: styles.flowDesc }, 'Resolves customer support cases. Integrates AMC validation and geo-tagged field visits.')
        ),
        el(View, { style: styles.flowBox },
          el(Text, { style: styles.flowTitle }, '9. Planning & Payroll'),
          el(Text, { style: styles.flowDesc }, 'Manages financial year plans (SBU breakdown) and HR payroll runs, letter templates, and salary payments.')
        )
      )
    ),

    el(Text, { style: styles.sectionTitle }, '2. Core Cross-Module Integrations'),
    el(View, { style: styles.gridContainer },
      el(View, { style: styles.gridCard },
        el(Text, { style: styles.cardHeader }, 'Lead to Quote Integration'),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Enquiry details automatically match registered customer records by mobile/GSTIN.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Qualified leads are converted to deals in the active Sales Pipeline.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Deal data and linked assets load directly into the CPQ quotation configurator.')
        )
      ),
      el(View, { style: styles.gridCard },
        el(Text, { style: styles.cardHeader }, 'Billing & Inventory link'),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Finalized quotations generate Sales Orders, which trigger invoice creation.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Voucher ledger records are created automatically for invoice references.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Inbound purchase GRNs record incoming goods to update store quantities.')
        )
      )
    ),

    el(View, { style: styles.footer },
      el(Text, null, 'NeoComp Enterprise Suite - Core blueprint'),
      el(Text, null, 'Page 1 of 3')
    )
  ),

  // Page 2: Commercial & Sales Pipeline Flowchart
  el(Page, { size: 'A4', style: styles.page },
    el(View, { style: styles.headerContainer },
      el(View, null,
        el(Text, { style: styles.title }, 'Core Commercial Lifecycle'),
        el(Text, { style: styles.subtitle }, 'Step-by-Step Data Flow: Lead Capture to Order Conversion')
      ),
      el(View, null,
        el(Text, { style: styles.meta }, 'Module: Sales & CPQ'),
        el(Text, { style: styles.meta }, 'Process Blueprint')
      )
    ),

    el(Text, { style: styles.sectionTitle }, '3. Commercial Process Flowchart'),

    el(View, { style: styles.cpqFlowContainer },
      // Step 1
      el(View, { style: [styles.cpqBox, styles.boxColorBlue] },
        el(Text, { style: styles.cpqBoxTitle }, '1. Lead Capture & Verification'),
        el(Text, { style: styles.cpqBoxDesc }, 'Lead enters the system. System checks for duplicate fields (GSTIN, Mobile, Email) and applies Auto-Territory Assignment based on address.')
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      // Step 2
      el(View, { style: [styles.cpqBox, styles.boxColorPurple] },
        el(Text, { style: styles.cpqBoxTitle }, '2. Deal Pipeline & Forecasting'),
        el(Text, { style: styles.cpqBoxDesc }, 'Opportunity is staged. Target tracking matches deals against monthly quotas. Activities are logged in a unified timeline.')
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      // Step 3
      el(View, { style: [styles.cpqBox, styles.boxColorAmber] },
        el(Text, { style: styles.cpqBoxTitle }, '3. CPQ Simulator & Configurator'),
        el(Text, { style: styles.cpqBoxDesc }, 'Rep uses Simulator to select items, custom modifiers, and apply promotions. System recalculates item base costs and tax GST rates dynamically.')
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      // Step 4
      el(View, { style: [styles.cpqBox, styles.boxColorGreen] },
        el(Text, { style: styles.cpqBoxTitle }, '4. Margin Protection Check'),
        el(Text, { style: styles.cpqBoxDesc }, 'Engine checks quote margin: If margin < 0%, quote is blocked. If margin < 10%, status is set to "Pending Approval". Otherwise set to "Draft".')
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      // Step 5
      el(View, { style: [styles.cpqBox, styles.boxColorCyan] },
        el(Text, { style: styles.cpqBoxTitle }, '5. Approvals & Price Lock'),
        el(Text, { style: styles.cpqBoxDesc }, 'Managers review overridden prices in queue. Approved quotes lock customer pricing under contract terms.')
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      // Step 6
      el(View, { style: [styles.cpqBox, styles.boxColorSlate] },
        el(Text, { style: styles.cpqBoxTitle }, '6. Order Conversion & Ledger'),
        el(Text, { style: styles.cpqBoxDesc }, 'Quote is converted to a Sales Order. Unique invoice series generated, and voucher details are pushed to audit logs.')
      )
    ),

    el(View, { style: styles.footer },
      el(Text, null, 'NeoComp Enterprise Suite - Core blueprint'),
      el(Text, null, 'Page 2 of 3')
    )
  ),

  // Page 3: Operations, CSM & Payroll
  el(Page, { size: 'A4', style: styles.page },
    el(View, { style: styles.headerContainer },
      el(View, null,
        el(Text, { style: styles.title }, 'Operations & Resource Management'),
        el(Text, { style: styles.subtitle }, 'Functional Descriptions: CSM, Payroll, and Revenue Planning')
      ),
      el(View, null,
        el(Text, { style: styles.meta }, 'Module: Operations'),
        el(Text, { style: styles.meta }, 'System Reference')
      )
    ),

    el(Text, { style: styles.sectionTitle }, '4. Support Services (CSM) Workflow'),
    el(View, { style: styles.gridContainer },
      el(View, { style: [styles.gridCard, { width: '100%' }] },
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '1.'),
          el(Text, { style: styles.cardText }, 'Ticket Intake: Cases logged with Priority (SLAs applied), linked Product, Serial No, and Invoice.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '2.'),
          el(Text, { style: styles.cardText }, 'Entitlement: Auto-verifies serial number coverage status (Active Warranty / AMC contract). Out-of-contract flagged.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '3.'),
          el(Text, { style: styles.cardText }, 'Service Visits: Dispatches field engineers. Check-In & Check-Out capture real-time timestamps and GPS coordinates.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '4.'),
          el(Text, { style: styles.cardText }, 'Resolution: Service Visit closures require diagnostic reports and sign-offs, updating the ticket state to Resolved.')
        )
      )
    ),

    el(Text, { style: styles.sectionTitle }, '5. Human Resources & Payroll Runs'),
    el(View, { style: styles.gridContainer },
      el(View, { style: styles.gridCard },
        el(Text, { style: styles.cardTitle }, 'Payroll Batches'),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Creates monthly runs based on company structure configuration.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Calculates base salary, allowances, tax deductions, and net pay.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Locked runs prompt payment updates and disburse employee payslips.')
        )
      ),
      el(View, { style: styles.gridCard },
        el(Text, { style: styles.cardTitle }, 'Letter Templates'),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Generates document letters directly from employee structures.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Supports Offer, Appointment, Promotion, and Relieving letter variations.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Audit logs record every letter generated with timestamps and admin user IDs.')
        )
      )
    ),

    el(Text, { style: styles.sectionTitle }, '6. Strategic Revenue Planning'),
    el(Text, { style: { fontSize: 8, color: '#475569', lineHeight: 1.3, marginBottom: 15 } },
      'Planning Screen Workspace: Provides planners with tools to formulate annual budgets. Planners can set company-wide targets, perform target simulations, and run reports categorized by SBU, market segments, or status breakdowns. Edit access controls allow changes to previous financial years to maintain historic planning registers.'
    ),

    el(View, { style: styles.footer },
      el(Text, null, 'NeoComp Enterprise Suite - Core blueprint'),
      el(Text, null, 'Page 3 of 3')
    )
  )
);

// Save file to filesystem
const outputPath = './System_Wide_Flowchart.pdf';
ReactPDF.render(el(SystemFlowchartPDF), outputPath)
  .then(() => console.log('Successfully generated System_Wide_Flowchart.pdf at ' + outputPath))
  .catch((err) => {
    console.error('Error generating PDF:', err);
    process.exit(1);
  });
