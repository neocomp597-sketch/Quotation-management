// Own Assets (controllers/ownAssetController.js): the lists of company items held by the user, their
// reporting manager and their team, and who may do what on them. Run: npm test (node --test)
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { install, makeRes } = require('./helpers/fakeDb');
const ownAssets = require('../controllers/ownAssetController');
const { OWN_ASSET_VIEWS } = require('../config/ownAssetViews');
const { resolvePermissions } = require('../config/authorization');
const { getApiRequirement } = require('../config/apiPermissions');

const oid = () => new mongoose.Types.ObjectId();
const companyId = oid();
const person = (name, reportingTo = null, extra = {}) => ({ _id: oid(), name, employeeId: '', reportingTo, status: 'Active', companyId, ...extra });

// Head -> (vacant position) -> Rohit -> Sneha -> Vikas; Pooja reports to a vacant position under Rohit.
const head = person('Amit Kulkarni');
const vacantAbove = person('Vacant', head._id, { isVacant: true, status: 'Vacant' });
const rohit = person('Rohit Dixit', vacantAbove._id, { email: 'rohit@example.com' });
const sneha = person('Sneha Patil', rohit._id);
const vikas = person('Vikas Joshi', sneha._id, { status: 'Resigned' });
const vacantBelow = person('Vacant', rohit._id, { isVacant: true, status: 'Vacant' });
const pooja = person('Pooja Deshmukh', vacantBelow._id);
const employees = [head, vacantAbove, rohit, sneha, vikas, vacantBelow, pooja];

const customerOf = new Map(employees.filter((e) => !e.isVacant).map((e) => [String(e._id), { _id: oid(), employeeProfileId: e._id }]));
const item = (serialNumber, holder) => ({ _id: oid(), serialNumber, status: 'SOLD', customerId: customerOf.get(String(holder._id))._id, productId: { _id: oid(), productCode: 'LAP', productName: 'Laptop' }, saleDate: new Date('2026-04-01') });
const items = [item('SN-M1001', head), item('SN-U2001', rohit), item('SN-T3001', sneha), item('SN-T3002', vikas), item('SN-T3003', pooja)];
const handedOver = new Date('2026-11-20T10:00:00Z');

let login;
const db = install((query) => {
    const name = query.model.modelName;
    const filter = query.getFilter();
    if (name === 'User' && query.op === 'findOne') return login;
    if (name === 'EmployeeProfile' && query.op === 'find') return employees;
    if (name === 'Customer' && query.op === 'find') {
        const ids = filter.employeeProfileId.$in.map(String);
        return [...customerOf.values()].filter((customer) => ids.includes(String(customer.employeeProfileId)));
    }
    if (name === 'Asset' && query.op === 'find') {
        const ids = filter.customerId.$in.map(String);
        return items.filter((asset) => ids.includes(String(asset.customerId)));
    }
    if (name === 'SerialTransfer' && query.op === 'find') {
        return [{ assetId: items[2]._id, transferDate: handedOver }];
    }
    return new Error(`unexpected query ${name}.${query.op}`);
});
after(() => db.restore());

beforeEach(() => {
    db.reset();
    login = { _id: oid(), employeeProfileId: rohit._id, email: 'rohit@example.com' };
});

