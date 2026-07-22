const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm_db';

const EmployeeProfile = require('../models/EmployeeProfile');
const Engineer = require('../models/Engineer');
const Ticket = require('../models/Ticket');
const Company = require('../models/Company');
const Priority = require('../models/Priority');
const TicketCategory = require('../models/TicketCategory');
const TicketType = require('../models/TicketType');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Salesperson = require('../models/Salesperson');
const Product = require('../models/Product');
const Asset = require('../models/Asset');
const ServiceTeam = require('../models/ServiceTeam');
const CustomerContact = require('../models/CustomerContact');

const { syncEmployeeToEngineer, syncAllEngineers } = require('../services/engineerSyncService');
const ticketController = require('../controllers/ticketController');

async function runVerification() {
    console.log('--- Starting CSM Enhancements Verification ---');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    let company = await Company.findOne({ name: 'Verification Test Company' });
    if (!company) {
        company = await Company.create({ name: 'Verification Test Company', code: 'VTC' });
    }
    const companyId = company._id;

    // ──────────────────────────────────────────────────────────────────────────
    // PART 1: Service Engineer Auto-Sync Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 1] Service Engineer Auto-Sync...');
    
    // Clean previous test data
    await EmployeeProfile.deleteMany({ companyId, email: /@verification\.test$/ });
    await Engineer.deleteMany({ companyId, email: /@verification\.test$/ });

    // Step A: Create employee with designation "Service Engineer"
    const emp = await EmployeeProfile.create({
        name: 'Aditya Verification',
        email: 'aditya@verification.test',
        mobile: '9876543210',
        joiningDate: new Date(),
        designation: 'Service Engineer',
        status: 'Active',
        companyId
    });

    const engineerObj = await syncEmployeeToEngineer(emp);
    console.log('Synced Engineer Obj created:', engineerObj ? engineerObj.name : 'NULL');

    const engInDb = await Engineer.findOne({ employeeId: emp._id, companyId });
    if (!engInDb || engInDb.email !== 'aditya@verification.test' || engInDb.status !== 'Active') {
        throw new Error('FAIL: Auto-sync failed to create active Engineer for Service Engineer employee!');
    }
    console.log('✅ PASS: Auto-sync created Engineer master record for Service Engineer!');

    // Step B: Update designation away from Service Engineer
    emp.designation = 'Senior Accounts Manager';
    await emp.save();
    await syncEmployeeToEngineer(emp);

    const engAfterDesigChange = await Engineer.findOne({ employeeId: emp._id, companyId });
    if (!engAfterDesigChange || engAfterDesigChange.status !== 'Inactive') {
        throw new Error('FAIL: Auto-sync failed to mark Engineer as Inactive when designation changed!');
    }
    console.log('✅ PASS: Designation change marked Engineer record as Inactive!');

    // Step C: Change designation back to Service Engineer & mark status = Resigned
    emp.designation = 'Service Engineer';
    emp.status = 'Resigned';
    await emp.save();
    await syncEmployeeToEngineer(emp);

    const engAfterResigned = await Engineer.findOne({ employeeId: emp._id, companyId });
    if (!engAfterResigned || engAfterResigned.status !== 'Inactive') {
        throw new Error('FAIL: Auto-sync failed to mark Engineer as Inactive when employee resigned!');
    }
    console.log('✅ PASS: Inactive/Resigned employee status synced Engineer as Inactive!');

    // Step D: Re-activate employee
    emp.status = 'Active';
    await emp.save();
    await syncEmployeeToEngineer(emp);

    const engReactivated = await Engineer.findOne({ employeeId: emp._id, companyId });
    if (!engReactivated || engReactivated.status !== 'Active') {
        throw new Error('FAIL: Auto-sync failed to re-activate Engineer!');
    }
    console.log('✅ PASS: Reactivating employee re-activated Engineer master record!');

    // ──────────────────────────────────────────────────────────────────────────
    // PART 2: Engineer-Wise Complaint Visibility Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 2] Engineer-Wise Access Control...');

    // Clean previous tickets
    await Ticket.deleteMany({ companyId, issueTitle: /Verification Ticket/ });

    // Setup Category, Type, Priority, Customer
    let category = await TicketCategory.findOne({ companyId });
    if (!category) category = await TicketCategory.create({ name: 'General', companyId });

    let type = await TicketType.findOne({ companyId });
    if (!type) type = await TicketType.create({ name: 'Support', companyId });

    let priority = await Priority.findOne({ companyId });
    if (!priority) priority = await Priority.create({ name: 'Medium', companyId, responseSlaHours: 1, resolutionSlaHours: 4 });

    let customer = await Customer.findOne({ companyId });
    if (!customer) customer = await Customer.create({ customerName: 'Test Customer', companyName: 'Test Customer Pvt Ltd', companyId });

    // Setup Engineer A & Engineer B
    let engA = await Engineer.findOne({ email: 'eng.a@verification.test', companyId });
    if (!engA) {
        engA = await Engineer.create({
            name: 'Engineer A',
            email: 'eng.a@verification.test',
            mobile: '1111111111',
            status: 'Active',
            companyId
        });
    }

    let engB = await Engineer.findOne({ email: 'eng.b@verification.test', companyId });
    if (!engB) {
        engB = await Engineer.create({
            name: 'Engineer B',
            email: 'eng.b@verification.test',
            mobile: '2222222222',
            status: 'Active',
            companyId
        });
    }

    // Create Ticket CS1001 for Engineer A
    const ticketA = await Ticket.create({
        ticketNo: 'CS1001-TEST',
        customerId: customer._id,
        issueTitle: 'Verification Ticket for Engineer A',
        pincode: '110001',
        categoryId: category._id,
        typeId: type._id,
        priorityId: priority._id,
        assignedEngineerId: engA._id,
        companyId
    });

    // Create Ticket CS1002 for Engineer B
    const ticketB = await Ticket.create({
        ticketNo: 'CS1002-TEST',
        customerId: customer._id,
        issueTitle: 'Verification Ticket for Engineer B',
        pincode: '110002',
        categoryId: category._id,
        typeId: type._id,
        priorityId: priority._id,
        assignedEngineerId: engB._id,
        companyId
    });

    // Create Mock Express Request/Response helper
    const createMockReqRes = (user, query = {}, params = {}, body = {}) => {
        let resData = null;
        let statusCode = 200;
        const req = { user, query, params, body };
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: (data) => { resData = data; return res; }
        };
        return { req, res, getResult: () => ({ statusCode, resData }) };
    };

    // Test A: Admin gets all tickets
    const adminUser = { id: 'admin1', role: 'admin', email: 'admin@verification.test', companyId: companyId.toString() };
    const { req: reqAdmin, res: resAdmin, getResult: getAdminRes } = createMockReqRes(adminUser, {});
    await ticketController.getTickets(reqAdmin, resAdmin);
    const adminResult = getAdminRes().resData;
    const adminTicketNos = (adminResult.data || []).map(t => t.ticketNo);
    if (!adminTicketNos.includes('CS1001-TEST') || !adminTicketNos.includes('CS1002-TEST')) {
        throw new Error('FAIL: Admin role should view ALL tickets!');
    }
    console.log('✅ PASS: Admin role can view ALL tickets!');

    // Test B: Engineer A gets tickets (should see CS1001-TEST only, NOT CS1002-TEST)
    const engineerAUser = { id: 'userEngA', role: 'sales', email: 'eng.a@verification.test', companyId: companyId.toString() };
    const { req: reqEngA, res: resEngA, getResult: getEngARes } = createMockReqRes(engineerAUser, {});
    await ticketController.getTickets(reqEngA, resEngA);
    const engAResult = getEngARes().resData;
    const engATicketNos = (engAResult.data || []).map(t => t.ticketNo);
    if (!engATicketNos.includes('CS1001-TEST') || engATicketNos.includes('CS1002-TEST')) {
        throw new Error(`FAIL: Engineer A should only see CS1001-TEST! Saw: ${JSON.stringify(engATicketNos)}`);
    }
    console.log('✅ PASS: Engineer A sees ONLY complaints assigned to Engineer A!');

    // Test C: Engineer B gets tickets (should see CS1002-TEST only, NOT CS1001-TEST)
    const engineerBUser = { id: 'userEngB', role: 'sales', email: 'eng.b@verification.test', companyId: companyId.toString() };
    const { req: reqEngB, res: resEngB, getResult: getEngBRes } = createMockReqRes(engineerBUser, {});
    await ticketController.getTickets(reqEngB, resEngB);
    const engBResult = getEngBRes().resData;
    const engBTicketNos = (engBResult.data || []).map(t => t.ticketNo);
    if (!engBTicketNos.includes('CS1002-TEST') || engBTicketNos.includes('CS1001-TEST')) {
        throw new Error(`FAIL: Engineer B should only see CS1002-TEST! Saw: ${JSON.stringify(engBTicketNos)}`);
    }
    console.log('✅ PASS: Engineer B sees ONLY complaints assigned to Engineer B!');

    // Test D: Engineer B trying to fetch ticket CS1001 (assigned to Engineer A)
    const { req: reqEngBDetail, res: resEngBDetail, getResult: getEngBDetailRes } = createMockReqRes(engineerBUser, {}, { id: ticketA._id.toString() });
    await ticketController.getTicketById(reqEngBDetail, resEngBDetail);
    const engBDetailResult = getEngBDetailRes();
    if (engBDetailResult.statusCode !== 403) {
        throw new Error(`FAIL: Engineer B accessing Engineer A's ticket should return 403 Forbidden! Got status: ${engBDetailResult.statusCode}`);
    }
    console.log('✅ PASS: Engineer B blocked with 403 Forbidden when trying to access Engineer A ticket!');

    // Test E: Engineer B trying to reassign ticket
    const { req: reqEngBReassign, res: resEngBReassign, getResult: getEngBReassignRes } = createMockReqRes(engineerBUser, {}, { id: ticketB._id.toString() }, { assignedEngineerId: engA._id.toString() });
    await ticketController.assignTicket(reqEngBReassign, resEngBReassign);
    const engBReassignResult = getEngBReassignRes();
    if (engBReassignResult.statusCode !== 403) {
        throw new Error(`FAIL: Non-Admin engineer trying to reassign ticket should return 403 Forbidden! Got status: ${engBReassignResult.statusCode}`);
    }
    console.log('✅ PASS: Non-Admin engineer blocked with 403 Forbidden when trying to reassign tickets!');

    // Cleanup test data
    await EmployeeProfile.deleteMany({ companyId, email: /@verification\.test$/ });
    await Engineer.deleteMany({ companyId, email: /@verification\.test$/ });
    await Ticket.deleteMany({ companyId, issueTitle: /Verification Ticket/ });

    console.log('\n======================================================');
    console.log('🎉 ALL CSM ENHANCEMENTS VERIFIED SUCCESSFULLY!');
    console.log('======================================================\n');

    await mongoose.disconnect();
}

runVerification().catch((err) => {
    console.error('❌ Verification failed with error:', err);
    mongoose.disconnect();
    process.exit(1);
});
