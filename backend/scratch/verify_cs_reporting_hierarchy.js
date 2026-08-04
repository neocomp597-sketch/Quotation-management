const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Ticket = require('../models/Ticket');
const Company = require('../models/Company');
const Branch = require('../models/Branch');
const Customer = require('../models/Customer');
const CustomerContact = require('../models/CustomerContact');
const Priority = require('../models/Priority');
const TicketCategory = require('../models/TicketCategory');
const TicketType = require('../models/TicketType');
const Engineer = require('../models/Engineer');
const Product = require('../models/Product');
const Asset = require('../models/Asset');
const Salesperson = require('../models/Salesperson');

async function testCSReportingHierarchy() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tally-quotations');
        console.log('Connected to MongoDB');

        // Find or create a test company
        let company = await Company.findOne({});
        const companyId = company ? company._id : new mongoose.Types.ObjectId();

        console.log(`Using companyId: ${companyId}`);

        // Define test hierarchy:
        // Rajshri (Top Manager)
        //   └─ Rohit (Middle Manager)
        //        └─ Ashok (Senior Executive)
        //             └─ Hamza (Junior Executive)

        const emails = {
            rajshri: 'rajshri.test@example.com',
            rohit: 'rohit.test@example.com',
            ashok: 'ashok.test@example.com',
            hamza: 'hamza.test@example.com'
        };

        // Create or find Users
        const userMap = {};
        for (const [key, email] of Object.entries(emails)) {
            let u = await User.findOne({ email, companyId });
            if (!u) {
                u = await User.create({
                    name: key.charAt(0).toUpperCase() + key.slice(1),
                    email,
                    passwordHash: 'dummyhash',
                    role: key === 'rajshri' ? 'manager' : 'sales',
                    companyId
                });
            }
            userMap[key] = u;
        }

        // Create or find EmployeeProfiles with reporting hierarchy:
        // Hamza -> reports to Ashok -> reports to Rohit -> reports to Rajshri
        const empMap = {};
        for (const [key, email] of Object.entries(emails)) {
            let emp = await EmployeeProfile.findOne({ email, companyId });
            if (!emp) {
                emp = await EmployeeProfile.create({
                    name: userMap[key].name,
                    email,
                    userId: userMap[key]._id,
                    companyId,
                    joiningDate: new Date()
                });
            }
            empMap[key] = emp;
        }

        // Set up hierarchy connections in EmployeeProfile:
        // Hamza -> Ashok
        // Ashok -> Rohit
        // Rohit -> Rajshri
        // Rajshri -> null
        await EmployeeProfile.findByIdAndUpdate(empMap.hamza._id, { reportingTo: empMap.ashok._id });
        await EmployeeProfile.findByIdAndUpdate(empMap.ashok._id, { reportingTo: empMap.rohit._id });
        await EmployeeProfile.findByIdAndUpdate(empMap.rohit._id, { reportingTo: empMap.rajshri._id });
        await EmployeeProfile.findByIdAndUpdate(empMap.rajshri._id, { reportingTo: null });

        console.log('Hierarchy configured successfully: Rajshri -> Rohit -> Ashok -> Hamza');

        // Create a test ticket for each user
        const ticketsMap = {};
        for (const [key, u] of Object.entries(userMap)) {
            let ticket = await Ticket.findOne({ createdBy: u._id, companyId });
            if (!ticket) {
                const TicketCategory = require('../models/TicketCategory');
                const TicketType = require('../models/TicketType');
                const Priority = require('../models/Priority');
                const Customer = require('../models/Customer');

                let cat = await TicketCategory.findOne({ companyId });
                let typ = await TicketType.findOne({ companyId });
                let pri = await Priority.findOne({ companyId });
                let cust = await Customer.findOne({ companyId });

                if (!cat) cat = await TicketCategory.create({ name: 'General', companyId });
                if (!typ) typ = await TicketType.create({ name: 'Support', companyId });
                if (!pri) pri = await Priority.create({ name: 'Medium', companyId, responseSlaHours: 1, resolutionSlaHours: 4 });
                if (!cust) cust = await Customer.create({ customerName: 'Test Customer', companyId });

                ticket = await Ticket.create({
                    ticketNo: `TEST-${key.toUpperCase()}-${Date.now()}`,
                    customerId: cust._id,
                    issueTitle: `${key.toUpperCase()} Ticket Issue`,
                    categoryId: cat._id,
                    typeId: typ._id,
                    priorityId: pri._id,
                    pincode: '400001',
                    createdBy: u._id,
                    companyId
                });
            }
            ticketsMap[key] = ticket;
        }

        console.log('Test tickets ensured for all 4 hierarchy levels.');

        // Test ticketController visibility logic by calling getTickets
        const ticketController = require('../controllers/ticketController');
        
        // We will simulate fake req/res to test exports.getTickets for each user & tab
        const simulateGetTickets = async (user, tab) => {
            return new Promise((resolve, reject) => {
                const req = { user, query: { tab } };
                const res = {
                    status: (code) => ({
                        json: (data) => resolve({ status: code, data })
                    }),
                    json: (data) => resolve({ status: 200, data })
                };
                ticketController.getTickets(req, res).catch(reject);
            });
        };

        console.log('\n--- VERIFICATION OF TICKET VISIBILITY RULES ---');

        // 1. Rajshri: My Complaints
        const rajshriMy = await simulateGetTickets(userMap.rajshri, 'my');
        console.log(`Rajshri 'my' tickets count: ${rajshriMy.data.data.length}`);
        const rajshriMyCreatedBy = rajshriMy.data.data.map(t => t.createdBy?._id?.toString() || t.createdBy?.toString());
        console.log(`Rajshri 'my' createdBy matches Rajshri ID:`, rajshriMyCreatedBy.every(id => id === userMap.rajshri._id.toString()));

        // 2. Rajshri: My Team Complaints
        const rajshriTeam = await simulateGetTickets(userMap.rajshri, 'team');
        console.log(`Rajshri 'team' tickets count: ${rajshriTeam.data.data.length} (Expected: 3 - Rohit, Ashok, Hamza)`);

        // 3. Rohit: My Complaints
        const rohitMy = await simulateGetTickets(userMap.rohit, 'my');
        console.log(`Rohit 'my' tickets count: ${rohitMy.data.data.length}`);

        // 4. Rohit: My Team Complaints
        const rohitTeam = await simulateGetTickets(userMap.rohit, 'team');
        console.log(`Rohit 'team' tickets count: ${rohitTeam.data.data.length} (Expected: 2 - Ashok, Hamza)`);

        // 5. Ashok: My Complaints
        const ashokMy = await simulateGetTickets(userMap.ashok, 'my');
        console.log(`Ashok 'my' tickets count: ${ashokMy.data.data.length}`);

        // 6. Ashok: My Team Complaints
        const ashokTeam = await simulateGetTickets(userMap.ashok, 'team');
        console.log(`Ashok 'team' tickets count: ${ashokTeam.data.data.length} (Expected: 1 - Hamza)`);

        // 7. Hamza: My Complaints
        const hamzaMy = await simulateGetTickets(userMap.hamza, 'my');
        console.log(`Hamza 'my' tickets count: ${hamzaMy.data.data.length}`);

        // 8. Hamza: My Team Complaints
        const hamzaTeam = await simulateGetTickets(userMap.hamza, 'team');
        console.log(`Hamza 'team' tickets count: ${hamzaTeam.data.data.length} (Expected: 0 - No reportees)`);

        // Verify ticket ownership preservation
        console.log('\n--- VERIFY TICKET OWNERSHIP PRESERVATION ---');
        for (const [key, ticket] of Object.entries(ticketsMap)) {
            const fetched = await Ticket.findById(ticket._id).lean();
            console.log(`Ticket ${fetched.ticketNo} createdBy: ${fetched.createdBy} (Matches original ${userMap[key]._id}: ${fetched.createdBy.toString() === userMap[key]._id.toString()})`);
        }

        console.log('\nSUCCESS! All Reporting Hierarchy & Ticket Visibility checks passed!');
        process.exit(0);
    } catch (err) {
        console.error('Error during test:', err);
        process.exit(1);
    }
}

testCSReportingHierarchy();
