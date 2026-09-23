/**
 * End-to-end test for branch-wise data access.
 *
 * Creates temporary users (single-branch and multi-branch), calls the real HTTP API
 * as each of them, and asserts they only receive data for their assigned branches.
 * The temporary users are always deleted again.
 *
 * Requires the API to be running (default http://localhost:4003).
 * Usage: node scripts/testBranchAccess.js
 */
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Credentials are never stored in this file. Supply them when running the test:
//   TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... node scripts/testBranchAccess.js
const API = process.env.TEST_API_URL || 'http://localhost:4003/api';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

const COMPANY = '6a8bf304ac99b5d51a116954'; // Stelmec
const BRANCH = {
    NASHIK: '6a8c061fac99b5d51a116b2e',
    USGOAN: '6a927734d38fc49a298a500a',
    SATIVALI: '6a927827d38fc49a298a5028'
};
// Throwaway password for the temporary accounts, regenerated on every run.
const PASSWORD = `Aa1!${crypto.randomBytes(18).toString('hex')}`;
const TEST_EMAILS = ['branch.single.test@example.invalid', 'branch.multi.test@example.invalid'];

const results = [];
const check = (label, passed, detail = '') => {
    results.push({ label, passed });
    console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? '  (' + detail + ')' : ''}`);
};

const login = async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    return body.accessToken;
};

const get = async (token, path) => {
    const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
    return { status: res.status, body: await res.json().catch(() => ({})) };
};

const employeeBranches = (body) => {
    const list = body.data || body.employees || (Array.isArray(body) ? body : []);
    return { count: list.length, branches: [...new Set(list.map(e => e.branchId?.name || '(none)'))].sort() };
};

const createUser = async (User, email, branchIds) => {
    await User.deleteMany({ email }).setOptions({ bypassTenant: true });
    await User.create([{
        name: 'Branch Access Test',
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        role: 'employee',
        companyId: COMPANY,
        branchId: branchIds[0],
        assignedBranches: branchIds,
        isActive: true
    }], { bypassTenant: true });
};

(async () => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        console.error('Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD before running this test.');
        console.error('Example: TEST_ADMIN_EMAIL=admin@example.com TEST_ADMIN_PASSWORD=secret node scripts/testBranchAccess.js');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    const User = require('../models/User');

    try {
        const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
        if (!adminToken) throw new Error(`could not log in as ${ADMIN_EMAIL}`);

        await createUser(User, TEST_EMAILS[0], [BRANCH.NASHIK]);
        await createUser(User, TEST_EMAILS[1], [BRANCH.NASHIK, BRANCH.USGOAN]);
        const singleToken = await login(TEST_EMAILS[0], PASSWORD);
        const multiToken = await login(TEST_EMAILS[1], PASSWORD);
        if (!singleToken || !multiToken) throw new Error('could not log in as the test users');

        const admin = employeeBranches((await get(adminToken, '/payroll/employees?limit=2000')).body);
        const single = employeeBranches((await get(singleToken, '/payroll/employees?limit=2000')).body);
        const multi = employeeBranches((await get(multiToken, '/payroll/employees?limit=2000')).body);

        console.log('\n1. Employee list, by who is asking');
        console.log(`     admin        ${String(admin.count).padStart(4)} employees | ${admin.branches.join(', ')}`);
        console.log(`     1 branch     ${String(single.count).padStart(4)} employees | ${single.branches.join(', ')}`);
        console.log(`     2 branches   ${String(multi.count).padStart(4)} employees | ${multi.branches.join(', ')}`);
        check('admin still sees every branch', admin.branches.length > 3);
        check('single-branch user sees only NASHIK', single.branches.join() === 'NASHIK');
        check('multi-branch user sees exactly NASHIK + USGOAN', multi.branches.join() === 'NASHIK,USGOAN');
        check('multi-branch user sees more than single-branch user', multi.count > single.count);
        check('multi-branch user still sees less than admin', multi.count < admin.count);

        console.log('\n2. Forcing another branch through the API (?branchId=SATIVALI)');
        for (const [label, token, expectZero] of [['admin', adminToken, false], ['1 branch', singleToken, true], ['2 branches', multiToken, true]]) {
            const r = employeeBranches((await get(token, `/payroll/employees?limit=2000&branchId=${BRANCH.SATIVALI}`)).body);
            console.log(`     ${label.padEnd(12)} ${String(r.count).padStart(4)} employees | ${r.branches.join(', ') || '(none)'}`);
            if (expectZero) check(`${label} user cannot reach SATIVALI by passing branchId`, r.count === 0);
            else check('admin can still filter to SATIVALI', r.count > 0);
        }

        console.log('\n3. Branch switcher (GET /branches)');
        for (const [label, token, expected] of [['admin', adminToken, null], ['1 branch', singleToken, 'NASHIK'], ['2 branches', multiToken, 'NASHIK,USGOAN']]) {
            const { body } = await get(token, '/branches');
            const names = (Array.isArray(body) ? body : body.data || []).map(b => b.name).sort();
            console.log(`     ${label.padEnd(12)} ${names.join(', ')}`);
            if (expected) check(`${label} user is only offered their branches`, names.join() === expected);
            else check('admin is offered every branch', names.length > 3);
        }

        console.log('\n4. Support tickets');
        for (const [label, token] of [['admin', adminToken], ['1 branch', singleToken], ['2 branches', multiToken]]) {
            const { body } = await get(token, '/csm/tickets?tab=all&limit=100');
            const total = body.pagination ? body.pagination.total : (body.data || []).length;
            const branches = [...new Set((body.data || []).map(t => t.branchId?.name || '(none)'))].sort();
            console.log(`     ${label.padEnd(12)} ${String(total).padStart(4)} tickets | ${branches.join(', ') || '(none)'}`);
            // Tickets are additionally limited by the My / Team / All rules, so an employee
            // who owns no tickets sees none even inside their own branch. What must never
            // happen is a ticket from a branch they are not assigned to.
            if (label !== 'admin') check(`${label} user sees no ticket outside their branches (also limited to own/team tickets)`, branches.every(b => b === '(none)' || (label === '1 branch' ? b === 'NASHIK' : ['NASHIK', 'USGOAN'].includes(b))));
        }
    } finally {
        for (const email of TEST_EMAILS) {
            await User.deleteMany({ email }).setOptions({ bypassTenant: true });
        }
        const leftover = await User.countDocuments({ email: { $in: TEST_EMAILS } }).setOptions({ bypassTenant: true });
        console.log(`\ntemporary test users removed: ${leftover === 0}`);
    }

    const failed = results.filter(r => !r.passed);
    console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
})().catch(err => {
    console.error('test error:', err.message);
    process.exit(1);
});
