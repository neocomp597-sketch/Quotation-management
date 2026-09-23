/**
 * Verifies branch-level data isolation.
 *
 * Runs the same queries twice - once in an admin context (no branch scope) and once
 * as a user assigned only to one branch - and reports what each can see.
 *
 * Usage: node scripts/testBranchScope.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runWithTenant } = require('../middlewares/tenantContext');

const COMPANY_ID = '6a8bf304ac99b5d51a116954'; // Stelmec
const NASHIK = '6a8c061fac99b5d51a116b2e';
const USGOAN = '6a927734d38fc49a298a500a';

const countAll = async () => {
    const Ticket = require('../models/Ticket');
    const Customer = require('../models/Customer');
    const Enquiry = require('../models/Enquiry');
    const EmployeeProfile = require('../models/EmployeeProfile');
    const Branch = require('../models/Branch');

    return {
        tickets: await Ticket.countDocuments({}),
        customers: await Customer.countDocuments({}),
        enquiries: await Enquiry.countDocuments({}),
        employees: await EmployeeProfile.countDocuments({}),
        employeesInUsgoan: await EmployeeProfile.countDocuments({ branchId: USGOAN }),
        branchesVisible: await Branch.countDocuments({})
    };
};

(async () => {
    await mongoose.connect(process.env.MONGO_URI);

    const asAdmin = await new Promise(resolve => {
        runWithTenant(COMPANY_ID, async () => resolve(await countAll()), { branchScoped: false, branchIds: [] });
    });

    const asNashikUser = await new Promise(resolve => {
        runWithTenant(COMPANY_ID, async () => resolve(await countAll()), { branchScoped: true, branchIds: [NASHIK] });
    });

    const row = (label, a, b) => console.log(`  ${label.padEnd(22)} admin: ${String(a).padStart(5)}   nashik-user: ${String(b).padStart(5)}`);
    console.log('\nVisible record counts:');
    row('tickets', asAdmin.tickets, asNashikUser.tickets);
    row('customers', asAdmin.customers, asNashikUser.customers);
    row('enquiries', asAdmin.enquiries, asNashikUser.enquiries);
    row('employees', asAdmin.employees, asNashikUser.employees);
    row('employees in USGOAN', asAdmin.employeesInUsgoan, asNashikUser.employeesInUsgoan);

    console.log('\nChecks:');
    const checks = [
        ['a Nashik user cannot see USGOAN employees', asNashikUser.employeesInUsgoan === 0],
        ['a Nashik user sees fewer employees than admin', asNashikUser.employees < asAdmin.employees],
        ['admin still sees every employee', asAdmin.employees > 900],
        ['records with no branch stay visible (customers)', asNashikUser.customers === asAdmin.customers],
        ['records with no branch stay visible (enquiries)', asNashikUser.enquiries === asAdmin.enquiries]
    ];
    let failed = 0;
    for (const [label, ok] of checks) {
        if (!ok) failed++;
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
    }

    console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
    process.exit(failed ? 1 : 0);
})().catch(err => {
    console.error('failed:', err.message);
    process.exit(1);
});
