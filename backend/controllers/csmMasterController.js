const TicketCategory = require('../models/TicketCategory');
const TicketType = require('../models/TicketType');
const Priority = require('../models/Priority');
const SlaPolicy = require('../models/SlaPolicy');
const ServiceTeam = require('../models/ServiceTeam');
const TicketSource = require('../models/TicketSource');
const Designation = require('../models/Designation');
const Engineer = require('../models/Engineer');

// Seed default master configurations
exports.seedDefaults = async (req, res) => {
    try {
        const companyId = req.user?.companyId;

        // 1. Categories
        const categories = [
            { name: 'Complaint', description: 'Customer grievance or issue report' },
            { name: 'Service Request', description: 'Request for installation, demonstration, or maintenance' },
            { name: 'Product Issue', description: 'Technical malfunction of a product' },
            { name: 'Billing Query', description: 'Queries related to invoices, payments, or discounts' },
            { name: 'Technical Support', description: 'Hardware or software troubleshooting' },
            { name: 'Warranty Claim', description: 'Defect claims under valid warranty period' }
        ];
        for (const cat of categories) {
            const exists = await TicketCategory.findOne({ name: cat.name, companyId });
            if (!exists) {
                await TicketCategory.create({ ...cat, companyId });
            }
        }

        // 2. Types
        const types = [
            { name: 'Inbound Call', description: 'Ticket created via telephone support call' },
            { name: 'Email', description: 'Ticket parsed from support email mailbox' },
            { name: 'WhatsApp', description: 'Ticket raised via whatsapp conversation' },
            { name: 'Customer Portal', description: 'Ticket self-registered via portal' },
            { name: 'Field Service', description: 'Logged directly by engineers on-site' }
        ];
        for (const t of types) {
            const exists = await TicketType.findOne({ name: t.name, companyId });
            if (!exists) {
                await TicketType.create({ ...t, companyId });
            }
        }

        // 3. Priorities
        const priorities = [
            { name: 'Low', responseSlaHours: 24, resolutionSlaHours: 72, color: '#64748b' },
            { name: 'Medium', responseSlaHours: 8, resolutionSlaHours: 48, color: '#3b82f6' },
            { name: 'High', responseSlaHours: 4, resolutionSlaHours: 24, color: '#f59e0b' },
            { name: 'Critical', responseSlaHours: 1, resolutionSlaHours: 4, color: '#ef4444' }
        ];
        for (const prio of priorities) {
            const exists = await Priority.findOne({ name: prio.name, companyId });
            if (!exists) {
                await Priority.create({ ...prio, companyId });
            }
        }

        // 4. Default Service Team
        const defaultTeam = {
            name: 'General Support Team',
            description: 'Default team handling generic inbound queries',
            members: []
        };
        const teamExists = await ServiceTeam.findOne({ name: defaultTeam.name, companyId });
        if (!teamExists) {
            await ServiceTeam.create({ ...defaultTeam, companyId });
        }

        // 5. Default Sources
        const defaultSources = [
            { name: 'Web Portal' },
            { name: 'Email' },
            { name: 'WhatsApp' },
            { name: 'Mobile App' },
            { name: 'Phone Call' },
            { name: 'Sales Team' },
            { name: 'Service Engineer' }
        ];
        for (const src of defaultSources) {
            const exists = await TicketSource.findOne({ name: src.name, companyId });
            if (!exists) {
                await TicketSource.create({ ...src, companyId });
            }
        }

        // 6. Customer contact designations
        const defaultDesignations = [
            { name: 'Executive Engineer', description: 'Senior engineering contact at customer site' },
            { name: 'Assistant Engineer', description: 'Assistant engineering contact at customer site' },
            { name: 'Junior Engineer', description: 'Junior engineering contact at customer site' },
            { name: 'Substation Operator', description: 'Operations contact for substation equipment' },
            { name: 'Maintenance Engineer', description: 'Maintenance and breakdown support contact' },
            { name: 'Supervisor', description: 'Site supervision contact' }
        ];
        for (const des of defaultDesignations) {
            const exists = await Designation.findOne({ name: des.name, companyId });
            if (!exists) {
                await Designation.create({ ...des, companyId });
            }
        }

        res.json({ message: 'CSM defaults seeded successfully' });
    } catch (error) {
        console.error('Seed CSM defaults error:', error);
        res.status(500).json({ message: error.message || 'Error seeding CSM defaults' });
    }
};

