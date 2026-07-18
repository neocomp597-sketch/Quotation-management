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
    paddingBottom: 10,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  title: {
    fontSize: 18,
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
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
    backgroundColor: '#cbd5e1',
    padding: 6,
    borderRadius: 4,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  // Flowchart CSS-in-JS Mock
  flowContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 20
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginVertical: 4
  },
  flowBox: {
    width: 200,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: '#ffffff'
  },
  boxIntake: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  boxVerify: { borderColor: '#8b5cf6', backgroundColor: '#f5f3ff' },
  boxAssign: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  boxAction: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  boxResolve: { borderColor: '#06b6d4', backgroundColor: '#ecfeff' },
  boxClose: { borderColor: '#64748b', backgroundColor: '#f8fafc' },

  boxTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 3,
    textTransform: 'uppercase',
    textAlign: 'center'
  },
  boxDesc: {
    fontSize: 7.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 1.2
  },
  arrowDown: {
    fontSize: 14,
    color: '#64748b',
    marginVertical: 4,
    textAlign: 'center'
  },
  arrowRight: {
    fontSize: 14,
    color: '#64748b',
    marginHorizontal: 10
  },
  branchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    marginVertical: 4
  },
  branchLine: {
    height: 15,
    width: 1,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center'
  },
  branchBox: {
    width: 220,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#94a3b8',
    backgroundColor: '#f1f5f9'
  },
  
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8'
  },

  // Grid Info Sections
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10
  },
  cardTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 4,
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  cardItem: {
    flexDirection: 'row',
    marginBottom: 3,
    lineHeight: 1.3
  },
  cardBullet: {
    width: 10,
    fontWeight: 'bold',
    color: '#3b82f6'
  },
  cardText: {
    flex: 1,
    fontSize: 8,
    color: '#475569'
  }
});

const el = React.createElement;

