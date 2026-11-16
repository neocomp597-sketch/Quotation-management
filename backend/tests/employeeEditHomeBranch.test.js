// Edit Employee (PUT /payroll/employees/:id): a new home branch chosen with the Assign Branch
// switches is a move like Branch Transfer, so the employee's assets go along.
// Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Module = require('module');
const { install, makeRes, quietly } = require('./helpers/fakeDb');

// Password hashing is not used by this save (the login sync is replaced below); a stand-in keeps
// the test independent of how bcryptjs is installed.
const bcryptPath = require.resolve('bcryptjs');
const bcryptStub = new Module(bcryptPath);
Object.assign(bcryptStub, { filename: bcryptPath, loaded: true, exports: { genSalt: async () => '', hash: async () => '', compare: async () => false } });
require.cache[bcryptPath] = bcryptStub;

// Everything around the save is recorded instead of done: branch rule, audit, logins, engineers
const branchService = require('../services/employeeBranchService');
branchService.checkEmployeeBranchChange = async ({ current, next }) => ({ changed: true, before: current, after: next });
branchService.recordEmployeeBranchChange = async () => {};
const employeeUserService = require('../services/employeeUserService');
const engineerSyncService = require('../services/engineerSyncService');
const employeeCustomerService = require('../services/employeeCustomerService');
const serialTransferController = require('../controllers/serialTransferController');
const PayrollAuditLog = require('../models/PayrollAuditLog');
const AuditLog = require('../models/AuditLog');
const EmployeeProfile = require('../models/EmployeeProfile');
const originals = {
    syncUser: employeeUserService.syncUserForEmployee,
    syncEngineer: engineerSyncService.syncEmployeeToEngineer,
    syncCustomer: employeeCustomerService.syncCustomerForEmployee,
    move: serialTransferController.moveSerialsToBranch,
    payrollAudit: PayrollAuditLog.create,
    audit: AuditLog.create
};
employeeUserService.syncUserForEmployee = async () => null;
engineerSyncService.syncEmployeeToEngineer = async () => null;
let customer;
employeeCustomerService.syncCustomerForEmployee = async () => customer;
let moves;
serialTransferController.moveSerialsToBranch = async (args) => { moves.push(args); return 'BT/2026-27/0012'; };
PayrollAuditLog.create = async (doc) => doc;
AuditLog.create = async (doc) => doc;

const { updateEmployee } = require('../controllers/payrollController');

const oid = () => new mongoose.Types.ObjectId();
const nashik = { _id: oid(), name: 'NASHIK' };
const daniPark = { _id: oid(), name: 'DANI PARK' };
const headOffice = { _id: oid(), name: 'HEAD OFFICE' };
const companyId = oid();
const admin = { id: String(oid()), name: 'Super Admin', role: 'admin', companyId: String(companyId) };
const rohit = { _id: oid(), name: 'Rohit Manoj Dixit', employeeId: 'HO811', email: 'rohit@example.com', mobile: '8149609990', companyId };
const laptop = { _id: oid(), serialNumber: 'FTR3Y04', status: 'SOLD', branchId: headOffice._id };

let current;
const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'EmployeeProfile' && query.op === 'findOne') return current;
    if (name === 'EmployeeProfile' && query.op === 'findOneAndUpdate') {
        return EmployeeProfile.hydrate({ ...rohit, ...query.getUpdate().$set });
    }
    if (name === 'Customer' && query.op === 'updateOne') return { matchedCount: 1 };
    if (name === 'Asset' && query.op === 'find') return [laptop];
    if (name === 'Branch' && query.op === 'find') return [headOffice];
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => {
    db.restore();
    employeeUserService.syncUserForEmployee = originals.syncUser;
    engineerSyncService.syncEmployeeToEngineer = originals.syncEngineer;
    employeeCustomerService.syncCustomerForEmployee = originals.syncCustomer;
    serialTransferController.moveSerialsToBranch = originals.move;
    PayrollAuditLog.create = originals.payrollAudit;
    AuditLog.create = originals.audit;
});

beforeEach(() => {
    db.reset();
    moves = [];
    customer = { _id: oid(), branchId: nashik._id };
    current = { ...rohit, branchId: nashik._id, assignedBranches: [nashik._id, daniPark._id, headOffice._id] };
});

const save = async (body) => {
    const res = makeRes();
    await quietly(() => updateEmployee({ user: admin, params: { id: String(rohit._id) }, body, query: {}, headers: {} }, res));
    return res;
};

test('a new home branch moves the employee\'s assets there, and the screen is told', async () => {
    const res = await save({ branchId: String(daniPark._id), assignedBranches: [daniPark._id, nashik._id, headOffice._id].map(String) });

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(moves.length, 1);
    assert.equal(String(moves[0].to._id), String(daniPark._id));
    assert.equal(moves[0].from.name, 'HEAD OFFICE');
    assert.deepEqual(moves[0].assets, [laptop]);
    assert.equal(res.body.assetTransfer.moved, 1);
    assert.equal(res.body.assetTransfer.note, '1 asset moved with them (BT/2026-27/0012).');
    assert.equal(res.body.name, 'Rohit Manoj Dixit', 'the saved employee is still the response');
});

test('the same home branch (other switches changed): no assets move, the response is the employee', async () => {
    const res = await save({ branchId: String(nashik._id), assignedBranches: [nashik._id, daniPark._id].map(String) });

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(moves.length, 0);
    assert.equal(db.queries('Asset').length, 0);
    assert.equal(res.body.assetTransfer, undefined);
});
