// Employee Master > Assign Asset > "Move to <branch>" (POST /serial-transfers/employees/:id/assets/move-home):
// items an employee holds in another branch than their own move there (client, 2026-11-16: Rohit
// Manoj Dixit was moved to DANI PARK, his laptop FTR3Y04 stayed in HEAD OFFICE, and DANI PARK's
// Invoice Bulk Upload could not find it). Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { install, makeRes, quietly } = require('./helpers/fakeDb');
const employeeCustomerService = require('../services/employeeCustomerService');
const payrollController = require('../controllers/payrollController');
const { moveEmployeeAssetsHome } = require('../controllers/serialTransferController');

const oid = () => new mongoose.Types.ObjectId();
const companyId = oid();
const daniPark = { _id: oid(), name: 'DANI PARK', status: 'Active' };
const headOffice = { _id: oid(), name: 'HEAD OFFICE' };
const admin = { id: String(oid()), name: 'Super Admin', role: 'admin', companyId: String(companyId) };
const customer = { _id: oid(), companyName: 'Rohit Manoj Dixit' };
const laptop = { _id: oid(), branchId: headOffice._id };

let employee;
let home;
let away;
let calls;
let holdings;
const realSync = employeeCustomerService.syncCustomerForEmployee;
const realMove = payrollController.moveEmployeeHoldings;
employeeCustomerService.syncCustomerForEmployee = async () => customer;
payrollController.moveEmployeeHoldings = async (args) => { calls.push(args); return holdings; };

const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'EmployeeProfile' && query.op === 'findOne') return employee;
    if (name === 'Customer' && query.op === 'findOne') return customer;
    if (name === 'Branch' && query.op === 'findOne') return home;
    if (name === 'Branch' && query.op === 'find') return [headOffice];
    if (name === 'Asset' && query.op === 'find') return away;
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => {
    db.restore();
    employeeCustomerService.syncCustomerForEmployee = realSync;
    payrollController.moveEmployeeHoldings = realMove;
    delete process.env.SERIAL_BRANCH_TRANSFER_ACCESS;
});

beforeEach(() => {
    db.reset();
    employee = { _id: oid(), name: 'Rohit Manoj Dixit', employeeId: 'HO811', companyId, branchId: daniPark._id };
    home = daniPark;
    away = [laptop];
    calls = [];
    holdings = { customerMoved: true, transferNo: 'BT/2026-27/0013', transferNos: ['BT/2026-27/0013'], serials: ['FTR3Y04'], error: null };
    delete process.env.SERIAL_BRANCH_TRANSFER_ACCESS;
});

const moveHome = async (user = admin) => {
    const res = makeRes();
    await quietly(() => moveEmployeeAssetsHome({ user, params: { employeeId: String(employee._id) }, body: {}, query: {}, headers: {} }, res));
    return res;
};

test('the laptop in HEAD OFFICE moves to DANI PARK, Rohit\'s branch', async () => {
    const res = await moveHome();

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const [assetQuery] = db.queries('Asset', 'find');
    assert.deepEqual(assetQuery.getFilter(), { companyId: admin.companyId, customerId: customer._id, branchId: { $nin: [daniPark._id, null] } });
    assert.equal(assetQuery.getOptions().bypassBranch, true);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].to, daniPark);
    assert.equal(calls[0].from, null, 'from every branch');
    assert.equal(calls[0].employee, employee);
    assert.equal(res.body.message, '1 asset of Rohit Manoj Dixit moved to DANI PARK (BT/2026-27/0013).');
    assert.deepEqual(res.body.serials, ['FTR3Y04']);
});

test('everything already in the employee\'s branch: nothing moves', async () => {
    away = [];
    const res = await moveHome();
    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 0);
    assert.equal(res.body.moved, 0);
    assert.match(res.body.message, /already in DANI PARK/);
});

test('an employee without a branch: 400, nothing moves', async () => {
    employee.branchId = null;
    const res = await moveHome();
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
});

test('with branch-level access, a user cannot move serials out of a branch they do not work in', async () => {
    process.env.SERIAL_BRANCH_TRANSFER_ACCESS = 'branch';
    const res = await moveHome({ ...admin, activeBranchId: String(daniPark._id) });
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /HEAD OFFICE/);
    assert.equal(calls.length, 0);
});

test('the move failing entirely: 409 with the reason', async () => {
    holdings = { customerMoved: false, transferNo: null, transferNos: [], serials: [], error: 'HEAD OFFICE: Some of these serial numbers were just moved by someone else.' };
    const res = await moveHome();
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /just moved by someone else/);
});
