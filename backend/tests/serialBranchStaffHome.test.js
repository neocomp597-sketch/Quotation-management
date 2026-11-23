// Which customers' serials a branch sees wherever they are held (utils/customerBranchSerials.js,
// Serial No Transfer and Raise Ticket): its customers in Customer Master, but a customer linked to
// an employee goes with the employee's home branch (client, 2026-11-19: DANI PARK's Serial No List
// counted NASHIK and ULARIA staff serials because their customer records were filed in DANI PARK).
// Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { install } = require('./helpers/fakeDb');
const { serialBranchScope } = require('../utils/customerBranchSerials');

const oid = () => new mongoose.Types.ObjectId();
const dani = oid();
const nashik = oid();

let customers;
let employees;
// The ids a condition names: `{ $in: [...] }` or one id.
const ids = (condition) => (condition?.$in ? condition.$in : [condition]).map(String);
const db = install((query) => {
    const name = query.model.modelName;
    const filter = query.getFilter();
    if (name === 'Customer' && query.op === 'find') {
        if (filter.branchId) return customers.filter((customer) => ids(filter.branchId).includes(String(customer.branchId)));
        if (filter.employeeProfileId) return customers.filter((customer) => ids(filter.employeeProfileId).includes(String(customer.employeeProfileId)));
    }
    if (name === 'EmployeeProfile' && query.op === 'find') {
        if (filter.branchId) return employees.filter((employee) => ids(filter.branchId).includes(String(employee.branchId)));
        if (filter._id) return employees.filter((employee) => ids(filter._id).includes(String(employee._id)));
    }
    return new Error(`unexpected query ${name}.${query.op} ${JSON.stringify(filter)}`);
});
after(() => db.restore());

const harshit = { _id: oid(), branchId: dani }; // DANI PARK staff
const vijay = { _id: oid(), branchId: nashik }; // NASHIK staff
const noHome = { _id: oid(), branchId: null };
const gone = oid(); // no longer in Employee Master
const shop = { _id: oid(), branchId: dani, employeeProfileId: null };
const harshitCustomer = { _id: oid(), branchId: nashik, employeeProfileId: harshit._id };
const vijayCustomer = { _id: oid(), branchId: dani, employeeProfileId: vijay._id };
const noHomeCustomer = { _id: oid(), branchId: dani, employeeProfileId: noHome._id };
const goneCustomer = { _id: oid(), branchId: dani, employeeProfileId: gone };

beforeEach(() => {
    db.reset();
    customers = [shop, harshitCustomer, vijayCustomer, noHomeCustomer, goneCustomer];
    employees = [harshit, vijay, noHome];
});

const seen = async (branchIds) => (await serialBranchScope(branchIds)).customerIds.map(String).sort();

test("a branch sees its customers' serials, and its staff's by their home branch", async () => {
    assert.deepEqual(await seen([dani]), [shop, harshitCustomer, noHomeCustomer, goneCustomer].map((c) => String(c._id)).sort());
});

test("another branch's staff filed in this branch are left to their home branch", async () => {
    assert.ok(!(await seen([dani])).includes(String(vijayCustomer._id)), 'NASHIK staff are not DANI PARK customers');
    assert.ok((await seen([nashik])).includes(String(vijayCustomer._id)), 'NASHIK sees its own staff');
    assert.ok(!(await seen([nashik])).includes(String(harshitCustomer._id)), 'DANI PARK staff filed in NASHIK are not NASHIK customers');
});

test('several branches together see the customers of each', async () => {
    assert.deepEqual(await seen([dani, nashik]), customers.map((c) => String(c._id)).sort());
});

test('the condition: serials the branch holds, or held by its customers', async () => {
    const scope = await serialBranchScope([dani]);
    assert.deepEqual(scope.branchFilter, { branchId: dani });
    assert.deepEqual(scope.condition.$or[0], { branchId: dani });
    assert.deepEqual(scope.condition.$or[1].customerId.$in.map(String).sort(), await seen([dani]));
});
