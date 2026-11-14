// Field Service Visits API (controllers/serviceVisitController.js). Runs the real controller and
// Mongoose model; only the database round trip (Query#exec) is replaced, so each test sees the
// query the controller built and decides what the database returns.
// Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const ServiceVisit = require('../models/ServiceVisit');
const controller = require('../controllers/serviceVisitController');

const MEDIA_FIELDS = ['productPhoto', 'customerSignature', 'completionHistory'];

let executed = [];
let dbResults = [];
const realExec = mongoose.Query.prototype.exec;
mongoose.Query.prototype.exec = async function fakeExec() {
    executed.push(this);
    const result = dbResults.shift();
    if (result instanceof Error) throw result;
    return result;
};
after(() => { mongoose.Query.prototype.exec = realExec; });

beforeEach(() => {
    executed = [];
    dbResults = [];
});

const companyId = new mongoose.Types.ObjectId();
// An administrator: not limited by MGR access, so listing visits needs no other query.
const adminReq = (extra = {}) => ({
    user: { id: new mongoose.Types.ObjectId().toString(), role: 'admin', companyId },
    query: {},
    params: {},
    ...extra
});

const makeRes = () => ({
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

const visitQueries = (op) => executed.filter((q) => q.model.modelName === 'ServiceVisit' && q.op === op);

// The projection MongoDB receives. Query#projection() still holds what select() was given
// ('-productPhoto'); Mongoose turns that into { productPhoto: 0 } when it runs the query.
const sentProjection = (query) => query._optionsForExec(query.model).projection || {};

test('the fields the visits list leaves out exist on the visit (a rename would silently send them again)', () => {
    for (const field of MEDIA_FIELDS) {
        assert.ok(ServiceVisit.schema.path(field), `ServiceVisit has no field ${field}`);
    }
});

test('GET /csm/visits leaves out the product photo, signature and re-open snapshots', async () => {
    const rows = [{ _id: 'v1', visitNo: 'VST-2026-0001', status: 'Completed' }];
    dbResults = [rows];
    const res = makeRes();

    await controller.getVisits(adminReq(), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, rows);

    const [query] = visitQueries('find');
    assert.ok(query, 'no ServiceVisit.find was run');
    const projection = sentProjection(query);
    for (const field of MEDIA_FIELDS) {
        assert.equal(projection[field], 0, `${field} is not excluded from the list`);
    }
    // Only those: the list still has every other field (visit no, status, dates, expenses...)
    assert.deepEqual(Object.keys(projection).sort(), [...MEDIA_FIELDS].sort());
});

test('GET /csm/visits keeps its filter, populates, order and lean result', async () => {
    dbResults = [[]];
    const req = adminReq({ query: { status: 'Scheduled' } });

    await controller.getVisits(req, makeRes());

    const [query] = visitQueries('find');
    assert.deepEqual(query.getFilter(), { companyId, status: 'Scheduled' });
    assert.deepEqual(Object.keys(query._mongooseOptions.populate).sort(), ['branchId', 'engineerId', 'ticketId']);
    assert.deepEqual(query.getOptions().sort, { scheduledDate: -1 });
    assert.equal(query._mongooseOptions.lean, true);
});

test('GET /csm/visits answers a failed query with a message the page can show', async () => {
    dbResults = [new Error('connection reset')];
    const res = makeRes();
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
        await controller.getVisits(adminReq(), res);
    } finally {
        console.error = originalConsoleError;
    }

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'connection reset');
});

test('GET /csm/visits/:id still returns the photo and signature of the visit', async () => {
    const id = new mongoose.Types.ObjectId();
    const visit = {
        _id: id,
        status: 'Completed',
        productPhoto: 'https://storage.example/photo.jpg',
        customerSignature: 'data:image/png;base64,AAAA'
    };
    dbResults = [visit];
    const res = makeRes();

    await controller.getVisitById(adminReq({ params: { id: String(id) } }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.productPhoto, visit.productPhoto);
    assert.equal(res.body.customerSignature, visit.customerSignature);

    const [query] = visitQueries('findOne');
    const projection = sentProjection(query);
    for (const field of ['productPhoto', 'customerSignature']) {
        assert.equal(projection[field], undefined, `${field} is excluded from the visit details`);
    }
    assert.deepEqual(query.getFilter(), { _id: String(id), companyId });
});

test('GET /csm/visits/:id answers 404 for a visit that does not exist', async () => {
    dbResults = [null];
    const res = makeRes();

    await controller.getVisitById(adminReq({ params: { id: String(new mongoose.Types.ObjectId()) } }), res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Service visit not found');
});
