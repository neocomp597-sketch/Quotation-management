// Serial No Transfer > Serial No List shows Asset count and User count (client, 2026-11-19: "Asset
// count: 45678, User count: 1234"): GET /serial-transfers/serials. Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { install, makeRes, quietly } = require('./helpers/fakeDb');
const { listSerials } = require('../controllers/serialTransferController');

const oid = () => new mongoose.Types.ObjectId();
const companyId = oid();
const admin = { id: String(oid()), name: 'Super Admin', role: 'admin', companyId: String(companyId) };
const shraddha = oid();
const rohit = oid();

let holders;
const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'Asset' && query.op === 'countDocuments') return 45658;
    if (name === 'Asset' && query.op === 'distinct') return holders;
    if (query.op === 'find') return [];
    if (query.op === 'findOne') return null;
    if (query.op === 'distinct') return [];
    if (query.op === 'countDocuments') return 0;
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => db.restore());
beforeEach(() => {
    db.reset();
    // Serials of two users, and serials in stock with nobody
    holders = [shraddha, null, rohit];
});

const list = async (query = {}) => {
    const res = makeRes();
    await quietly(() => listSerials({ user: admin, query, headers: {}, params: {} }, res));
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    return res;
};

test('User count: the different current users of the serials, beside the Asset count', async () => {
    const res = await list();
    assert.equal(res.body.pagination.total, 45658);
    assert.equal(res.body.pagination.userCount, 2, 'serials with nobody are not a user');
});

test('both counts use the same search and filters', async () => {
    await list({ status: 'SOLD', search: 'FTR3Y04', field: 'serial' });
    const [counted] = db.queries('Asset', 'countDocuments');
    const [users] = db.queries('Asset', 'distinct');
    assert.equal(users._distinct, 'customerId', 'counted by current user');
    assert.deepEqual(users.getFilter(), counted.getFilter());
});
