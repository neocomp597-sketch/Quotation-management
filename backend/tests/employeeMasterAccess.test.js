// Employee Master follows Authorization > Employees & Master (client, 2026-11-17: "I gave IT INFRA
// Create and Delete access, but the error still comes": the server let only an administrator add,
// open, edit or delete an employee). Salary stays with administrators. Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const mongoose = require('mongoose');
const { install, makeRes, quietly } = require('./helpers/fakeDb');

// Password hashing is not used here; a stand-in keeps the test independent of how bcryptjs is installed
const bcryptPath = require.resolve('bcryptjs');
const bcryptStub = new Module(bcryptPath);
Object.assign(bcryptStub, { filename: bcryptPath, loaded: true, exports: { genSalt: async () => '', hash: async () => '', compare: async () => false } });
require.cache[bcryptPath] = bcryptStub;

// The routes are read from a stand-in for express.Router, which records each route and its handlers
const expressPath = require.resolve('express');
const routes = [];
const fakeRouter = () => {
    const router = { use: () => router };
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        router[method] = (path, ...handlers) => { routes.push({ method, path, handlers }); return router; };
    }
    return router;
};
const expressStub = new Module(expressPath);
Object.assign(expressStub, { filename: expressPath, loaded: true, exports: Object.assign(() => fakeRouter(), { Router: fakeRouter }) });
const realExpress = require.cache[expressPath];
require.cache[expressPath] = expressStub;

const employeeUserService = require('../services/employeeUserService');
const engineerSyncService = require('../services/engineerSyncService');
const employeeCustomerService = require('../services/employeeCustomerService');
const PayrollAuditLog = require('../models/PayrollAuditLog');
const EmployeeProfile = require('../models/EmployeeProfile');
const originals = {
    syncUser: employeeUserService.syncUserForEmployee,
    syncEngineer: engineerSyncService.syncEmployeeToEngineer,
    syncCustomer: employeeCustomerService.syncCustomerForEmployee,
    payrollAudit: PayrollAuditLog.create
};
employeeUserService.syncUserForEmployee = async () => null;
engineerSyncService.syncEmployeeToEngineer = async () => null;
employeeCustomerService.syncCustomerForEmployee = async () => null;
PayrollAuditLog.create = async (doc) => doc;

require('../routes/payrollRoutes');
const { getApiRequirement } = require('../config/apiPermissions');
const { updateEmployee } = require('../controllers/payrollController');

const oid = () => new mongoose.Types.ObjectId();
const companyId = oid();
const employee = { _id: oid(), name: 'Om Wagh', email: 'om@example.com', mobile: '9876543210', companyId };

const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'EmployeeProfile' && query.op === 'findOne') return { ...employee };
    if (name === 'EmployeeProfile' && query.op === 'findOneAndUpdate') return EmployeeProfile.hydrate({ ...employee, ...query.getUpdate().$set });
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => {
    db.restore();
    employeeUserService.syncUserForEmployee = originals.syncUser;
    engineerSyncService.syncEmployeeToEngineer = originals.syncEngineer;
    employeeCustomerService.syncCustomerForEmployee = originals.syncCustomer;
    PayrollAuditLog.create = originals.payrollAudit;
    delete require.cache[bcryptPath];
    if (realExpress) require.cache[expressPath] = realExpress; else delete require.cache[expressPath];
});
beforeEach(() => db.reset());

// The handlers a route of the payroll router runs, by function name
const handlersOf = (method, path) => {
    const route = routes.find((r) => r.method === method && r.path === path);
    assert.ok(route, `${method.toUpperCase()} ${path} exists`);
    return route.handlers.map((handler) => handler.name);
};

test('adding, opening, editing and deleting an employee is not limited to administrators', () => {
    assert.ok(!handlersOf('post', '/employees').includes('checkAdmin'));
    assert.ok(!handlersOf('get', '/employees/:id').includes('checkAdmin'));
    assert.ok(!handlersOf('put', '/employees/:id').includes('checkAdmin'));
    assert.ok(!handlersOf('delete', '/employees/:id').includes('checkAdmin'));
});

test('salary, settings and payroll runs stay with administrators', () => {
    assert.ok(handlersOf('put', '/employees/:id/structure').includes('checkAdmin'));
    assert.ok(handlersOf('put', '/settings').includes('checkAdmin'));
    assert.ok(handlersOf('post', '/runs').includes('checkAdmin'));
});

test('the Employees & Master switches decide: Create to add, Modify to edit, Delete to delete', async () => {
    const need = async (method, url) => (await getApiRequirement({ method, originalUrl: url })).anyOf;
    const id = String(oid());
    assert.deepEqual(await need('POST', '/api/payroll/employees'), [['payroll_employees', 'create']]);
    assert.deepEqual(await need('PUT', `/api/payroll/employees/${id}`), [['payroll_employees', 'modify']]);
    assert.deepEqual(await need('DELETE', `/api/payroll/employees/${id}`), [['payroll_employees', 'delete']]);
});

const save = async (user) => {
    const res = makeRes();
    const body = { name: 'Om Wagh', designation: 'IT Executive', salaryStructure: { basic: 99999 } };
    await quietly(() => updateEmployee({ user, params: { id: String(employee._id) }, body, query: {}, headers: {} }, res));
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    return db.queries('EmployeeProfile', 'findOneAndUpdate')[0].getUpdate().$set;
};

test('an IT INFRA user\'s edit saves the profile but not the salary', async () => {
    const saved = await save({ id: String(oid()), role: 'it_infra', companyId: String(companyId) });
    assert.equal(saved.designation, 'IT Executive');
    assert.equal(saved.salaryStructure, undefined);
});

test('an administrator\'s edit still saves the salary', async () => {
    const saved = await save({ id: String(oid()), role: 'admin', companyId: String(companyId) });
    assert.deepEqual(saved.salaryStructure, { basic: 99999 });
});