exports.seedMhData = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.body?.companyId || req.query?.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'No companyId found in tenant context' });
        }

        const Customer = require('../models/Customer');
        const Product = require('../models/Product');
        const User = require('../models/User');
        const Ticket = require('../models/Ticket');
        const ServiceVisit = require('../models/ServiceVisit');
        const Asset = require('../models/Asset');
        const Warranty = require('../models/Warranty');
        const AMC = require('../models/AMC');
        const CustomerContact = require('../models/CustomerContact');

        // 1. Ensure categories exist
        const categoriesData = [
            { name: 'Substation Fault', description: 'Transformer, breaker, or switchgear failure' },
            { name: 'Line Maintenance', description: 'Overhead distribution/transmission lines' },
            { name: 'Relay Protection Query', description: 'Troubleshooting protection trip logic' },
            { name: 'Transformer Oil Check', description: 'Oil leakage, breakdown voltage (BDV) tests' },
            { name: 'Billing & AMC Query', description: 'Queries related to service pricing/contracts' }
        ];
        const categories = [];
        for (const cat of categoriesData) {
            let dbCat = await TicketCategory.findOne({ name: cat.name, companyId });
            if (!dbCat) {
                dbCat = await TicketCategory.create({ ...cat, companyId });
            }
            categories.push(dbCat);
        }

        // 2. Ensure types exist
        const typesData = [
            { name: 'Utility Portal', description: 'Reported directly through the web portal' },
            { name: 'Inbound Call', description: 'Urgent issues logged over phone call' },
            { name: 'WhatsApp Bot', description: 'Logged via WhatsApp channel' },
            { name: 'Field Report', description: 'Raised directly by engineers on-site' }
        ];
        const types = [];
        for (const t of typesData) {
            let dbType = await TicketType.findOne({ name: t.name, companyId });
            if (!dbType) {
                dbType = await TicketType.create({ ...t, companyId });
            }
            types.push(dbType);
        }

        // 3. Ensure priorities exist
        const prioritiesData = [
            { name: 'Low', responseSlaHours: 24, resolutionSlaHours: 72, color: '#64748b' },
            { name: 'Medium', responseSlaHours: 8, resolutionSlaHours: 48, color: '#3b82f6' },
            { name: 'High', responseSlaHours: 4, resolutionSlaHours: 24, color: '#f59e0b' },
            { name: 'Critical', responseSlaHours: 1, resolutionSlaHours: 4, color: '#ef4444' }
        ];
        const priorities = [];
        for (const p of prioritiesData) {
            let dbPrio = await Priority.findOne({ name: p.name, companyId });
            if (!dbPrio) {
                dbPrio = await Priority.create({ ...p, companyId });
            }
            priorities.push(dbPrio);
        }

        // 4. Ensure service teams exist
        const defaultTeam = {
            name: 'MH Substation Support Group',
            description: 'Handles high-voltage electrical installations and substations'
        };
        let dbTeam = await ServiceTeam.findOne({ name: defaultTeam.name, companyId });
        if (!dbTeam) {
            dbTeam = await ServiceTeam.create({ ...defaultTeam, companyId });
        }

        // 5. Ensure realistic products exist
        const productsData = [
            { productName: '11KV SF6 RMU Switchgear', productCode: 'VCB-11KV', hsnCode: '85372000', gstPercentage: 18, basePrice: 450000, mrp: 600000, uom: 'Nos' },
            { productName: '33KV Current Transformer', productCode: 'CT-33KV', hsnCode: '85043100', gstPercentage: 18, basePrice: 85000, mrp: 120000, uom: 'Nos' },
            { productName: 'Numerical Protection Relay', productCode: 'RELAY-NUM', hsnCode: '85364900', gstPercentage: 18, basePrice: 35000, mrp: 55000, uom: 'Nos' },
            { productName: '10MVA Power Transformer', productCode: 'TRANS-10MVA', hsnCode: '85042300', gstPercentage: 18, basePrice: 3200000, mrp: 4000000, uom: 'Nos' }
        ];
        const products = [];
        for (const p of productsData) {
            let dbProd = await Product.findOne({ productCode: p.productCode, companyId });
            if (!dbProd) {
                dbProd = await Product.create({ ...p, companyId });
            }
            products.push(dbProd);
        }

        // 6. Ensure realistic customers exist (Maharashtra utility locations)
        const customersData = [
            { customerName: 'MSETCL Karjat Substation', companyName: 'Maharashtra State Electricity Transmission Co. Ltd - Karjat', gstin: '27AAACM1234A1Z0', billingAddress: { line1: 'MSETCL Karjat Substation, Chowk Road', city: 'Karjat', state: 'Maharashtra', pincode: '410101' } },
            { customerName: 'MSETCL Vikharan Substation', companyName: 'Maharashtra State Electricity Transmission Co. Ltd - Vikharan', gstin: '27AAACM1234A2Z0', billingAddress: { line1: 'MSETCL 220KV Substation, Shirpur Highway', city: 'Vikharan', state: 'Maharashtra', pincode: '425405' } },
            { customerName: 'MSEDCL Pimpalgaon Division', companyName: 'Maharashtra State Electricity Distribution Co. Ltd - Pimpalgaon', gstin: '27AAACM1234A3Z0', billingAddress: { line1: 'MSEDCL Sub-Division Office', city: 'Pimpalgaon', state: 'Maharashtra', pincode: '422209' } },
            { customerName: 'Adani Electricity Thane Central', companyName: 'Adani Electricity Ltd - Thane Division (MH)', gstin: '27AAACA5678B1Z1', billingAddress: { line1: 'Kolshet Road, Majiwada', city: 'Thane', state: 'Maharashtra', pincode: '400607' } },
            { customerName: 'Tata Power Trombay Station', companyName: 'Tata Power Ltd - Trombay Station (MH)', gstin: '27AAACT9012C1Z2', billingAddress: { line1: 'Tata Power Generating Plant, Trombay', city: 'Mumbai', state: 'Maharashtra', pincode: '400074' } }
        ];
        const customers = [];
        for (const c of customersData) {
            let dbCust = await Customer.findOne({ customerName: c.customerName, companyId });
            if (!dbCust) {
                dbCust = await Customer.create({ ...c, companyId });
            }
            customers.push(dbCust);
        }

        const designationNames = [
            'Executive Engineer',
            'Assistant Engineer',
            'Junior Engineer',
            'Substation Operator',
            'Maintenance Engineer',
            'Supervisor'
        ];
        const designationMap = {};
        for (const name of designationNames) {
            let designation = await Designation.findOne({ name, companyId });
            if (!designation) {
                designation = await Designation.create({ name, companyId });
            }
            designationMap[name] = designation;
        }

        const pimpalgaon = customers.find(c => c.customerName === 'MSEDCL Pimpalgaon Division');
        if (pimpalgaon) {
            const contactsData = [
                { contactName: 'Ramesh Patil', designation: 'Junior Engineer', mobileNo: '98XXXXXX21', email: 'ramesh.patil@mahadiscom.in', isPrimary: true },
                { contactName: 'Suresh Jadhav', designation: 'Assistant Engineer', mobileNo: '98XXXXXX22', email: 'suresh.jadhav@mahadiscom.in' },
                { contactName: 'Mahesh Gaikwad', designation: 'Substation Operator', mobileNo: '98XXXXXX23', email: 'mahesh.g@mahadiscom.in' },
                { contactName: 'Vikrant Deshmukh', designation: 'Executive Engineer', mobileNo: '98XXXXXX24', email: 'vikrant.d@mahadiscom.in' }
            ];

            for (const contact of contactsData) {
                const exists = await CustomerContact.findOne({
                    customerId: pimpalgaon._id,
                    contactName: contact.contactName,
                    companyId
                });
                if (!exists) {
                    await CustomerContact.create({
                        customerId: pimpalgaon._id,
                        contactName: contact.contactName,
                        designationId: designationMap[contact.designation]?._id,
                        mobileNo: contact.mobileNo,
                        email: contact.email,
                        isPrimary: Boolean(contact.isPrimary),
                        companyId
                    });
                }
            }
        }

        // 7. Ensure MH territory exists for assignment
        const Territory = require('../models/Territory');
        const stateTerritory = await Territory.findOneAndUpdate(
            { name: 'Maharashtra Zone', companyId },
            { 
                name: 'Maharashtra Zone', 
                type: 'zone',
                rules: { pincodes: ['410101', '425405', '422209', '400607', '400074'] } 
            },
            { upsert: true, new: true }
        );

        // 8. Ensure service engineers exist in Engineer Master and Employee profiles
        const EmployeeProfile = require('../models/EmployeeProfile');
        const engineersData = [
            { name: 'Rahul Patil', email: 'rahul.patil@jagjeet.com', mobile: '9823012345', pincodes: ['422209', '400607'], territoryId: stateTerritory._id },
            { name: 'Vikram Deshmukh', email: 'vikram.deshmukh@jagjeet.com', mobile: '9823012346', pincodes: ['410101', '400074'], territoryId: stateTerritory._id },
            { name: 'Amit Shinde', email: 'amit.shinde@jagjeet.com', mobile: '9823012347', pincodes: ['425405'], territoryId: stateTerritory._id }
        ];
        
        // Clear existing engineers first to avoid duplicates
        await Engineer.deleteMany({ companyId });
        
        const engineers = [];
        for (const eng of engineersData) {
            // Find or create matching employee profile
            let employee = await EmployeeProfile.findOne({ email: eng.email, companyId });
            if (!employee) {
                employee = await EmployeeProfile.create({
                    name: eng.name,
                    email: eng.email,
                    mobile: eng.mobile,
                    joiningDate: new Date(),
                    department: 'Service',
                    designation: 'Service Engineer',
                    status: 'Active',
                    companyId
                });
            }

            let dbEng = await Engineer.create({
                employeeId: employee._id,
                name: eng.name,
                email: eng.email,
                mobile: eng.mobile,
                status: 'Active',
                territoryId: eng.territoryId,
                pincodes: eng.pincodes,
                companyId
            });
            engineers.push(dbEng);
        }

        // Clear existing tickets, service visits, assets, warranties, and AMCs for this company
        await Ticket.deleteMany({ companyId });
        await ServiceVisit.deleteMany({ companyId });
        await Asset.deleteMany({ companyId });
        await Warranty.deleteMany({ companyId });
        await AMC.deleteMany({ companyId });

        // Helper date ranges
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

        // 8. Seed Assets
        const asset1 = await Asset.create({ customerId: customers[0]._id, productId: products[3]._id, serialNumber: 'TR-10MVA-90021', location: 'Bay-4 Outgoing Yard', companyId });
        const asset2 = await Asset.create({ customerId: customers[3]._id, productId: products[0]._id, serialNumber: 'SW-11KV-RMU-0112', location: 'Switchgear Room A', companyId });
        const asset3 = await Asset.create({ customerId: customers[2]._id, productId: products[3]._id, serialNumber: 'TR-10MVA-80839', location: 'Main Substation Yard', companyId });
        const asset4 = await Asset.create({ customerId: customers[1]._id, productId: products[2]._id, serialNumber: 'RY-NUM-504932', location: 'Control & Relay Panel 2', companyId });

        // 9. Seed Warranties & AMCs
        await Warranty.create({ customerId: customers[0]._id, productId: products[3]._id, assetId: asset1._id, purchaseDate: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()), expiryDate: new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()), serialNumber: 'TR-10MVA-90021', status: 'Active', companyId });
        await Warranty.create({ customerId: customers[3]._id, productId: products[0]._id, assetId: asset2._id, purchaseDate: new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()), expiryDate: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()), serialNumber: 'SW-11KV-RMU-0112', status: 'Active', companyId });
        
        await AMC.create({ customerId: customers[2]._id, contractNo: 'AMC-MSEDCL-2026-01', startDate: new Date(now.getFullYear() - 1, 0, 1), endDate: new Date(now.getFullYear(), 0, 1), visitsAllowed: 4, visitsUsed: 4, amount: 150000, status: 'Expired', companyId });
        const activeAmc = await AMC.create({ customerId: customers[1]._id, contractNo: 'AMC-MSETCL-2026-05', startDate: new Date(now.getFullYear(), now.getMonth() - 2, 1), endDate: new Date(now.getFullYear() + 1, now.getMonth() - 2, 1), visitsAllowed: 4, visitsUsed: 1, amount: 120000, status: 'Active', companyId });

        // 10. Seed Tickets
        // Ticket 1: Open, Critical, Substation Fault, MSETCL Karjat, Gas low
        const ticket1 = await Ticket.create({
            ticketNo: 'TIC-MH-1001',
            customerId: customers[0]._id,
            contactName: 'S. K. Kulkarni (EE)',
            contactPhone: '9823011223',
            contactEmail: 'sk.kulkarni@msetcl.in',
            productId: products[0]._id,
            assetId: asset1._id,
            issueTitle: 'SF6 Gas Pressure Low in 11KV Panel',
            description: 'Breaker lock-out signal is flashing on the main control panel. Need engineer to check for leakages and top up SF6 gas.',
            categoryId: categories[0]._id,
            typeId: types[0]._id,
            priorityId: priorities[3]._id, // Critical
            source: 'Web Portal',
            status: 'Open',
            assignedTeamId: dbTeam._id,
            assignedEngineerId: engineers[1]._id, // Vikram
            slaResponseDue: new Date(now.getTime() + 1 * 60 * 60 * 1000), // 1 hour
            slaResolutionDue: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4 hours
            timeline: [
                { activityType: 'Ticket Created', description: 'Ticket successfully registered via utility portal API.', createdAt: new Date(now.getTime() - 20 * 60 * 1000) }
            ],
            companyId
        });

        // Ticket 2: Escalated, High, Transformer Oil, MSEDCL Pimpalgaon (Breached SLA)
        const ticket2 = await Ticket.create({
            ticketNo: 'TIC-MH-1002',
            customerId: customers[2]._id,
            contactName: 'N. R. Deshmukh (AE)',
            contactPhone: '9845012345',
            contactEmail: 'nr.deshmukh@msedcl.in',
            productId: products[3]._id,
            assetId: asset3._id,
            issueTitle: 'Transformer Oil Seepage from Conservator Tank',
            description: 'Gasket appears to be worn out. Oil levels have dropped below standard mark. Critical to prevent winding overheat.',
            categoryId: categories[3]._id, // Transformer Oil Check
            typeId: types[1]._id, // Inbound Call
            priorityId: priorities[2]._id, // High
            source: 'Phone Call',
            status: 'Escalated',
            assignedTeamId: dbTeam._id,
            assignedEngineerId: engineers[0]._id, // Rahul
            slaResponseDue: new Date(now.getTime() - 48 * 60 * 60 * 1000),
            slaResolutionDue: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Past due (breached)
            isSlaBreached: { response: true, resolution: true },
            timeline: [
                { activityType: 'Ticket Created', description: 'Registered over call from site office.', createdAt: new Date(now.getTime() - 50 * 60 * 60 * 1000) },
                { activityType: 'Engineer Assigned', description: 'Assigned to Rahul Patil for site inspection.', performedBy: engineers[0]._id, createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000) }
            ],
            companyId
        });

        // Ticket 3: Resolved (Today), Critical, Relay, MSETCL Vikharan (Within SLA)
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const ticket3 = await Ticket.create({
            ticketNo: 'TIC-MH-1003',
            customerId: customers[1]._id,
            contactName: 'V. B. Patil (Substation Head)',
            contactPhone: '9890123456',
            contactEmail: 'vb.patil@msetcl.in',
            productId: products[2]._id,
            assetId: asset4._id,
            issueTitle: 'Relay trip on Earth Fault (33KV Line)',
            description: 'Feeder tripped twice on transient fault. Relay logic lock-out needs resetting and diagnostic log extraction.',
            categoryId: categories[2]._id, // Relay Protection
            typeId: types[2]._id, // WhatsApp
            priorityId: priorities[3]._id, // Critical
            source: 'WhatsApp',
            status: 'Resolved',
            assignedTeamId: dbTeam._id,
            assignedEngineerId: engineers[2]._id, // Amit Shinde
            slaResponseDue: new Date(yesterday.getTime() + 1 * 60 * 60 * 1000),
            slaResolutionDue: new Date(yesterday.getTime() + 4 * 60 * 60 * 1000),
            firstResponseAt: new Date(yesterday.getTime() + 15 * 60 * 1000),
            resolvedAt: new Date(startOfToday.getTime() + 2 * 60 * 60 * 1000), // Resolved today
            isSlaBreached: { response: false, resolution: false },
            isFirstCallResolved: true,
            timeline: [
                { activityType: 'Ticket Created', description: 'Registered via WhatsApp bot.', createdAt: yesterday },
                { activityType: 'Engineer Assigned', description: 'Assigned to Amit Shinde.', createdAt: new Date(yesterday.getTime() + 10 * 60 * 1000) },
                { activityType: 'Resolved', description: 'Relay logs cleared, feeder charged back.', performedBy: engineers[2]._id, createdAt: new Date(startOfToday.getTime() + 2 * 60 * 60 * 1000) }
            ],
            feedback: {
                rating: 5,
                comment: 'Superb turnaround. Responded within minutes on WhatsApp and solved on-site today morning.',
                submittedAt: new Date(startOfToday.getTime() + 3 * 60 * 60 * 1000)
            },
            companyId
        });

        // Ticket 4: In Progress, Medium, Transformer Check, Tata Power Trombay
        const ticket4 = await Ticket.create({
            ticketNo: 'TIC-MH-1004',
            customerId: customers[4]._id,
            contactName: 'A. M. Sen',
            contactPhone: '9820011223',
            contactEmail: 'am.sen@tatapower.com',
            productId: products[3]._id,
            issueTitle: 'Annual Oil Filtration & BDV Testing',
            description: 'Request for scheduling annual preventive oil check. BDV test kits should be brought by the engineer.',
            categoryId: categories[3]._id, // Transformer check
            typeId: types[3]._id, // Email
            priorityId: priorities[1]._id, // Medium
            source: 'Email',
            status: 'In Progress',
            assignedTeamId: dbTeam._id,
            assignedEngineerId: engineers[1]._id, // Vikram
            slaResponseDue: new Date(now.getTime() + 8 * 60 * 60 * 1000),
            slaResolutionDue: new Date(now.getTime() + 48 * 60 * 60 * 1000),
            firstResponseAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            timeline: [
                { activityType: 'Ticket Created', description: 'Logged from customer email query.', createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000) },
                { activityType: 'Visit Started', description: 'Engineer Vikram Deshmukh has started transit to Trombay.', createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000) }
            ],
            companyId
        });

        // Ticket 5: Pending Customer, Low, Substation Fault, Adani Thane
        const ticket5 = await Ticket.create({
            ticketNo: 'TIC-MH-1005',
            customerId: customers[3]._id,
            contactName: 'J. P. Dastur',
            contactPhone: '9819123456',
            contactEmail: 'jp.dastur@adani.com',
            productId: products[0]._id,
            issueTitle: '11KV Panel Cable Sizing & Terminal Query',
            description: 'Requesting confirmation on whether 3C x 300 sqmm XLPE cable terminal boots fit in standard gland box.',
            categoryId: categories[0]._id,
            typeId: types[0]._id,
            priorityId: priorities[0]._id, // Low
            source: 'Web Portal',
            status: 'Pending Customer',
            assignedTeamId: dbTeam._id,
            assignedEngineerId: engineers[0]._id, // Rahul
            slaResponseDue: new Date(now.getTime() + 12 * 60 * 60 * 1000),
            slaResolutionDue: new Date(now.getTime() + 60 * 60 * 60 * 1000),
            firstResponseAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
            timeline: [
                { activityType: 'Ticket Created', description: 'Created.', createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000) },
                { activityType: 'Awaiting Info', description: 'Rahul Patil asked customer to upload drawing of cable terminal lugs.', performedBy: engineers[0]._id, createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000) }
            ],
            companyId
        });

        // Ticket 6: Resolved, Low, Billing & AMC Query, Adani Thane (Within SLA)
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const ticket6 = await Ticket.create({
            ticketNo: 'TIC-MH-1006',
            customerId: customers[3]._id,
            contactName: 'Finance Desk',
            contactPhone: '9819112233',
            issueTitle: 'AMC Q1 Invoice Correction Request',
            description: 'GST percentage was computed at 28% instead of 18% for AMC services. Need revised voucher.',
            categoryId: categories[4]._id, // Billing & AMC
            typeId: types[1]._id,
            priorityId: priorities[0]._id, // Low
            source: 'Phone Call',
            status: 'Resolved',
            firstResponseAt: new Date(threeDaysAgo.getTime() + 2 * 60 * 60 * 1000),
            resolvedAt: new Date(threeDaysAgo.getTime() + 18 * 60 * 60 * 1000),
            isSlaBreached: { response: false, resolution: false },
            isFirstCallResolved: false,
            timeline: [
                { activityType: 'Ticket Created', description: 'Created.', createdAt: threeDaysAgo },
                { activityType: 'Resolved', description: 'Revised invoice sent over email.', createdAt: new Date(threeDaysAgo.getTime() + 18 * 60 * 60 * 1000) }
            ],
            feedback: {
                rating: 4,
                comment: 'Revised invoice received promptly. Accounting settled.',
                submittedAt: new Date(threeDaysAgo.getTime() + 20 * 60 * 60 * 1000)
            },
            companyId
        });

        // Ticket 7: Closed, High, Relay Protection, MSETCL Vikharan (Within SLA)
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        await Ticket.create({
            ticketNo: 'TIC-MH-1007',
            customerId: customers[1]._id,
            contactName: 'Patil G.',
            contactPhone: '9922001122',
            productId: products[2]._id,
            issueTitle: 'Commissioning of Numerical protections',
            description: 'Testing relay settings, CT secondary wire test, injection testing of protection system.',
            categoryId: categories[2]._id,
            typeId: types[3]._id,
            priorityId: priorities[2]._id, // High
            source: 'Service Engineer',
            status: 'Closed',
            assignedTeamId: dbTeam._id,
            assignedEngineerId: engineers[2]._id, // Amit
            firstResponseAt: new Date(fiveDaysAgo.getTime() + 30 * 60 * 1000),
            resolvedAt: new Date(fiveDaysAgo.getTime() + 8 * 60 * 60 * 1000),
            closedAt: new Date(fiveDaysAgo.getTime() + 9 * 60 * 60 * 1000),
            isSlaBreached: { response: false, resolution: false },
            isFirstCallResolved: true,
            timeline: [
                { activityType: 'Ticket Created', description: 'Created.', createdAt: fiveDaysAgo },
                { activityType: 'Closed', description: 'Feeder charged. Relay functioning normal.', performedBy: engineers[2]._id, createdAt: new Date(fiveDaysAgo.getTime() + 9 * 60 * 60 * 1000) }
            ],
            feedback: {
                rating: 5,
                comment: 'Injection tests carried out perfectly.',
                submittedAt: new Date(fiveDaysAgo.getTime() + 10 * 60 * 60 * 1000)
            },
            companyId
        });

        // 11. Seed Service Visits
        // Visit 1: Completed, Amit Shinde, Ticket 3 (Relay Trip)
        await ServiceVisit.create({
            visitNo: 'VIS-MH-8001',
            ticketId: ticket3._id,
            engineerId: engineers[2]._id, // Amit
            scheduledDate: yesterday,
            status: 'Completed',
            checkIn: {
                time: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000),
                location: { lat: 21.0573, lng: 74.8392, address: 'MSETCL Vikharan Substation, Dhule, Maharashtra' }
            },
            checkOut: {
                time: new Date(yesterday.getTime() + 5 * 60 * 60 * 1000),
                location: { lat: 21.0574, lng: 74.8394, address: 'MSETCL Vikharan Substation, Dhule, Maharashtra' }
            },
            visitReport: 'Relay event log downloaded. Tripped on phase fault due to tree branch touching overhead line. Reset locking code, cleared trip indicator flags. Tested earth leakage pickup. All normal.',
            billingStatus: 'Under AMC',
            expenses: [
                { description: 'Local travel fuel toll', amount: 850 }
            ],
            companyId
        });

        // Visit 2: Started, Vikram, Ticket 4 (Trombay Maintenance)
        await ServiceVisit.create({
            visitNo: 'VIS-MH-8002',
            ticketId: ticket4._id,
            engineerId: engineers[1]._id, // Vikram
            scheduledDate: now,
            status: 'Started',
            checkIn: {
                time: new Date(now.getTime() - 1 * 60 * 60 * 1000),
                location: { lat: 19.0022, lng: 72.8993, address: 'Tata Power Trombay Station, Chembur, Mumbai, Maharashtra' }
            },
            visitReport: 'Oil filtration machines connected. Winding insulation IR resistance values measured and documented.',
            billingStatus: 'Under Warranty',
            companyId
        });

        // Visit 3: Scheduled, Vikram, Ticket 1 (SF6 Gas Leakage)
        await ServiceVisit.create({
            visitNo: 'VIS-MH-8003',
            ticketId: ticket1._id,
            engineerId: engineers[1]._id, // Vikram
            scheduledDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
            status: 'Scheduled',
            billingStatus: 'Under Warranty',
            companyId
        });

        res.json({ message: 'Maharashtra utility electrical installations data seeded successfully' });
    } catch (error) {
        console.error('Seed MH CSM data error:', error);
        res.status(500).json({ message: error.message || 'Error seeding Maharashtra utility electrical installations data' });
    }
};

