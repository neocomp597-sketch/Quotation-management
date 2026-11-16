// Raise Ticket > Customer (GET /csm/tickets/customer-options): employees are offered too
// (client, 2026-11-16: "only customers show in the dropdown, employees don't").
// Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { install, makeRes } = require('./helpers/fakeDb');
const ticketController = require('../controllers/ticketController');

const oid = () => new mongoose.Types.ObjectId();
const companyId = oid();
const branchId = oid();
const employeeProfileId = oid();

const shop = { _id: oid(), companyName: 'Shree Traders', customerName: 'Shree Traders', employeeProfileId: null };
const abhinav = { _id: oid(), companyName: 'Abhinav Raut', customerName: 'Abhinav Raut', employeeProfileId };

// What the database holds for each test: the branch's customers, the employees of the branch
// and the customers of employees.
let data;
const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'EmployeeProfile' && query.op === 'distinct') return data.branchEmployees;
    if (name === 'Customer' && query.op === 'find') {
        return 'employeeProfileId' in query.getFilter() ? data.employeeCustomers : data.branchCustomers;
    }
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => db.restore());
beforeEach(() => {
    db.reset();
    data = { branchCustomers: [], branchEmployees: [], employeeCustomers: [] };
});

const options = async (query = {}) => {
    const res = makeRes();
    await ticketController.getTicketCustomerOptions({ user: { id: String(oid()), role: 'manager', companyId, activeBranchId: branchId }, query }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    return res.body;
};
const employeeQuery = () => db.queries('Customer', 'find').find((q) => 'employeeProfileId' in q.getFilter());
const branchQuery = () => db.queries('Customer', 'find').find((q) => !('employeeProfileId' in q.getFilter()));

test('without a search: the branch\'s customers, then the employees of the branch', async () => {
    data.branchCustomers = [shop];
    data.branchEmployees = [employeeProfileId];
    data.employeeCustomers = [abhinav];

    assert.deepEqual(await options(), [shop, abhinav]);

    const [employees] = db.queries('EmployeeProfile', 'distinct');
    const filter = employees.getFilter();
    assert.deepEqual(filter.$or, [{ branchId }, { assignedBranches: branchId }], 'home or assigned branch');
    assert.deepEqual(filter.isVacant, { $ne: true }, 'vacant positions are no people');
    assert.equal(employees.getOptions().bypassBranch, true);

    const query = employeeQuery();
    assert.deepEqual(query.getFilter().employeeProfileId, { $in: [employeeProfileId] });
    assert.equal(String(query.getFilter().companyId), String(companyId));
    // An employee's customer keeps the branch it was created in, so it is found in any branch
    assert.equal(query.getOptions().bypassBranch, true);
});

test('the branch\'s own customers keep the branch rule', async () => {
    await options();
    assert.equal(String(branchQuery().getFilter().branchId), String(branchId));
    assert.notEqual(branchQuery().getOptions().bypassBranch, true);
});

test('a search finds any employee of the company, also one whose customer is in another branch', async () => {
    data.employeeCustomers = [abhinav];

    assert.deepEqual(await options({ search: 'abhinav raut' }), [abhinav]);

    assert.equal(db.queries('EmployeeProfile').length, 0, 'no branch lookup when searching');
    const filter = employeeQuery().getFilter();
    assert.deepEqual(filter.employeeProfileId, { $ne: null });
    assert.ok(filter.$or.some((condition) => condition.companyName?.test('Abhinav Raut')), 'searched by name');
    assert.equal(employeeQuery().getOptions().bypassBranch, true);
});

test('an employee whose customer is in the branch is listed once', async () => {
    data.branchCustomers = [abhinav];
    data.branchEmployees = [employeeProfileId];
    data.employeeCustomers = [abhinav];

    assert.deepEqual(await options(), [abhinav]);
});

test('both lists carry employeeProfileId, so the form can mark employees', async () => {
    await options();
    for (const query of [branchQuery(), employeeQuery()]) {
        assert.equal(query.projection().employeeProfileId, 1);
    }
});

test('a failed query answers 500 with a message', async () => {
    db.reset();
    const failing = install(() => new Error('connection reset'));
    try {
        const res = makeRes();
        const { error } = console;
        console.error = () => {};
        try {
            await ticketController.getTicketCustomerOptions({ user: { companyId, activeBranchId: branchId }, query: {} }, res);
        } finally {
            console.error = error;
        }
        assert.equal(res.statusCode, 500);
        assert.equal(res.body.message, 'connection reset');
    } finally {
        failing.restore();
    }
});
