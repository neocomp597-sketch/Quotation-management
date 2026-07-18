const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Company = require('../models/Company');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const User = require('../models/User');
const TicketCategory = require('../models/TicketCategory');
const TicketType = require('../models/TicketType');
const Priority = require('../models/Priority');
const ServiceTeam = require('../models/ServiceTeam');
const Ticket = require('../models/Ticket');
const Warranty = require('../models/Warranty');
const AMC = require('../models/AMC');

async function run() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB.');

        // 1. Fetch Company
        const company = await Company.findOne({});
        if (!company) {
            console.error('No company found in database to link seeds');
            process.exit(1);
        }
        const companyId = company._id;
        console.log(`Using CompanyId: ${companyId}`);

        // 2. Fetch User/Engineer
        const user = await User.findOne({ companyId });
        if (!user) {
            console.error('No user found in database to assign tickets');
            process.exit(1);
        }
        const userId = user._id;

        // 3. Categories
        console.log('Seeding Categories...');
        const categories = [
            { name: 'Complaint', description: 'Customer grievance' },
            { name: 'Service Request', description: 'Installation request' },
            { name: 'Product Issue', description: 'Technical malfunction' },
            { name: 'Billing Query', description: 'Invoicing issues' }
        ];
        const categoryDocs = [];
        for (const cat of categories) {
            let doc = await TicketCategory.findOne({ name: cat.name, companyId });
            if (!doc) {
                doc = await TicketCategory.create({ ...cat, companyId });
            }
            categoryDocs.push(doc);
        }

        // 4. Types
        console.log('Seeding Types...');
        const types = [
            { name: 'Inbound Call', description: 'Phone call' },
            { name: 'WhatsApp', description: 'WhatsApp message' },
            { name: 'Customer Portal', description: 'Portal raised' }
        ];
        const typeDocs = [];
        for (const t of types) {
            let doc = await TicketType.findOne({ name: t.name, companyId });
            if (!doc) {
                doc = await TicketType.create({ ...t, companyId });
            }
            typeDocs.push(doc);
        }

        // 5. Priorities
        console.log('Seeding Priorities...');
        const priorities = [
            { name: 'Low', responseSlaHours: 24, resolutionSlaHours: 72, color: '#64748b' },
            { name: 'Medium', responseSlaHours: 8, resolutionSlaHours: 48, color: '#3b82f6' },
            { name: 'High', responseSlaHours: 4, resolutionSlaHours: 24, color: '#f59e0b' },
            { name: 'Critical', responseSlaHours: 1, resolutionSlaHours: 4, color: '#ef4444' }
        ];
        const priorityDocs = [];
        for (const prio of priorities) {
            let doc = await Priority.findOne({ name: prio.name, companyId });
            if (!doc) {
                doc = await Priority.create({ ...prio, companyId });
            }
            priorityDocs.push(doc);
        }

        // 6. Service Team
        console.log('Seeding Service Team...');
        let team = await ServiceTeam.findOne({ name: 'General Support Team', companyId });
        if (!team) {
            team = await ServiceTeam.create({
                name: 'General Support Team',
                description: 'Default support team',
                members: [userId],
                companyId
            });
        }

        // 7. Fetch or Create Customer
        console.log('Fetching/Creating Customer...');
        let customer = await Customer.findOne({ companyId });
        if (!customer) {
            customer = await Customer.create({
                customerName: 'Acme Test Customer',
                companyName: 'Acme Corp',
                email: 'customer@acme.com',
                mobile: '9876543210',
                companyId
            });
        }

        // 8. Fetch or Create Product
        console.log('Fetching/Creating Product...');
        let product = await Product.findOne({ companyId });
        if (!product) {
            product = await Product.create({
                productCode: 'PRD-001',
                productName: 'Heavy Duty Water Pump',
                hsnCode: '8413',
                gstPercentage: 18,
                basePrice: 15000,
                mrp: 18000,
                uom: 'NOS',
                companyId
            });
        }

        // 9. Warranties & AMCs
        console.log('Seeding Warranty & AMC...');
        await Warranty.deleteMany({ customerId: customer._id });
        const warranty = await Warranty.create({
            customerId: customer._id,
            productId: product._id,
            purchaseDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            expiryDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000), // 11 months from now
            serialNumber: 'SN-WPR-9921',
            status: 'Active',
            companyId
        });

        await AMC.deleteMany({ customerId: customer._id });
        const amc = await AMC.create({
            customerId: customer._id,
            contractNo: 'AMC-2026-8801',
            startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 355 * 24 * 60 * 60 * 1000),
            visitsAllowed: 4,
            visitsUsed: 1,
            amount: 5000,
            status: 'Active',
            companyId
        });

        // 10. Tickets
        console.log('Seeding Tickets...');
        await Ticket.deleteMany({ companyId });

        // Resolved Ticket (within SLA)
        const t1 = await Ticket.create({
            ticketNo: 'CSM-2026-0001',
            customerId: customer._id,
            contactName: 'John Smith',
            contactPhone: '9876543210',
            contactEmail: 'john@acme.com',
            productId: product._id,
            issueTitle: 'Installation assistance requested',
            description: 'Customer requests help setting up the pump wiring.',
            categoryId: categoryDocs[1]._id,
            typeId: typeDocs[0]._id,
            priorityId: priorityDocs[1]._id, // Medium
            source: 'Phone Call',
            status: 'Resolved',
            assignedTeamId: team._id,
            assignedEngineerId: userId,
            slaResponseDue: new Date(Date.now() - 2 * 60 * 60 * 1000),
            slaResolutionDue: new Date(Date.now() + 46 * 60 * 60 * 1000),
            firstResponseAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
            resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
            isSlaBreached: { response: false, resolution: false },
            feedback: { rating: 5, comment: 'Quick support!', submittedAt: new Date() },
            companyId
        });

        // Open Ticket (SLA Breached)
        const t2 = await Ticket.create({
            ticketNo: 'CSM-2026-0002',
            customerId: customer._id,
            contactName: 'Sarah Connor',
            contactPhone: '9998887770',
            issueTitle: 'Billing dispute on invoice',
            description: 'Double charge noticed on pump procurement.',
            categoryId: categoryDocs[3]._id,
            typeId: typeDocs[1]._id,
            priorityId: priorityDocs[2]._id, // High
            source: 'WhatsApp',
            status: 'Open',
            slaResponseDue: new Date(Date.now() - 5 * 60 * 60 * 1000), // Overdue response
            slaResolutionDue: new Date(Date.now() - 1 * 60 * 60 * 1000), // Overdue resolution
            isSlaBreached: { response: true, resolution: true },
            companyId
        });

        // In Progress Ticket
        const t3 = await Ticket.create({
            ticketNo: 'CSM-2026-0003',
            customerId: customer._id,
            contactName: 'Bruce Wayne',
            issueTitle: 'Leakage from outlet valve',
            description: 'Small hairline crack in pump outlet housing.',
            categoryId: categoryDocs[2]._id,
            typeId: typeDocs[2]._id,
            priorityId: priorityDocs[3]._id, // Critical
            source: 'Web Portal',
            status: 'In Progress',
            assignedTeamId: team._id,
            assignedEngineerId: userId,
            slaResponseDue: new Date(Date.now() + 30 * 60 * 1000),
            slaResolutionDue: new Date(Date.now() + 3 * 60 * 60 * 1000),
            firstResponseAt: new Date(Date.now() - 10 * 60 * 1000),
            companyId
        });

        console.log('Seeded database successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error during seeding:', err);
        process.exit(1);
    }
}
run();