exports.seedKbData = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'No companyId found in context' });
        }

        const KnowledgeBase = require('../models/KnowledgeBase');

        // Delete existing KB articles for this company to make it clean
        await KnowledgeBase.deleteMany({ companyId });

        const articles = [
            {
                title: 'How to reset low SF6 gas lockout on 11KV RMU Switchgear',
                category: 'Troubleshooting',
                content: `1. Verify the current SF6 gas pressure reading on the analog dial. Standard operating pressure is 1.2 to 1.5 bar (green zone).
2. If pressure is below 1.1 bar, a critical lockout alarm is triggered. Clear all active faults on the Numerical Relay first.
3. Do not attempt to force close the breaker if the lockout contact is engaged.
4. Connect the SF6 refill cylinder to the gas valve at the rear panel.
5. Slowly open the regulator and charge to 1.3 bar. The alarm contact will reset automatically once pressure crosses 1.2 bar.
6. Confirm with the Control Room that the supervisory lockout signal is cleared before charging the feeder.`,
                views: 42,
                companyId,
                createdBy: req.user?.id
            },
            {
                title: 'Annual transformer oil BDV (Breakdown Voltage) test procedure',
                category: 'Troubleshooting',
                content: `1. Take a 500ml oil sample from the bottom sampling valve of the transformer tank. Use a dry, clean glass bottle.
2. Ensure the sample is free from bubbles and dust contaminants.
3. Pour the oil into the test cup of the BDV test kit (standard gap spacing: 2.5mm).
4. Apply increasing voltage at a rate of 2 kV/sec until flashover occurs.
5. Record the voltage at breakdown. Repeat the test 6 times on the same sample and compute the average.
6. For 33KV transformers, the minimum acceptable BDV is 40 kV. If the average is below 30 kV, filter/degas the oil immediately using the portable filtration machine.`,
                views: 28,
                companyId,
                createdBy: req.user?.id
            },
            {
                title: 'Numerical relay trip reset & event log extraction instructions',
                category: 'Device Reset',
                content: `1. Open the relay cover panel and press the 'RESET' button to clear active LED indicators (Earth Fault / Overcurrent).
2. Connect the laptop to the front RS232/USB port of the relay using the diagnostic cable.
3. Launch the relay configuration software and choose 'Extract Event Logs'.
4. Export the fault records as a COMTRADE format file for transient waveform analysis.
5. Verify that the CT secondary circuits are healthy and secondary resistance is within limits before putting the feeder back in service.`,
                views: 31,
                companyId,
                createdBy: req.user?.id
            },
            {
                title: 'Warranty claim checklist for protection relays and transformers',
                category: 'Warranty Claims',
                content: `Before registering a warranty claim, please compile the following checklist:
- Original equipment serial number (engraved on product nameplate).
- Purchase voucher/invoice showing delivery date.
- Site test reports showing commissioning parameters.
- Detailed logs of the fault (relay logs, alarm history, and damage description with photographs).
- Genuinely burnt components must not be tampered with or modified prior to inspection by our engineer.`,
                views: 15,
                companyId,
                createdBy: req.user?.id
            }
        ];

        await KnowledgeBase.create(articles);

        res.json({ message: 'CSM Knowledge Base seeded with realistic troubleshooting guides successfully' });
    } catch (error) {
        console.error('Seed KB data error:', error);
        res.status(500).json({ message: error.message || 'Error seeding knowledge base' });
    }
};

