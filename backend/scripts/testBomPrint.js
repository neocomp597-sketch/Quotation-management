/**
 * Tests what Export to PDF is built from: GET /bom/:id/print.
 *
 * Creates a BOM whose component has a BOM of its own, and checks that the sub-BOM comes
 * back under the right component, that a second level is followed, that the invoice and
 * customer of the finished good are resolved, and that nothing loops for ever. Everything
 * it creates is deleted again.
 *
 * Usage: TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... node scripts/testBomPrint.js
 */
require('dotenv').config();

const API = process.env.TEST_API_URL || 'http://localhost:4003/api';
const EMAIL = process.env.TEST_ADMIN_EMAIL;
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const STAMP = Date.now();
const TOP = `ZZ-PRINT-TOP-${STAMP}`;
const SUB = `ZZ-PRINT-SUB-${STAMP}`;
const DEEP = `ZZ-PRINT-DEEP-${STAMP}`;

const results = [];
const check = (label, passed, detail = '') => {
    results.push(passed);
    console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
};

(async () => {
    if (!EMAIL || !PASSWORD) {
        console.error('Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD.');
        process.exit(1);
    }
    const login = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    }).then(r => r.json());
    if (!login.accessToken) { console.error('login failed'); process.exit(1); }
    const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.accessToken };
    const call = async (method, path, body) => {
        const res = await fetch(API + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
        return { status: res.status, body: await res.json().catch(() => ({})) };
    };

    // Deepest first: TOP -> (component serial SUB) -> (component serial DEEP).
    const deep = await call('POST', '/bom', {
        fgItemCode: 'ZZ-DEEP', fgSerialNumber: DEEP,
        items: [{ itemCode: `ZZ-PLAIN-A-${STAMP}`, itemDescription: 'plain component, no BOM of its own', qty: 1, remarks: 'deepest level' }]
    });
    const sub = await call('POST', '/bom', {
        fgItemCode: 'ZZ-SUB', fgSerialNumber: SUB,
        items: [{ itemCode: 'ZZ-DEEP', itemDescription: 'Assembly with its own BOM', qty: 2, componentSerialNumber: DEEP }]
    });
    const top = await call('POST', '/bom', {
        fgItemCode: 'ZZ-TOP', fgSerialNumber: TOP,
        items: [
            { itemCode: 'ZZ-SUB', itemDescription: 'Sub assembly', qty: 1, componentSerialNumber: SUB, remarks: 'has a BOM of its own' },
            { itemCode: `ZZ-PLAIN-B-${STAMP}`, itemDescription: 'plain component, no BOM of its own', qty: 3, batchNumber: 'B-1' }
        ]
    });
    const ids = [top, sub, deep].map(r => r.body?._id);
    check('the three test BOMs were created', ids.every(Boolean), ids.filter(Boolean).length + ' of 3');

    console.log('\nPrint payload:');
    const print = await call('GET', `/bom/${ids[0]}/print`);
    const payload = print.body || {};
    check('print endpoint responds', print.status === 200 && Boolean(payload.bom), `HTTP ${print.status}`);
    check('the BOM itself comes back with its components', (payload.bom?.items || []).length === 2, `${(payload.bom?.items || []).length} component(s)`);
    check('the invoice block is present', Boolean(payload.bom?.invoice), JSON.stringify(payload.bom?.invoice || {}));
    check('the FG MGR block is present', Boolean(payload.bom?.fgMgr), Object.keys(payload.bom?.fgMgr || {}).join(','));

    const subs = payload.subBoms || [];
    check('two sub-BOMs are returned', subs.length === 2, `${subs.length}: ${subs.map(s => s.bom?.fgSerialNumber).join(', ')}`);
    check('the first is the one hanging off the ZZ-SUB component',
        subs[0]?.forItemCode === 'ZZ-SUB' && subs[0]?.forSerialNumber === SUB && subs[0]?.bom?.fgSerialNumber === SUB,
        `${subs[0]?.forItemCode} / ${subs[0]?.bom?.fgSerialNumber}`);
    check('it is marked as the first level', subs[0]?.level === 1, String(subs[0]?.level));
    check('the nested one is marked as the second level and follows it',
        subs[1]?.level === 2 && subs[1]?.bom?.fgSerialNumber === DEEP,
        `level ${subs[1]?.level}, ${subs[1]?.bom?.fgSerialNumber}`);
    check('sub-BOM components come through', (subs[0]?.bom?.items || []).length === 1, `${(subs[0]?.bom?.items || []).length} component(s)`);

    console.log('\nA BOM with no sub-BOM:');
    const plain = await call('GET', `/bom/${ids[2]}/print`);
    check('returns an empty sub-BOM list', Array.isArray(plain.body?.subBoms) && plain.body.subBoms.length === 0, `${plain.body?.subBoms?.length} entries`);

    console.log('\nA component with no serial is matched on its item code:');
    const codeSerial = `ZZ-PRINT-BYCODE-${STAMP}`;
    const byCode = await call('POST', '/bom', {
        fgItemCode: `ZZ-BYCODE-${STAMP}`, fgSerialNumber: codeSerial,
        items: [{ itemCode: `ZZ-PLAIN-C-${STAMP}`, itemDescription: 'plain', qty: 1 }]
    });
    const parent = await call('POST', '/bom', {
        fgItemCode: 'ZZ-PARENT', fgSerialNumber: `ZZ-PRINT-PARENT-${STAMP}`,
        items: [{ itemCode: `ZZ-BYCODE-${STAMP}`, itemDescription: 'built elsewhere', qty: 1 }]
    });
    const byCodePrint = await call('GET', `/bom/${parent.body?._id}/print`);
    const matched = (byCodePrint.body?.subBoms || [])[0];
    check('the BOM for that item code is printed underneath',
        (byCodePrint.body?.subBoms || []).length === 1 && matched?.bom?.fgSerialNumber === codeSerial,
        `${(byCodePrint.body?.subBoms || []).length} sub-BOM(s), ${matched?.bom?.fgSerialNumber || 'none'}`);

    console.log('\nA serial that points at itself does not loop:');
    const loopSerial = `ZZ-PRINT-LOOP-${STAMP}`;
    const loop = await call('POST', '/bom', {
        fgItemCode: 'ZZ-LOOP', fgSerialNumber: loopSerial,
        items: [{ itemCode: 'ZZ-LOOP', itemDescription: 'points back at its own serial', qty: 1, componentSerialNumber: loopSerial }]
    });
    const loopPrint = await call('GET', `/bom/${loop.body?._id}/print`);
    check('the BOM is not nested inside itself', loopPrint.status === 200 && (loopPrint.body?.subBoms || []).length === 0,
        `HTTP ${loopPrint.status}, ${(loopPrint.body?.subBoms || []).length} sub-BOM(s)`);

    console.log('\nCleanup:');
    let removed = 0;
    for (const id of [...ids, loop.body?._id, byCode.body?._id, parent.body?._id]) {
        if (!id) continue;
        const del = await call('DELETE', `/bom/${id}`);
        if (del.status < 300) removed++;
    }
    check('test BOMs deleted', removed === 6, `${removed} removed`);

    const failed = results.filter(r => !r).length;
    console.log(failed ? `\n${failed} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error('test error:', err.message); process.exit(1); });
