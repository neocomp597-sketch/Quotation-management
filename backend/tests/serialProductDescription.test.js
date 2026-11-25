const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { install, makeRes, quietly } = require('./helpers/fakeDb');
const { listSerials, getSerial } = require('../controllers/serialTransferController');

const oid = () => new mongoose.Types.ObjectId();
const companyId = oid();
const admin = { id: String(oid()), name: 'Super Admin', role: 'admin', companyId: String(companyId) };

const masterLaptop = {
    _id: oid(),
    productCode: 'Laptop',
    productName: 'Laptop',
    description: 'Laptop'
};

let assetRows = [];
let singleAsset = null;
let masterProducts = [masterLaptop];

const db = install((query) => {
    const name = query.model.modelName;
    if (name === 'Asset' && query.op === 'find') return assetRows;
    if (name === 'Asset' && query.op === 'findOne') return singleAsset;
    if (name === 'Asset' && query.op === 'countDocuments') return assetRows.length;
    if (name === 'Asset' && query.op === 'aggregate') return [{ count: assetRows.length }];
    if (name === 'Product' && query.op === 'find') return masterProducts;
    if (name === 'SerialTransfer' && query.op === 'find') return [];
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
    masterProducts = [masterLaptop];
    assetRows = [
        {
            _id: oid(),
            serialNumber: 'DX000KGA',
            productId: masterLaptop,
            productCode: 'Laptop',
            productName: 'Laptop',
            status: 'ALLOCATED'
        },
        {
            _id: oid(),
            serialNumber: 'HN5ZBB4',
            productId: null,
            productCode: 'laptop',
            productName: 'laptop',
            status: 'ALLOCATED'
        },
        {
            _id: oid(),
            serialNumber: 'UNKNOWN1',
            productId: null,
            productCode: 'OTHER',
            productName: '',
            status: 'IN_STOCK'
        }
    ];
    singleAsset = assetRows[1];
});

test('listSerials links unlinked serials to Product Master by case-insensitive productCode', async () => {
    const res = makeRes();
    await quietly(() => listSerials({ user: admin, query: {}, headers: {}, params: {} }, res));
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));

    const [linked, unlinkedSameProduct, unknown] = res.body.data;
    assert.equal(linked.productCode, 'Laptop');
    assert.equal(linked.productDescription, 'Laptop');

    assert.equal(unlinkedSameProduct.productCode, 'Laptop');
    assert.equal(unlinkedSameProduct.productName, 'Laptop');
    assert.equal(unlinkedSameProduct.productDescription, 'Laptop');

    assert.equal(unknown.productCode, 'OTHER');
    assert.equal(unknown.productDescription, '');
});

test('getSerial links unlinked serial to Product Master by case-insensitive productCode', async () => {
    const res = makeRes();
    await quietly(() => getSerial({ user: admin, query: {}, headers: {}, params: { assetId: String(singleAsset._id) } }, res));
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.asset.productCode, 'Laptop');
    assert.equal(res.body.asset.productName, 'Laptop');
    assert.equal(res.body.asset.productDescription, 'Laptop');
});
