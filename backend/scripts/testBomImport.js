/**
 * End-to-end test for BOM bulk upload.
 *
 * Downloads the template, uploads a workbook covering the tricky cases (two identically
 * named "Serial number" columns, an item code missing from Product Master, a bad qty,
 * two BOMs in one file), then re-uploads to confirm a serial is replaced rather than
 * duplicated. All BOMs it creates are deleted again.
 *
 * Usage: TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... node scripts/testBomImport.js
 */
require('dotenv').config();
const XLSX = require('xlsx');

const API = process.env.TEST_API_URL || 'http://localhost:4003/api';
const EMAIL = process.env.TEST_ADMIN_EMAIL;
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const STAMP = Date.now();
const SERIAL_A = `ZZ-IMP-A-${STAMP}`;
const SERIAL_B = `ZZ-IMP-B-${STAMP}`;

const results = [];
const check = (label, passed, detail = '') => {
    results.push(passed);
    console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
};

const sheetToBuffer = (rows) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'BOM');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
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
    const token = login.accessToken;
    if (!token) { console.error('login failed'); process.exit(1); }
    const auth = { Authorization: 'Bearer ' + token };
    const json = async (method, path, body) => {
        const res = await fetch(API + path, { method, headers: { ...auth, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        return { status: res.status, body: await res.json().catch(() => ({})) };
    };
    const postFile = async (buffer, filename) => {
        const form = new FormData();
        form.append('file', new Blob([buffer]), filename);
        const res = await fetch(`${API}/bom/upload`, { method: 'POST', headers: auth, body: form });
        return { status: res.status, body: await res.json().catch(() => ({})) };
    };

    const products = await json('GET', '/products?limit=5');
    const list = products.body.data || products.body.products || products.body;
    const product = (Array.isArray(list) ? list : [])[0];
    const code = product?.productCode;

    console.log('\nTemplate download:');
    const tplRes = await fetch(`${API}/bom/template`, { headers: auth });
    const tplBuf = Buffer.from(await tplRes.arrayBuffer());
    const tpl = XLSX.read(tplBuf, { type: 'buffer' });
    const headers = XLSX.utils.sheet_to_json(tpl.Sheets[tpl.SheetNames[0]], { header: 1 })[0] || [];
    check('template downloads as a workbook', tplRes.status === 200 && tplBuf.length > 1000, `${tplBuf.length} bytes`);
    check('template has the columns from the spec',
        ['Item code_FG', 'FG Serial number', 'Item code', 'Item description', 'Qty', 'Component serial number', 'Batch number', 'Remarks']
            .every(h => headers.includes(h)), headers.join(' | '));
    check('template includes a guide sheet', tpl.SheetNames.includes('Guide'), tpl.SheetNames.join(', '));

    console.log('\nUpload with the original layout (two "Serial number" columns):');
    const buffer = sheetToBuffer([
        ['Item code_FG', 'Serial number', 'Item code', 'Item description', 'Qty', 'Serial number', 'Batch number', 'Remarks'],
        ['ZZ-FG-IMP', SERIAL_A, code, 'ignored, master wins', 2, 'CMP-SN-1', 'BATCH-1', 'Imported remark'],
        ['ZZ-FG-IMP', SERIAL_A, 'ZZ-UNKNOWN-ITEM', 'Kept from the file', 1, '', 'BATCH-2', ''],
        ['ZZ-FG-IMP', SERIAL_B, code, '', 3, 'CMP-SN-2', '', ''],
        ['ZZ-FG-IMP', `ZZ-IMP-BAD-${STAMP}`, code, '', 'abc', '', '', ''],
    ]);
    const up = await postFile(buffer, 'bom-test.xlsx');
    const s = up.body || {};
    check('upload accepted', up.status === 200, `HTTP ${up.status}`);
    check('two BOMs created', s.created === 2, `created ${s.created}, updated ${s.updated}, failed ${s.failed}`);
    check('the row with a bad qty is reported, not saved', s.failed === 1 && /qty/i.test(s.errors?.[0]?.message || ''), s.errors?.[0]?.message?.slice(0, 70) || '');

    console.log('\nWhat was stored:');
    const a = await json('GET', `/bom/serial/${encodeURIComponent(SERIAL_A)}`);
    const items = (a.body?.bom || a.body)?.items || [];
    const known = items.find(i => i.itemCode === code);
    const unknown = items.find(i => i.itemCode === 'ZZ-UNKNOWN-ITEM');
    check('first serial has both components', items.length === 2, `${items.length} component(s)`);
    check('first "Serial number" column became the FG serial', (a.body?.bom || a.body)?.fgSerialNumber === SERIAL_A);
    check('second "Serial number" column became the component serial', known?.componentSerialNumber === 'CMP-SN-1', known?.componentSerialNumber || '(blank)');
    check('batch number imported', known?.batchNumber === 'BATCH-1', known?.batchNumber || '(blank)');
    check('remarks imported', known?.remarks === 'Imported remark', known?.remarks || '(blank)');
    check('description and MGRs resolved from Product Master', Boolean(known?.itemDescription) && known.itemDescription !== 'ignored, master wins', known?.itemDescription || '');
    check('unknown item keeps the description from the file', unknown?.itemDescription === 'Kept from the file', unknown?.itemDescription || '');

    console.log('\nRe-upload replaces rather than duplicating:');
    const again = sheetToBuffer([
        ['Item code_FG', 'FG Serial number', 'Item code', 'Item description', 'Qty', 'Component serial number', 'Batch number'],
        ['ZZ-FG-IMP', SERIAL_A, code, '', 7, 'CMP-SN-9', 'BATCH-9'],
    ]);
    const up2 = await postFile(again, 'bom-test-2.xlsx');
    check('second upload reports an update', up2.body?.updated === 1 && up2.body?.created === 0, `created ${up2.body?.created}, updated ${up2.body?.updated}`);
    const a2 = await json('GET', `/bom/serial/${encodeURIComponent(SERIAL_A)}`);
    const items2 = (a2.body?.bom || a2.body)?.items || [];
    check('components were replaced, not appended', items2.length === 1 && items2[0].qty === 7, `${items2.length} component(s), qty ${items2[0]?.qty}`);

    console.log('\nA file with the wrong columns is rejected:');
    const junk = sheetToBuffer([['Foo', 'Bar'], ['a', 'b']]);
    const bad = await postFile(junk, 'wrong.xlsx');
    check('missing columns are named in the error', bad.status === 400 && /missing required column/i.test(bad.body?.message || ''), (bad.body?.message || '').slice(0, 80));

    console.log('\nCleanup:');
    let removed = 0;
    for (const serial of [SERIAL_A, SERIAL_B]) {
        const found = await json('GET', `/bom/serial/${encodeURIComponent(serial)}`);
        const id = (found.body?.bom || found.body)?._id;
        if (id) { await json('DELETE', `/bom/${id}`); removed++; }
    }
    check('test BOMs deleted', removed === 2, `${removed} removed`);

    const failed = results.filter(r => !r).length;
    console.log(failed ? `\n${failed} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error('test error:', err.message); process.exit(1); });
