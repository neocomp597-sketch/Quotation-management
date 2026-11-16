// A user given another role gets that role's permissions (client, 2026-11-16: "I created Default
// Role Permissions and updated the user's role, but the user still shows the earlier access").
// PATCH /users/:id/role and PUT /users/:id. Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const mongoose = require('mongoose');
const { install, makeRes, quietly } = require('./helpers/fakeDb');

// Password hashing is not used by a role change; a stand-in keeps the test independent of how
// bcryptjs is installed.
const bcryptPath = require.resolve('bcryptjs');
const bcryptStub = new Module(bcryptPath);
Object.assign(bcryptStub, { filename: bcryptPath, loaded: true, exports: { genSalt: async () => '', hash: async () => '', compare: async () => false } });
require.cache[bcryptPath] = bcryptStub;

// Recorded instead of done: the signed-in user's cache drop, saves and audit entries
const authMiddleware = require('../middlewares/authMiddleware');
const realInvalidate = authMiddleware.invalidateAuthUserCache;
let invalidated = [];
authMiddleware.invalidateAuthUserCache = async (userId) => { invalidated.push(userId); };
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const realAudit = AuditLog.create;
const realSave = User.prototype.save;
let audits = [];
let saved = [];
AuditLog.create = async (doc) => { audits.push(doc); return doc; };
User.prototype.save = async function fakeSave() { saved.push(this); return this; };

const userController = require('../controllers/userController');

const oid = () => new mongoose.Types.ObjectId();
const companyId = oid();
const admin = { id: String(oid()), name: 'Rajshri Jadhav', role: 'admin', companyId: String(companyId) };
let user;
const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'RolePermission' && query.op === 'findOne') return { _id: oid() }; // the custom role exists
    if (name === 'User' && query.op === 'findOne') return user;
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => {
    db.restore();
    authMiddleware.invalidateAuthUserCache = realInvalidate;
    AuditLog.create = realAudit;
    User.prototype.save = realSave;
    delete require.cache[bcryptPath];
});

beforeEach(() => {
    db.reset();
    invalidated = [];
    audits = [];
    saved = [];
    // A user whose access had been changed by hand while they were an employee
    user = User.hydrate({
        _id: oid(),
        name: 'Om Wagh',
        email: 'om@example.com',
        role: 'employee',
        companyId,
        customPermissions: { quotations: true, 'quotations:create': true }
    });
});

const changeRole = async (role) => {
    const res = makeRes();
    await quietly(() => userController.updateUserRole({ user: admin, params: { id: String(user._id) }, body: { role }, query: {}, headers: {} }, res));
    return res;
};

test('PATCH /users/:id/role: the new role\'s permissions apply, the old individual ones are removed', async () => {
    const res = await changeRole('it_infra');

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].role, 'it_infra');
    assert.equal(saved[0].customPermissions.size, 0);
    assert.equal(String(saved[0].customPermissionsUpdatedBy), admin.id);
    assert.ok(saved[0].customPermissionsUpdatedAt instanceof Date);
    assert.deepEqual(res.body.customPermissions, {});
    assert.equal(res.body.removedPermissions, 2);
});

test('the change reaches the user at once and is in the audit log', async () => {
    await changeRole('it_infra');

    assert.deepEqual(invalidated, [String(user._id)], 'protect\'s cached copy of the user is dropped');
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'USER_ROLE_CHANGED');
    assert.deepEqual(audits[0].oldValue, { role: 'employee', individualPermissions: 2 });
    assert.deepEqual(audits[0].newValue, { role: 'it_infra', individualPermissions: 0 });
    assert.match(audits[0].reason, /2 individual permissions removed/);
});

test('saving the same role again keeps the individual permissions', async () => {
    const res = await changeRole('employee');

    assert.equal(res.statusCode, 200);
    assert.equal(saved[0].customPermissions.size, 2);
    assert.equal(res.body.removedPermissions, 0);
    assert.deepEqual(invalidated, []);
    assert.equal(audits.length, 0);
});

test('a user without individual permissions just changes role', async () => {
    user.customPermissions = {};
    const res = await changeRole('it_infra');

    assert.equal(saved[0].role, 'it_infra');
    assert.equal(saved[0].customPermissionsUpdatedAt ?? null, null, 'nothing to remove, nothing recorded as removed');
    assert.equal(res.body.removedPermissions, 0);
    assert.deepEqual(invalidated, [String(user._id)]);
});

test('PUT /users/:id (Edit User) with another role does the same', async () => {
    const res = makeRes();
    await quietly(() => userController.updateUser({ user: admin, params: { id: String(user._id) }, body: { role: 'it_infra' }, query: {}, headers: {} }, res));

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(saved[0].role, 'it_infra');
    assert.equal(saved[0].customPermissions.size, 0);
    assert.deepEqual(invalidated, [String(user._id)]);
    assert.equal(audits[0]?.action, 'USER_ROLE_CHANGED');
});
