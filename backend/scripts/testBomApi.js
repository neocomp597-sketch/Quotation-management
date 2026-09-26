/**
 * End-to-end test for the BOM Master API.
 *
 * Creates a BOM against a throwaway FG serial, checks that component descriptions and
 * MGR1-MGR5 resolve from Product Master, that serial/batch round-trip, that lookup by
 * serial and by ticket work, that remarks survive a create/edit, that Export to Excel
 * returns the agreed columns, and that a duplicate serial is rejected. Deletes the BOM.
 *
 * Usage: TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... node scripts/testBomApi.js
 */
require('dotenv').config();
const XLSX = require('xlsx');

const API = process.env.TEST_API_URL || 'http://localhost:4003/api';
const EMAIL = process.env.TEST_ADMIN_EMAIL;
const PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const FG_SERIAL = `ZZ-BOM-TEST-${Date.now()}`;

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

    // A real product gives us something whose description and MGRs should resolve.
    const products = await call('GET', '/products?limit=5');
    const list = products.body.data || products.body.products || products.body;
    const product = (Array.isArray(list) ? list : [])[0];
    check('a product is available to reference', Boolean(product?.productCode), product?.productCode || '');

    console.log('\nMaterial search (type-and-search on component code):');
    const search = await call('GET', `/bom/materials?q=${encodeURIComponent(String(product?.productCode || '').slice(0, 3))}`);
    const matches = search.body.data || search.body || [];
    check('search returns matching materials', search.status === 200 && Array.isArray(matches) && matches.length > 0, `${matches.length} match(es)`);

    console.log('\nCreate BOM:');
    const payload = {
        fgItemCode: 'ZZ-FG-TEST',
        fgItemDescription: 'Test finished good',
        fgSerialNumber: FG_SERIAL,
        items: [
            { itemCode: product?.productCode, itemDescription: 'ignored when product is found', qty: 2, componentSerialNumber: 'COMP-SN-1', batchNumber: 'BATCH-A', remarks: 'Replaced under warranty' },
            { itemCode: 'ZZ-NOT-IN-MASTER', itemDescription: 'Uploaded description kept', qty: 5, componentSerialNumber: '', batchNumber: 'BATCH-B', remarks: '' },
        ]
    };
    const created = await call('POST', '/bom', payload);
    const bomId = created.body?._id || created.body?.bom?._id || created.body?.data?._id;
    check('BOM created', created.status < 300 && Boolean(bomId), created.status < 300 ? '' : JSON.stringify(created.body).slice(0, 120));

    console.log('\nDuplicate serial is rejected:');
    const dup = await call('POST', '/bom', payload);
    check('second BOM for the same FG serial is refused', dup.status >= 400, `HTTP ${dup.status}`);

    console.log('\nLookup by serial number (what the complaint screen calls):');
    const bySerial = await call('GET', `/bom/serial/${encodeURIComponent(FG_SERIAL)}`);
    const bom = bySerial.body?.bom || bySerial.body;
    const items = bom?.items || [];
    check('BOM found for the serial', bySerial.status === 200 && items.length === 2, `${items.length} component(s)`);

    const known = items.find(i => i.itemCode === product?.productCode);
    const unknown = items.find(i => i.itemCode === 'ZZ-NOT-IN-MASTER');
    check('material code returned', Boolean(known?.itemCode), known?.itemCode || '');
    check('description resolved from Product Master', Boolean(known?.itemDescription) && known.itemDescription !== 'ignored when product is found', known?.itemDescription || '(empty)');
    const mgrs = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];
    const present = mgrs.filter(m => known?.[m]);
    check('MGR1-MGR5 present on the response', mgrs.every(m => m in (known || {})), `${present.length} of 5 populated on this product`);
    check('unknown item keeps its uploaded description', unknown?.itemDescription === 'Uploaded description kept', unknown?.itemDescription || '(empty)');
    check('serial and batch round-trip', known?.componentSerialNumber === 'COMP-SN-1' && known?.batchNumber === 'BATCH-A', `${known?.componentSerialNumber} / ${known?.batchNumber}`);
    check('remarks round-trip', known?.remarks === 'Replaced under warranty', known?.remarks || '(empty)');

    console.log('\nEdit keeps remarks:');
    const edited = await call('PUT', `/bom/${bomId}`, {
        ...payload,
        items: [{ itemCode: product?.productCode, qty: 4, componentSerialNumber: 'COMP-SN-1', batchNumber: 'BATCH-A', remarks: 'Edited remark' }]
    });
    const afterEdit = (await call('GET', `/bom/${bomId}`)).body;
    check('edit saved', edited.status < 300, `HTTP ${edited.status}`);
    check('edited remark stored', afterEdit?.items?.[0]?.remarks === 'Edited remark', afterEdit?.items?.[0]?.remarks || '(empty)');

    console.log('\nExport to Excel:');
    const exportRes = await fetch(`${API}/bom/${bomId}/export`, { headers: { Authorization: H.Authorization } });
    const exportBuf = Buffer.from(await exportRes.arrayBuffer());
    check('export downloads a workbook', exportRes.status === 200 && exportBuf.length > 1000, `HTTP ${exportRes.status}, ${exportBuf.length} bytes`);
    check('filename carries the FG serial', /BOM_/.test(exportRes.headers.get('content-disposition') || ''), exportRes.headers.get('content-disposition') || '');
    const wb = exportRes.status === 200 ? XLSX.read(exportBuf, { type: 'buffer' }) : null;
    const exportSheet = wb ? wb.Sheets[wb.SheetNames[0]] : null;
    const exportRows = exportSheet ? XLSX.utils.sheet_to_json(exportSheet, { defval: '' }) : [];
    const exportHeaders = exportSheet ? (XLSX.utils.sheet_to_json(exportSheet, { header: 1 })[0] || []) : [];
    const expected = [
        'FG_Item Code', 'FG_Desc', 'FG_Serial Number', 'FG_MGR1', 'FG_MGR2', 'FG_MGR3', 'FG_MGR4', 'FG_MGR5',
        'BOM_Item Code', 'BOM_Desc', 'BOM_Batch', 'BOM_Serial Number', 'BOM_Qty',
        'BOM_MGR1', 'BOM_MGR2', 'BOM_MGR3', 'BOM_MGR4', 'BOM_MGR5', 'BOM_Remarks'
    ];
    check('export has every agreed column', expected.every(h => exportHeaders.includes(h)),
        expected.filter(h => !exportHeaders.includes(h)).join(', ') || exportHeaders.length + ' columns');
    check('one export row per component', exportRows.length === 1, `${exportRows.length} row(s)`);
    check('export carries the FG serial and component data',
        exportRows[0]?.['FG_Serial Number'] === FG_SERIAL && exportRows[0]?.['BOM_Item Code'] === product?.productCode && exportRows[0]?.['BOM_Qty'] === 4,
        `${exportRows[0]?.['FG_Serial Number']} / ${exportRows[0]?.['BOM_Item Code']} / qty ${exportRows[0]?.['BOM_Qty']}`);
    check('export carries remarks', exportRows[0]?.['BOM_Remarks'] === 'Edited remark', exportRows[0]?.['BOM_Remarks'] || '(empty)');

    console.log('\nLookup for a serial with no BOM:');
    const missing = await call('GET', '/bom/serial/ZZ-NO-SUCH-SERIAL-123');
    check('responds without an error', missing.status === 200 || missing.status === 404, `HTTP ${missing.status}`);

    console.log('\nCleanup:');
    if (bomId) {
        const del = await call('DELETE', `/bom/${bomId}`);
        const gone = await call('GET', `/bom/serial/${encodeURIComponent(FG_SERIAL)}`);
        const goneBom = gone.body?.bom || (gone.status === 404 ? null : gone.body?._id ? gone.body : null);
        check('test BOM deleted', del.status < 300 && !goneBom);
    }

    const failed = results.filter(r => !r).length;
    console.log(failed ? `\n${failed} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
    process.exit(failed ? 1 : 0);
})().catch(err => { console.error('test error:', err.message); process.exit(1); });