const list = async (view) => {
    const res = makeRes();
    const req = { user: { id: String(login._id), name: 'Rohit Dixit', email: login.email, companyId }, ownView: OWN_ASSET_VIEWS[view], params: {}, query: {}, body: {} };
    await ownAssets.list(req, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    return res.body;
};
const serials = (body) => body.data.map((row) => row.serialNumber);

test('My Assets lists the items the user holds', async () => {
    const body = await list('mine');
    assert.equal(body.me.name, 'Rohit Dixit');
    assert.deepEqual(serials(body), ['SN-U2001']);
    assert.equal(body.data[0].holder.name, 'Rohit Dixit');
    assert.equal(body.message, '');
});

test('Manager Assets passes over a vacant position to the nearest person above', async () => {
    const body = await list('manager');
    assert.equal(body.manager.name, 'Amit Kulkarni');
    assert.deepEqual(serials(body), ['SN-M1001']);
});

test('My Team Assets covers everyone below, also under vacant positions, and resigned people still holding items', async () => {
    const body = await list('team');
    assert.deepEqual(body.holders.map((p) => p.name), ['Pooja Deshmukh', 'Sneha Patil', 'Vikas Joshi']);
    assert.deepEqual(serials(body), ['SN-T3003', 'SN-T3001', 'SN-T3002']);
    assert.equal(body.data.find((row) => row.serialNumber === 'SN-T3002').holder.status, 'Resigned');
});

test('Since is when the item reached its holder, else its invoice date', async () => {
    const body = await list('team');
    assert.equal(body.data.find((row) => row.serialNumber === 'SN-T3001').since.getTime(), handedOver.getTime());
    assert.equal(body.data.find((row) => row.serialNumber === 'SN-T3003').since.toISOString(), '2026-04-01T00:00:00.000Z');
});

test('items can be handed to the user, their manager and their team only', async () => {
    const body = await list('mine');
    assert.deepEqual(body.circle.map((p) => [p.name, p.relation]), [
        ['Rohit Dixit', 'me'], ['Amit Kulkarni', 'manager'], ['Pooja Deshmukh', 'team'], ['Sneha Patil', 'team'], ['Vikas Joshi', 'team']
    ]);
});

test('a login not linked to an employee is found by its email', async () => {
    login = { _id: oid(), employeeProfileId: null, email: 'ROHIT@example.com' };
    const body = await list('mine');
    assert.equal(body.me.name, 'Rohit Dixit');
});

test('a login that is no employee sees no items and why', async () => {
    login = { _id: oid(), employeeProfileId: null, email: 'admin@example.com' };
    const body = await list('team');
    assert.equal(body.me, null);
    assert.deepEqual(body.data, []);
    assert.match(body.message, /not linked to an employee/);
    assert.equal(db.queries('Asset', 'find').length, 0);
});

test('nobody above or below is explained', async () => {
    login = { _id: oid(), employeeProfileId: head._id };
    assert.match((await list('manager')).message, /No reporting manager is set for Amit Kulkarni/);
    login = { _id: oid(), employeeProfileId: pooja._id };
    assert.match((await list('team')).message, /Nobody reports to Pooja Deshmukh/);
});

test('an unknown list is answered 404', () => {
    const res = makeRes();
    let passed = false;
    ownAssets.loadView({}, res, () => { passed = true; }, 'everyone');
    assert.equal(passed, false);
    assert.equal(res.statusCode, 404);
});

test('every role sees the three lists; adding, editing and taking back start with admin only', () => {
    for (const role of ['manager', 'sales', 'employee']) {
        const permissions = resolvePermissions(role, {});
        for (const key of ['own_assets_mine', 'own_assets_manager', 'own_assets_team']) {
            assert.equal(permissions[key], true, `${role} ${key}`);
            for (const action of ['create', 'modify', 'delete']) assert.equal(permissions[`${key}:${action}`], false, `${role} ${key}:${action}`);
        }
    }
    const admin = resolvePermissions('admin', {});
    assert.equal(admin['own_assets_team:delete'], true);
    // An action an admin ticked for a role is kept.
    assert.equal(resolvePermissions('manager', { own_assets_team: true, 'own_assets_team:create': true })['own_assets_team:create'], true);
});

test('each request needs the screen and action of its own list', async () => {
    const need = async (method, url) => (await getApiRequirement({ method, originalUrl: url })).anyOf;
    assert.deepEqual(await need('GET', '/api/own-assets/team'), [['own_assets_team', 'view']]);
    assert.deepEqual(await need('GET', '/api/own-assets/mine/assignable?search=x'), [['own_assets_mine', 'create']]);
    assert.deepEqual(await need('POST', '/api/own-assets/manager/assign'), [['own_assets_manager', 'create']]);
    assert.deepEqual(await need('PUT', `/api/own-assets/team/${oid()}`), [['own_assets_team', 'modify']]);
    assert.deepEqual(await need('POST', `/api/own-assets/mine/${oid()}/return`), [['own_assets_mine', 'delete']]);
    assert.deepEqual(await need('GET', `/api/own-assets/manager/${oid()}/log`), [['own_assets_manager', 'view']]);
});