const FlowchartPDF = () => el(Document, null,
  el(Page, { size: 'A4', style: styles.page },
    el(View, { style: styles.headerContainer },
      el(View, null,
        el(Text, { style: styles.title }, 'CSM & Support Ticket Workflow'),
        el(Text, { style: styles.subtitle }, 'Standard Operating Procedure & Ticket Lifecycle Flowchart')
      ),
      el(View, null,
        el(Text, { style: styles.meta }, 'Format: Reference Document'),
        el(Text, { style: styles.meta }, 'System: NeoComp CSM')
      )
    ),

    el(Text, { style: styles.sectionTitle }, '1. Ticket Lifecycle Flowchart'),

    el(View, { style: styles.flowContainer },
      el(View, { style: [styles.flowBox, styles.boxIntake] },
        el(Text, { style: styles.boxTitle }, '1. Case Intake & Submission'),
        el(Text, { style: styles.boxDesc }, 'Customer details, linked product, serial number, invoice & priority are populated. Ticket status set to "Open".')
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      el(View, { style: [styles.flowBox, styles.boxVerify] },
        el(Text, { style: styles.boxTitle }, '2. Entitlement Verification'),
        el(Text, { style: styles.boxDesc }, 'System checks Serial Number against active Warranties and AMC (Annual Maintenance Contracts).')
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      el(View, { style: styles.branchContainer },
        el(View, { style: styles.branchBox },
          el(Text, { style: [styles.boxTitle, { color: '#059669', fontSize: 8 }] }, 'Option A: Active Entitlement'),
          el(Text, { style: [styles.boxDesc, { fontSize: 7 }] }, 'Covered under warranty/contract. Priority and SLA automatically applied based on tier config.')
        ),
        el(View, { style: styles.branchBox },
          el(Text, { style: [styles.boxTitle, { color: '#dc2626', fontSize: 8 }] }, 'Option B: Expired / Out of AMC'),
          el(Text, { style: [styles.boxDesc, { fontSize: 7 }] }, 'Marked as Billable. Default/Medium priority applied. Invoice linkage recommended.')
        )
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      el(View, { style: [styles.flowBox, styles.boxAssign] },
        el(Text, { style: styles.boxTitle }, '3. Allocation & Assignment'),
        el(Text, { style: styles.boxDesc }, 'Manual assignment to Support Engineer or auto-routed. Ticket status changes to "Assigned".')
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      el(View, { style: [styles.flowBox, styles.boxAction] },
        el(Text, { style: styles.boxTitle }, '4. Investigation & Action (SLA Active)'),
        el(Text, { style: styles.boxDesc }, 'Status set to "In Progress". If complex, escalated ("Escalated"). If customer input needed, set to "Pending Customer" (pauses SLA).')
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      el(View, { style: [styles.flowBox, styles.boxResolve] },
        el(Text, { style: styles.boxTitle }, '5. Resolution & Verification'),
        el(Text, { style: styles.boxDesc }, 'Engineer resolves problem, log updates, status to "Resolved". Customer requested for confirmation and satisfaction feedback.')
      ),
      el(Text, { style: styles.arrowDown }, '↓'),

      el(View, { style: [styles.flowBox, styles.boxClose] },
        el(Text, { style: styles.boxTitle }, '6. Closure & Metric Logging'),
        el(Text, { style: styles.boxDesc }, 'Closed by system or agent. Feedback recorded. SLA performance, response/resolution times analyzed.')
      )
    ),

    el(View, { style: styles.footer },
      el(Text, null, 'NeoComp CSM Ticket System'),
      el(Text, null, 'Page 1 of 2')
    )
  ),

  el(Page, { size: 'A4', style: styles.page },
    el(View, { style: styles.headerContainer },
      el(View, null,
        el(Text, { style: styles.title }, 'CSM & Support Ticket Workflow'),
        el(Text, { style: styles.subtitle }, 'Feature Breakdown & Functional Descriptions')
      ),
      el(View, null,
        el(Text, { style: styles.meta }, 'Format: Reference Document'),
        el(Text, { style: styles.meta }, 'System: NeoComp CSM')
      )
    ),

    el(Text, { style: styles.sectionTitle }, '2. Key CSM Functional Modules'),

    el(View, { style: styles.gridContainer },
      el(View, { style: styles.gridCard },
        el(Text, { style: styles.cardTitle }, 'Tickets Management'),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Central repository for all support requests with automated, incremental Ticket IDs.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Rich comment threads to facilitate collaboration between customers, dispatchers, and engineers.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'SLA countdown timers showing remaining response and resolution times visually.')
        )
      ),

      el(View, { style: styles.gridCard },
        el(Text, { style: styles.cardTitle }, 'Service Visits'),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Dispatch engineers to customer premises directly from ticket details.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Geo-tagged Check-In and Check-Out (capturing GPS coordinates and timestamps).')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Service visit reports filled by engineers detailing work done, parts replaced, and customer signature.')
        )
      ),

      el(View, { style: styles.gridCard },
        el(Text, { style: styles.cardTitle }, 'Entitlements (Warranty & AMC)'),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Track AMC Contracts, warranty periods, start/expiry dates, and contract documents.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Auto-link tickets to valid warranties or active AMC contracts for the selected Product Serial Number.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Flags out-of-coverage assets to ensure appropriate billing prior to dispatch.')
        )
      ),

      el(View, { style: styles.gridCard },
        el(Text, { style: styles.cardTitle }, 'CSM Master Configuration'),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Priorities Master: Define SLA hours for response & resolution and color codes for each tier.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Categories & Ticket Types: Classify tickets (e.g., Installation, Repair, Inquiry) to structure routing.')
        ),
        el(View, { style: styles.cardItem },
          el(Text, { style: styles.cardBullet }, '•'),
          el(Text, { style: styles.cardText }, 'Sources & Designations: Track ticket source channels (e.g., Portal, Email) and contact designations.')
        )
      )
    ),

    el(Text, { style: styles.sectionTitle }, '3. Priority Configuration & SLAs'),
    el(Text, { style: { fontSize: 8, color: '#475569', lineHeight: 1.4, marginBottom: 15 } },
      'Tickets created in NeoComp CSM are bound by Service Level Agreement (SLA) policies configured in the Masters. When a ticket is raised, the system parses the selected Priority (e.g., High, Medium, Low) and applies its Response and Resolution SLA timers.\n\nIf a ticket status is changed to "Pending Customer", the SLA timer is paused to prevent unfair breaches due to customer delays. The timer resumes once the customer responds or when the ticket is set back to "In Progress".'
    ),

    el(View, { style: styles.footer },
      el(Text, null, 'NeoComp CSM Ticket System'),
      el(Text, null, 'Page 2 of 2')
    )
  )
);

// Save file to filesystem
const outputPath = './CSM_Ticket_Flowchart.pdf';
ReactPDF.render(el(FlowchartPDF), outputPath)
  .then(() => console.log('Successfully generated CSM_Ticket_Flowchart.pdf at ' + outputPath))
  .catch((err) => {
    console.error('Error generating PDF:', err);
    process.exit(1);
  });
