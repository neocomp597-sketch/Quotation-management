export const FLOWCHART_TEMPLATES = [
    {
        id: 'tmpl_approval',
        title: 'Discount & Quotation Approval Process',
        category: 'Sales & Finance',
        description: 'Standard multi-tier discount approval workflow for high-value sales quotations.',
        rawSteps: `Salesperson creates quotation
Check quotation total value
If total value > ₹10,00,000
Route to Regional Sales Manager approval
If Approved
Route to Finance Director for Margin Review
Else
Reject Quotation and request revise
Else
Auto-approve quotation
Generate PDF & send to Customer`,
        nodes: [
            { id: 'n1', type: 'start', label: 'Create Quotation', x: 500, y: 40, width: 170, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Sales rep enters items and pricing' } },
            { id: 'n2', type: 'decision', label: 'Value > ₹10,00,000?', x: 500, y: 140, width: 170, height: 90, style: { fill: '#f59e0b', color: '#fff' }, data: { description: 'Check discount threshold' } },
            { id: 'n3', type: 'process', label: 'RSM Approval Request', x: 280, y: 270, width: 170, height: 60, style: { fill: '#3b82f6', color: '#fff' }, data: { description: 'Manager reviews pricing structure' } },
            { id: 'n4', type: 'process', label: 'Auto-Approve Quote', x: 720, y: 270, width: 170, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Direct approval without escalation' } },
            { id: 'n5', type: 'decision', label: 'RSM Approved?', x: 280, y: 370, width: 160, height: 90, style: { fill: '#f59e0b', color: '#fff' }, data: { description: 'Manager decision' } },
            { id: 'n6', type: 'process', label: 'Finance Director Review', x: 180, y: 500, width: 170, height: 60, style: { fill: '#8b5cf6', color: '#fff' }, data: { description: 'Financial margin audit' } },
            { id: 'n7', type: 'process', label: 'Reject & Request Revision', x: 380, y: 500, width: 170, height: 60, style: { fill: '#ef4444', color: '#fff' }, data: { description: 'Return quote to draft' } },
            { id: 'n8', type: 'end', label: 'Send Quote PDF', x: 500, y: 620, width: 170, height: 60, style: { fill: '#06b6d4', color: '#fff' }, data: { description: 'Email customer PDF document' } }
        ],
        edges: [
            { id: 'e1', source: 'n1', target: 'n2', label: '' },
            { id: 'e2', source: 'n2', target: 'n3', label: 'If Yes' },
            { id: 'e3', source: 'n2', target: 'n4', label: 'If No' },
            { id: 'e4', source: 'n3', target: 'n5', label: '' },
            { id: 'e5', source: 'n5', target: 'n6', label: 'Yes' },
            { id: 'e6', source: 'n5', target: 'n7', label: 'No' },
            { id: 'e7', source: 'n4', target: 'n8', label: '' },
            { id: 'e8', source: 'n6', target: 'n8', label: '' }
        ]
    },
    {
        id: 'tmpl_complaint',
        title: 'Customer Support Complaint Resolution',
        category: 'Customer Service',
        description: 'End-to-end ticketing and warranty troubleshooting resolution workflow.',
        rawSteps: `Customer files support ticket
Verify Active Warranty or AMC
If Warranty Active
Assign Field Engineer visit
Perform On-site Repair & Component Testing
Else
Generate Paid Service Quotation
If Customer Accepts Paid Quote
Dispatch Engineer & Collect Payment
Else
Close Ticket as Declined
Close Ticket with Resolution Report`,
        nodes: [
            { id: 'n1', type: 'start', label: 'Ticket Logged', x: 500, y: 40, width: 170, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Support ticket registered in CRM' } },
            { id: 'n2', type: 'decision', label: 'Active Warranty / AMC?', x: 500, y: 140, width: 180, height: 90, style: { fill: '#f59e0b', color: '#fff' }, data: { description: 'Check contract database' } },
            { id: 'n3', type: 'process', label: 'Dispatch Field Engineer', x: 300, y: 270, width: 180, height: 60, style: { fill: '#3b82f6', color: '#fff' }, data: { description: 'Schedule engineer visit' } },
            { id: 'n4', type: 'input_output', label: 'Paid Quote Generated', x: 700, y: 270, width: 180, height: 60, style: { fill: '#8b5cf6', color: '#fff' }, data: { description: 'Estimate out-of-warranty charges' } },
            { id: 'n5', type: 'end', label: 'Close Ticket Resolved', x: 500, y: 450, width: 180, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Customer signoff' } }
        ],
        edges: [
            { id: 'e1', source: 'n1', target: 'n2', label: '' },
            { id: 'e2', source: 'n2', target: 'n3', label: 'Yes' },
            { id: 'e3', source: 'n2', target: 'n4', label: 'No' },
            { id: 'e4', source: 'n3', target: 'n5', label: 'Done' },
            { id: 'e5', source: 'n4', target: 'n5', label: 'Paid' }
        ]
    },
    {
        id: 'tmpl_sales_deal',
        title: 'Sales Pipeline & Deal Closure Flow',
        category: 'Sales Management',
        description: 'Standard B2B deal qualification, demo, proposal, and closure pipeline.',
        rawSteps: `Receive Lead
Qualify Lead Requirements & Budget
If Qualified
Schedule Product Demo
Present Technical Quotation & CPQ Config
If Deal Won
Convert to Sales Order & Contract
Else
Mark Deal Lost with Reason
Close Pipeline Stage`,
        nodes: [
            { id: 'n1', type: 'start', label: 'Lead Received', x: 500, y: 40, width: 160, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Inbound or outbound lead' } },
            { id: 'n2', type: 'decision', label: 'Lead Qualified?', x: 500, y: 140, width: 170, height: 90, style: { fill: '#f59e0b', color: '#fff' }, data: { description: 'BANT criteria check' } },
            { id: 'n3', type: 'process', label: 'Product Demo & Quote', x: 300, y: 270, width: 180, height: 60, style: { fill: '#3b82f6', color: '#fff' }, data: { description: 'Guided selling presentation' } },
            { id: 'n4', type: 'end', label: 'Sales Order & Contract', x: 300, y: 400, width: 180, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Deal Won' } },
            { id: 'n5', type: 'end', label: 'Archived / Lost', x: 700, y: 270, width: 160, height: 60, style: { fill: '#ef4444', color: '#fff' }, data: { description: 'Deal Lost' } }
        ],
        edges: [
            { id: 'e1', source: 'n1', target: 'n2', label: '' },
            { id: 'e2', source: 'n2', target: 'n3', label: 'Yes' },
            { id: 'e3', source: 'n2', target: 'n5', label: 'No' },
            { id: 'e4', source: 'n3', target: 'n4', label: 'Won' }
        ]
    },
    {
        id: 'tmpl_installation',
        title: 'Equipment Installation & Commissioning Process',
        category: 'Field Service',
        description: 'Site inspection, installation, commissioning, and client signoff procedure.',
        rawSteps: `Receive Installation Work Order
Site Readiness Pre-Inspection
If Site Ready
Ship Equipment & Tools
Perform Mechanical & Electrical Setup
Run Quality & Safety Test
If Test Passed
Collect Client Signoff Certificate
Else
Issue Punch List & Rectify Faults
Issue Warranty Certificate & Complete Order`,
        nodes: [
            { id: 'n1', type: 'start', label: 'Work Order Created', x: 500, y: 40, width: 180, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Order converted to installation task' } },
            { id: 'n2', type: 'decision', label: 'Site Ready?', x: 500, y: 140, width: 160, height: 90, style: { fill: '#f59e0b', color: '#fff' }, data: { description: 'Pre-check power, foundation, and safety' } },
            { id: 'n3', type: 'process', label: 'Ship Equipment & Tools', x: 300, y: 270, width: 180, height: 60, style: { fill: '#3b82f6', color: '#fff' }, data: { description: 'Logistics dispatch' } },
            { id: 'n4', type: 'process', label: 'Setup & Safety Testing', x: 300, y: 370, width: 180, height: 60, style: { fill: '#8b5cf6', color: '#fff' }, data: { description: 'Engineer assembly' } },
            { id: 'n5', type: 'decision', label: 'Test Passed?', x: 300, y: 470, width: 160, height: 90, style: { fill: '#f59e0b', color: '#fff' }, data: { description: 'Safety inspection' } },
            { id: 'n6', type: 'end', label: 'Client Signoff & Warranty', x: 300, y: 600, width: 190, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Final commissioning' } },
            { id: 'n7', type: 'process', label: 'Rectify Punch List', x: 540, y: 485, width: 170, height: 60, style: { fill: '#ef4444', color: '#fff' }, data: { description: 'Fix defects' } }
        ],
        edges: [
            { id: 'e1', source: 'n1', target: 'n2', label: '' },
            { id: 'e2', source: 'n2', target: 'n3', label: 'Yes' },
            { id: 'e3', source: 'n3', target: 'n4', label: '' },
            { id: 'e4', source: 'n4', target: 'n5', label: '' },
            { id: 'e5', source: 'n5', target: 'n6', label: 'Pass' },
            { id: 'e6', source: 'n5', target: 'n7', label: 'Fail' },
            { id: 'e7', source: 'n7', target: 'n4', label: 'Retest' }
        ]
    },
    {
        id: 'tmpl_amc_renewal',
        title: 'AMC Contract Renewal & Maintenance Flow',
        category: 'Customer Success',
        description: 'Proactive AMC expiration alert, audit, proposal submission, and contract renewal.',
        rawSteps: `AMC Expiration Alert (60 Days Prior)
Review Equipment Maintenance History
Generate AMC Renewal Proposal
Send Renewal Estimate to Client
If Client Approves
Receive Payment & Issue AMC Certificate
Else
Escalate to Account Manager for Special Discount
Close Renewal Task`,
        nodes: [
            { id: 'n1', type: 'start', label: 'AMC Alert (60 Days)', x: 500, y: 40, width: 180, height: 60, style: { fill: '#f59e0b', color: '#fff' }, data: { description: 'Automated contract expiration alert' } },
            { id: 'n2', type: 'process', label: 'Audit Maintenance Log', x: 500, y: 140, width: 180, height: 60, style: { fill: '#3b82f6', color: '#fff' }, data: { description: 'Check past service visits' } },
            { id: 'n3', type: 'input_output', label: 'Renewal Proposal Sent', x: 500, y: 240, width: 180, height: 60, style: { fill: '#06b6d4', color: '#fff' }, data: { description: 'Send proposal via email' } },
            { id: 'n4', type: 'decision', label: 'Client Approved?', x: 500, y: 340, width: 170, height: 90, style: { fill: '#f59e0b', color: '#fff' }, data: { description: 'Client decision' } },
            { id: 'n5', type: 'end', label: 'Issue AMC Contract', x: 300, y: 470, width: 180, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Active renewal' } },
            { id: 'n6', type: 'process', label: 'AM Negotiation & Discount', x: 700, y: 470, width: 190, height: 60, style: { fill: '#8b5cf6', color: '#fff' }, data: { description: 'Account manager outreach' } }
        ],
        edges: [
            { id: 'e1', source: 'n1', target: 'n2', label: '' },
            { id: 'e2', source: 'n2', target: 'n3', label: '' },
            { id: 'e3', source: 'n3', target: 'n4', label: '' },
            { id: 'e4', source: 'n4', target: 'n5', label: 'Yes' },
            { id: 'e5', source: 'n4', target: 'n6', label: 'No' }
        ]
    },
    {
        id: 'tmpl_credit_approval',
        title: 'Customer Credit Limit Approval Process',
        category: 'Finance & Risk',
        description: 'Risk assessment, financial background verification, and credit line allocation.',
        rawSteps: `Credit Limit Enhancement Request
Fetch Customer Payment & Invoice History
Calculate Risk Score
If Risk Score = Low
Auto-approve Credit Increase
If Risk Score = Medium
Require Financial Controller Approval
Else
Reject Request & Enforce Advance Payment`,
        nodes: [
            { id: 'n1', type: 'start', label: 'Credit Limit Request', x: 500, y: 40, width: 180, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Customer or sales request' } },
            { id: 'n2', type: 'database', label: 'Check Payment History', x: 500, y: 140, width: 180, height: 60, style: { fill: '#ec4899', color: '#fff' }, data: { description: 'Database credit check' } },
            { id: 'n3', type: 'decision', label: 'Risk Score Level?', x: 500, y: 240, width: 170, height: 90, style: { fill: '#f59e0b', color: '#fff' }, data: { description: 'Automated scoring' } },
            { id: 'n4', type: 'end', label: 'Auto-Approve Credit', x: 280, y: 370, width: 170, height: 60, style: { fill: '#10b981', color: '#fff' }, data: { description: 'Low Risk' } },
            { id: 'n5', type: 'process', label: 'Finance Controller Review', x: 500, y: 370, width: 180, height: 60, style: { fill: '#3b82f6', color: '#fff' }, data: { description: 'Medium Risk' } },
            { id: 'n6', type: 'end', label: 'Require Advance Payment', x: 720, y: 370, width: 180, height: 60, style: { fill: '#ef4444', color: '#fff' }, data: { description: 'High Risk' } }
        ],
        edges: [
            { id: 'e1', source: 'n1', target: 'n2', label: '' },
            { id: 'e2', source: 'n2', target: 'n3', label: '' },
            { id: 'e3', source: 'n3', target: 'n4', label: 'Low Risk' },
            { id: 'e4', source: 'n3', target: 'n5', label: 'Medium Risk' },
            { id: 'e5', source: 'n3', target: 'n6', label: 'High Risk' }
        ]
    }
];