// Generic CRUD helper
const createCrudEndpoints = (Model, modelName) => {
    return {
        create: async (req, res) => {
            try {
                const doc = await Model.create({ ...req.body, companyId: req.user?.companyId });
                res.status(201).json(doc);
            } catch (error) {
                res.status(400).json({ message: `Error creating ${modelName}: ` + error.message });
            }
        },
        getAll: async (req, res) => {
            try {
                const docs = await Model.find({ companyId: req.user?.companyId }).sort({ createdAt: -1 }).lean();
                res.json(docs);
            } catch (error) {
                res.status(500).json({ message: `Error fetching ${modelName}s: ` + error.message });
            }
        },
        getById: async (req, res) => {
            try {
                const doc = await Model.findOne({ _id: req.params.id, companyId: req.user?.companyId }).lean();
                if (!doc) return res.status(404).json({ message: `${modelName} not found` });
                res.json(doc);
            } catch (error) {
                res.status(500).json({ message: `Error fetching ${modelName}: ` + error.message });
            }
        },
        update: async (req, res) => {
            try {
                const doc = await Model.findOneAndUpdate(
                    { _id: req.params.id, companyId: req.user?.companyId },
                    req.body,
                    { new: true, runValidators: true }
                );
                if (!doc) return res.status(404).json({ message: `${modelName} not found` });
                res.json(doc);
            } catch (error) {
                res.status(400).json({ message: `Error updating ${modelName}: ` + error.message });
            }
        },
        delete: async (req, res) => {
            try {
                const doc = await Model.findOneAndDelete({ _id: req.params.id, companyId: req.user?.companyId });
                if (!doc) return res.status(404).json({ message: `${modelName} not found` });
                res.json({ message: `${modelName} deleted successfully` });
            } catch (error) {
                res.status(500).json({ message: `Error deleting ${modelName}: ` + error.message });
            }
        }
    };
};

