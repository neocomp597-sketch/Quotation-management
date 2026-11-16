// moveSerialsToBranch (controllers/serialTransferController.js): one Branch Transfer of serial
// numbers, used by Serial No Transfer > Branch Transfer and by an employee's Branch Transfer.
// Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { install } = require('./helpers/fakeDb');
const SerialBranchTransfer = require('../models/SerialBranchTransfer');
const { moveSerialsToBranch } = require('../controllers/serialTransferController');

const oid = () => new mongoose.Types.ObjectId();

// Transactions need a replica set: a stand-in session runs the work once, and is checked to be passed on
const session = { id: 'fake-session', ended: false, withTransaction: async (work) => work(), endSession: async () => { session.ended = true; } };
const realStartSession = mongoose.startSession;
mongoose.startSession = async () => session;
let inserted = [];
const realInsertMany = SerialBranchTransfer.insertMany;
SerialBranchTransfer.insertMany = async (docs, options) => {
    assert.equal(options.session, session);
    inserted.push(...docs);
    return docs;
};

let assetsStillThere;
const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'Counter' && query.op === 'findOneAndUpdate') return { seq: 7 };
    if (name === 'Asset' && query.op === 'updateMany') return { matchedCount: assetsStillThere, modifiedCount: assetsStillThere };
    if (['SerialTransfer', 'AssetHistory'].includes(name) && query.op === 'updateMany') return { matchedCount: 0 };
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => {
    db.restore();
    mongoose.startSession = realStartSession;
    SerialBranchTransfer.insertMany = realInsertMany;
});

const companyId = oid();
const from = { _id: oid(), name: 'NASHIK' };
const to = { _id: oid(), name: 'USGOAN' };
const assets = ['PF5ZDTWT', 'PG05B2TX-CPU'].map((serialNumber) => ({
    _id: oid(), serialNumber, productId: oid(), productCode: 'P1', productName: 'Laptop', status: 'ALLOCATED'
}));
const move = () => moveSerialsToBranch({
    companyId, assets, from, to, reference: 'Employee transfer: Apeksha Mohite (HO774)', remarks: 'moved', user: { id: 'u1', name: 'Rajshri Jadhav' }
});

beforeEach(() => {
    db.reset();
    inserted = [];
    session.ended = false;
    assetsStillThere = assets.length;
});

test('moves the serials still in the source branch, with one BT number', async () => {
    const transferNo = await move();

    assert.match(transferNo, /^BT\/\d{4}-\d{2}\/0007$/);
    const [assetMove] = db.queries('Asset', 'updateMany');
    assert.deepEqual(assetMove.getFilter(), { _id: { $in: assets.map((a) => a._id) }, companyId, branchId: from._id });
    assert.deepEqual(assetMove.getUpdate(), { $set: { branchId: to._id } });
    // Mongoose copies a plain options object, so the stand-in session is compared by its id
    assert.equal(assetMove.getOptions().session?.id, session.id, 'runs in the transaction');
    // Works whatever branch the request is working in
    assert.equal(assetMove.getOptions().bypassBranch, true);
    assert.equal(session.ended, true);
});

test('their transfer history and asset history follow the serials', async () => {
    await move();
    for (const model of ['SerialTransfer', 'AssetHistory']) {
        const [query] = db.queries(model, 'updateMany');
        assert.deepEqual(query.getFilter(), { assetId: { $in: assets.map((a) => a._id) } }, model);
        assert.deepEqual(query.getUpdate(), { $set: { branchId: to._id } }, model);
        assert.equal(query.getOptions().bypassBranch, true, model);
    }
});

test('each serial gets a Branch Transfer line', async () => {
    const transferNo = await move();
    assert.equal(inserted.length, 2);
    assert.deepEqual(
        inserted.map(({ transferNo: no, serialNumber, serialKey, fromBranchName, toBranchName, reference, createdByName, status }) => ({ no, serialNumber, serialKey, fromBranchName, toBranchName, reference, createdByName, status })),
        assets.map((asset) => ({
            no: transferNo,
            serialNumber: asset.serialNumber,
            serialKey: asset.serialNumber.toUpperCase(),
            fromBranchName: 'NASHIK',
            toBranchName: 'USGOAN',
            reference: 'Employee transfer: Apeksha Mohite (HO774)',
            createdByName: 'Rajshri Jadhav',
            status: 'ALLOCATED'
        }))
    );
});

test('a serial moved meanwhile by someone else: 409 and no Branch Transfer lines', async () => {
    assetsStillThere = 1;
    await assert.rejects(move(), (error) => error.status === 409);
    assert.equal(inserted.length, 0);
    assert.equal(session.ended, true, 'the session is closed after a failure too');
});
