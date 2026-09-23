// End-to-end check: a branch-restricted user must not receive other branches' data from the API.
// Creates a temporary Nashik-only user, exercises the API, then deletes it.
require('dotenv').config({ path: require('path').join(__dirname,'..','.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const API = 'http://localhost:4003/api';
const COMPANY = '6a8bf304ac99b5d51a116954';
const NASHIK = '6a8c061fac99b5d51a116b2e';
const USGOAN = '6a927734d38fc49a298a500a';
const EMAIL = 'branch.scope.test@example.invalid';
const PASSWORD = 'BranchTest#2026';

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const User = require('../models/User');
    const opts = { bypassTenant: true };

    await User.deleteMany({ email: EMAIL }).setOptions(opts);
    const created = await User.create([{
        name: 'Branch Scope Test',
        email: EMAIL,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        role: 'employee',
        companyId: COMPANY,
        branchId: NASHIK,
        assignedBranches: [NASHIK],
        isActive: true
    }], { bypassTenant: true });
    console.log('temp user created (Nashik only)\n');

    const call = async (token, path) => {
        const r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
        const body = await r.json().catch(() => ({}));
        return { status: r.status, body };
    };
    const loginAs = async (email, password) => (await fetch(API + '/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    }).then(r => r.json())).accessToken;

    const adminToken = await loginAs('super@gmail.com', '654321');
    const userToken = await loginAs(EMAIL, PASSWORD);
    if (!userToken) { console.log('could not log in as test user'); process.exit(1); }

    const branchesOf = (list) => (Array.isArray(list) ? list : []).map(e => e.branchId?.name || e.branchId?.code || String(e.branchId));

    console.log('GET /payroll/employees');
    for (const [label, token] of [['admin      ', adminToken], ['nashik user', userToken]]) {
        const { status, body } = await call(token, '/payroll/employees?limit=2000');
        const list = body.data || body.employees || (Array.isArray(body) ? body : []);
        const names = [...new Set(branchesOf(list))].sort();
        console.log(`  ${label} -> ${status} ${String(list.length).padStart(4)} employees | branches seen: ${names.join(', ') || '(none)'}`);
    }

    console.log('\nGET /branches (branch switcher)');
    for (const [label, token] of [['admin      ', adminToken], ['nashik user', userToken]]) {
        const { status, body } = await call(token, '/branches');
        const list = Array.isArray(body) ? body : (body.data || []);
        console.log(`  ${label} -> ${status} ${list.map(b => b.name).join(', ')}`);
    }

    console.log('\nDirect attempt to read another branch (?branchId=USGOAN)');
    for (const [label, token] of [['admin      ', adminToken], ['nashik user', userToken]]) {
        const { status, body } = await call(token, `/payroll/employees?limit=2000&branchId=${USGOAN}`);
        const list = body.data || body.employees || (Array.isArray(body) ? body : []);
        const names = [...new Set(branchesOf(list))].sort();
        console.log(`  ${label} -> ${status} ${String(list.length).padStart(4)} employees | branches seen: ${names.join(', ') || '(none)'}`);
    }

    console.log('\nGET /csm/tickets?tab=all');
    for (const [label, token] of [['admin      ', adminToken], ['nashik user', userToken]]) {
        const { status, body } = await call(token, '/csm/tickets?tab=all&limit=50');
        console.log(`  ${label} -> ${status} ${body.pagination ? body.pagination.total : '?'} tickets`);
    }

    await User.deleteMany({ email: EMAIL }).setOptions(opts);
    console.log('\ntemp user deleted:', (await User.countDocuments({ email: EMAIL }).setOptions(opts)) === 0);
    process.exit(0);
})().catch(e => { console.error('failed:', e.message); process.exit(1); });