exports.categories = createCrudEndpoints(TicketCategory, 'TicketCategory');
exports.types = createCrudEndpoints(TicketType, 'TicketType');
exports.priorities = createCrudEndpoints(Priority, 'Priority');
exports.slaPolicies = createCrudEndpoints(SlaPolicy, 'SlaPolicy');
exports.serviceTeams = createCrudEndpoints(ServiceTeam, 'ServiceTeam');
exports.sources = createCrudEndpoints(TicketSource, 'TicketSource');
exports.designations = createCrudEndpoints(Designation, 'Designation');

exports.engineers = {
    create: async (req, res) => {
        return res.status(403).json({
            message: 'Manual creation of Engineers is disabled. Service Engineer Employees created in Employee Master automatically populate here.'
        });
    },
    getAll: async (req, res) => {
        try {
            const { syncAllEngineers } = require('../services/engineerSyncService');
            const companyId = req.user?.companyId;

            if (companyId) {
                await syncAllEngineers(companyId);
            }

            const docs = await Engineer.find({ companyId })
                .populate('employeeId')
                .populate('territoryId', 'name rules')
                .sort({ createdAt: -1 })
                .lean();

            const mapped = docs.map(doc => {
                if (doc.employeeId) {
                    return {
                        ...doc,
                        name: doc.employeeId.name,
                        email: doc.employeeId.email,
                        mobile: doc.employeeId.mobile || ''
                    };
                }
                return doc;
            });

            res.json(mapped);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching Engineers: ' + error.message });
        }
    },
    getById: async (req, res) => {
        try {
            const doc = await Engineer.findOne({ _id: req.params.id, companyId: req.user?.companyId })
                .populate('employeeId')
                .populate('territoryId', 'name rules')
                .lean();
            if (!doc) return res.status(404).json({ message: 'Engineer not found' });
            
            if (doc.employeeId) {
                doc.name = doc.employeeId.name;
                doc.email = doc.employeeId.email;
                doc.mobile = doc.employeeId.mobile || '';
            }
            res.json(doc);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching Engineer: ' + error.message });
        }
    },
    update: async (req, res) => {
        try {
            const updateData = {};
            if (req.body.territoryId !== undefined) {
                updateData.territoryId = req.body.territoryId || null;
            }
            if (req.body.pincodes !== undefined) {
                updateData.pincodes = Array.isArray(req.body.pincodes)
                    ? req.body.pincodes
                    : (typeof req.body.pincodes === 'string' ? req.body.pincodes.split(',').map(p => p.trim()).filter(Boolean) : []);
            }
            if (req.body.status) {
                updateData.status = req.body.status;
            }

            const doc = await Engineer.findOneAndUpdate(
                { _id: req.params.id, companyId: req.user?.companyId },
                updateData,
                { new: true, runValidators: true }
            ).populate('employeeId').populate('territoryId', 'name rules');

            if (!doc) return res.status(404).json({ message: 'Engineer not found' });

            if (doc.employeeId && req.body.territoryId) {
                const EmployeeProfile = require('../models/EmployeeProfile');
                await EmployeeProfile.findByIdAndUpdate(doc.employeeId._id || doc.employeeId, {
                    $addToSet: { assignedTerritories: req.body.territoryId }
                });
            }

            const result = doc.toObject ? doc.toObject() : doc;
            if (result.employeeId) {
                result.name = result.employeeId.name;
                result.email = result.employeeId.email;
                result.mobile = result.employeeId.mobile || '';
            }

            res.json(result);
        } catch (error) {
            res.status(400).json({ message: 'Error updating Engineer: ' + error.message });
        }
    },
    delete: async (req, res) => {
        return res.status(403).json({
            message: 'Manual deletion of Engineers is disabled. Engineer records are managed via Employee Master.'
        });
    }
};
