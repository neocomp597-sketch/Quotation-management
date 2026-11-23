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

// The current user (customerId) of each matching serial; null for a serial with nobody.
let holders;
// What the database answers to the User count pipeline for those serials.
const runUserCount = (pipeline) => {
    const [filter, ...stages] = pipeline;
    assert.ok(filter.$match, 'the search and filters come first');
    let rows = holders.map((customerId) => ({ customerId }));
    for (const stage of stages) {
        const [op, spec] = Object.entries(stage)[0];
        if (op === '$group') {
            assert.deepEqual(spec, { _id: '$customerId' }, 'grouped by current user');
            rows = [...new Map(rows.map((row) => [String(row.customerId), { _id: row.customerId }])).values()];
        } else if (op === '$match') {
            assert.deepEqual(spec, { _id: { $ne: null } });
            rows = rows.filter((row) => row._id !== null && row._id !== undefined);
        } else if (op === '$count') {
            rows = rows.length ? [{ [spec]: rows.length }] : [];
        } else {
            throw new Error(`unexpected stage ${op}`);
        }
    }
    return rows;
};

const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'Asset' && query.op === 'countDocuments') return 45658;
    if (name === 'Asset' && query.op === 'aggregate') return runUserCount(query.pipeline);
    if (query.op === 'find') return [];
    if (query.op === 'findOne') return null;
    if (query.op === 'distinct') return [];
    if (query.op === 'countDocuments') return 0;
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => db.restore());
beforeEach(() => {
    db.reset();
    // Serials of two users (Rohit holds two), and serials in stock with nobody
    holders = [shraddha, null, rohit, rohit, undefined];
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
    assert.equal(res.body.pagination.userCount, 2, 'serials with nobody are not a user; a user with two serials counts once');
});

test('User count is 0 when no matching serial has a user', async () => {
    holders = [null, undefined];
    const res = await list();
    assert.equal(res.body.pagination.userCount, 0);
});

test('both counts use the same search and filters', async () => {
    await list({ status: 'SOLD', search: 'FTR3Y04', field: 'serial' });
    const [counted] = db.queries('Asset', 'countDocuments');
    const [users] = db.queries('Asset', 'aggregate');
    assert.deepEqual(users.pipeline[0].$match, counted.getFilter());
});

test('User count is an aggregation, which tenantPlugin keeps to the company (Model.distinct is not)', async () => {
    await list();
    assert.equal(db.queries('Asset', 'distinct').length, 0);
    assert.equal(db.queries('Asset', 'aggregate').length, 1);
});
