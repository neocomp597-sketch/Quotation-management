// An employee's Branch Transfer takes their assets along (moveEmployeeHoldings in
// controllers/payrollController.js; client, 2026-11-16: "the assets should be transferred to that
// branch along with the employee"). Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { install, quietly } = require('./helpers/fakeDb');
const AuditLog = require('../models/AuditLog');
const employeeCustomerService = require('../services/employeeCustomerService');
const serialTransferController = require('../controllers/serialTransferController');
const { moveEmployeeHoldings } = require('../controllers/payrollController');

const oid = () => new mongoose.Types.ObjectId();
const nashik = { _id: oid(), name: 'NASHIK' };
const usgoan = { _id: oid(), name: 'USGOAN', code: 'USG' };
const employee = { _id: oid(), name: 'Apeksha Mohite', employeeId: 'HO774', companyId: oid() };
const req = { user: { id: String(oid()), name: 'Rajshri Jadhav', companyId: String(employee.companyId) } };
const heldAssets = ['PF5ZDTWT', 'PG05B2TX-CPU', 'PG05B2TX-Keyboard', 'PG05B2TX-Monitor', 'PG05B2TX-Mouse']
    .map((serialNumber) => ({ _id: oid(), serialNumber, status: 'ALLOCATED', branchId: nashik._id }));

// Stand-ins for what the helper calls: the employee's customer, the serial move and the audit log
let customer;
let moves;
let moveResult;
let audits;
const realSync = employeeCustomerService.syncCustomerForEmployee;
const realMove = serialTransferController.moveSerialsToBranch;
const realAudit = AuditLog.create;
employeeCustomerService.syncCustomerForEmployee = async () => customer;
serialTransferController.moveSerialsToBranch = async (args) => {
    moves.push(args);
    if (moveResult instanceof Error) throw moveResult;
    return moveResult;
};
AuditLog.create = async (doc) => { audits.push(doc); return doc; };

let assetsInDb;
const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'Customer' && query.op === 'updateOne') return { matchedCount: 1, modifiedCount: 1 };
    if (name === 'Asset' && query.op === 'find') return assetsInDb;
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => {
    db.restore();
    employeeCustomerService.syncCustomerForEmployee = realSync;
    serialTransferController.moveSerialsToBranch = realMove;
    AuditLog.create = realAudit;
});

beforeEach(() => {
    db.reset();
    customer = { _id: oid(), companyName: employee.name, branchId: nashik._id };
    moves = [];
    moveResult = 'BT/2026-27/0008';
    audits = [];
    assetsInDb = heldAssets;
});

const transfer = (overrides = {}) => moveEmployeeHoldings({ req, employee, from: nashik, to: usgoan, reason: 'Posted to Usgoan', ...overrides });

test('the assets held in the branch left move to the new branch as one Branch Transfer', async () => {
    const result = await transfer();

    const [assetQuery] = db.queries('Asset', 'find');
    assert.deepEqual(assetQuery.getFilter(), { customerId: customer._id, branchId: nashik._id });
    assert.equal(assetQuery.getOptions().bypassBranch, true);

    assert.equal(moves.length, 1);
    const [move] = moves;
    assert.equal(move.assets, heldAssets);
    assert.equal(move.from, nashik);
    assert.equal(move.to, usgoan);
    assert.equal(move.companyId, req.user.companyId, 'the same company value as the Branch Transfer tab (one BT sequence)');
    assert.equal(move.reference, 'Employee transfer: Apeksha Mohite (HO774)');
    assert.equal(move.remarks, 'Posted to Usgoan');
    assert.equal(move.user, req.user);

    assert.deepEqual(result, { customerMoved: true, transferNo: 'BT/2026-27/0008', serials: heldAssets.map((a) => a.serialNumber), error: null });
});

test('the employee\'s customer moves to the new branch, recorded in the audit log', async () => {
    await transfer();

    const [customerMove] = db.queries('Customer', 'updateOne');
    assert.deepEqual(customerMove.getFilter(), { _id: customer._id });
    assert.deepEqual(customerMove.getUpdate(), { $set: { branchId: usgoan._id } });
    assert.equal(customerMove.getOptions().bypassBranch, true);

    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'CUSTOMER_BRANCH_TRANSFER');
    assert.equal(audits[0].entityId, customer._id);
    assert.deepEqual(audits[0].newValue, { branchId: usgoan._id, branchName: 'USGOAN' });
});

test('a customer already in the new branch is left as it is', async () => {
    customer.branchId = usgoan._id;
    const result = await transfer();
    assert.equal(db.queries('Customer', 'updateOne').length, 0);
    assert.equal(audits.length, 0);
    assert.equal(result.customerMoved, false);
    assert.equal(moves.length, 1, 'the assets still move');
});

test('no assets in the branch left: no Branch Transfer', async () => {
    assetsInDb = [];
    const result = await transfer();
    assert.equal(moves.length, 0);
    assert.equal(result.transferNo, null);
    assert.deepEqual(result.serials, []);
});

test('an employee without a home branch: only the customer moves', async () => {
    const result = await transfer({ from: null });
    assert.equal(db.queries('Asset').length, 0);
    assert.equal(moves.length, 0);
    assert.equal(result.customerMoved, true);
});

test('the move failing does not throw: the error is reported for the screen', async () => {
    moveResult = Object.assign(new Error('Some of these serial numbers were just moved by someone else. Reload and try again.'), { status: 409 });
    const result = await quietly(() => transfer());
    assert.match(result.error, /just moved by someone else/);
    assert.deepEqual(result.serials, []);
});

test('no customer for the employee (e.g. a vacant position): nothing moves', async () => {
    customer = null;
    const result = await transfer();
    assert.equal(db.executed.length, 0);
    assert.deepEqual(result, { customerMoved: false, transferNo: null, serials: [], error: null });
});
