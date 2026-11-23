// Serial No Transfer > Serial No List shows Asset count and User count (client, 2026-11-19: "Asset
// count: 45678, User count: 1234"): GET /serial-transfers/serials. Run: npm test (node --test)
// The User count's grouping itself (linked customer, else the saved customer name) was checked on a
// real MongoDB; here: it runs as one aggregation with the same filter as the Asset count.
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { install, makeRes, quietly } = require('./helpers/fakeDb');
const { listSerials } = require('../controllers/serialTransferController');

const oid = () => new mongoose.Types.ObjectId();
const companyId = oid();
const admin = { id: String(oid()), name: 'Super Admin', role: 'admin', companyId: String(companyId) };

let users;
const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'Asset' && query.op === 'countDocuments') return 45658;
    if (name === 'Asset' && query.op === 'aggregate') return users === null ? [] : [{ count: users }];
    if (query.op === 'find') return [];
    if (query.op === 'findOne') return null;
    if (query.op === 'distinct') return [];
    if (query.op === 'countDocuments') return 0;
    if (query.op === 'aggregate') return [];
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => db.restore());
beforeEach(() => {
    db.reset();
    users = 1234;
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
    assert.equal(res.body.pagination.userCount, 1234);
});

test('no serial with a user: User count 0', async () => {
    users = null;
    const res = await list();
    assert.equal(res.body.pagination.userCount, 0);
});

test('users are counted by linked customer, else by the customer name saved on the serial', async () => {
    await list();
    const [users] = db.queries('Asset', 'aggregate');
    const group = users.pipeline.find((stage) => stage.$group).$group;
    assert.deepEqual(group._id.$ifNull[0], '$customerId');
    assert.match(JSON.stringify(group._id.$ifNull[1]), /customerNameStr/);
    const empty = users.pipeline.find((stage) => stage.$match && stage.$match._id);
    assert.deepEqual(empty.$match._id.$nin, [null, ''], 'serials with nobody are not a user');
});

test('both counts use the same search and filters', async () => {
    await list({ status: 'SOLD', search: 'FTR3Y04', field: 'serial' });
    const [counted] = db.queries('Asset', 'countDocuments');
    const [users] = db.queries('Asset', 'aggregate');
    const counter = mongoose.model('Asset').find();
    assert.deepEqual(users.pipeline[0].$match, counter.cast(mongoose.model('Asset'), counted.getFilter()));
});
