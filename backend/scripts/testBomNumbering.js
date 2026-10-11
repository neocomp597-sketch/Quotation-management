/**
 * End-to-end test for hierarchical BOM numbering (services/bomLineService + bomController).
 *
 * Runs against the database in backend/.env under a throwaway company id, so no real
 * tenant's data is read or changed, and deletes everything it created at the end.
 *
 * Covers: 1/1.1/1.1.1 numbering, next sibling after existing ones, no renumbering on delete,
 * no reuse of a freed number, numeric ordering (4.10 after 4.9), moving a sub-assembly with its
 * descendants, circular references refused, concurrent adds, explicit renumber, and the same
 * numbers in the PDF payload, the Excel export and an Excel re-upload.
 *
 * Usage: node scripts/testBomNumbering.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const BOMMaster = require('../models/BOMMaster');
const BOMItem = require('../models/BOMItem');
// Populated by the BOM screens; the server registers them at startup.
require('../models/MGR');
require('../models/User');
const controller = require('../controllers/bomController');
const { importBOMWorkbook } = require('../services/bomImportService');
const { compareSeq } = require('../services/bomLineService');
const { runWithTenant } = require('../middlewares/tenantContext');

const companyId = new mongoose.Types.ObjectId();
const RUN = `ZZT${Date.now().toString(36).toUpperCase()}`;
const code = (name) => `${RUN}-${name}`;

const results = [];
const check = (label, passed, detail = '') => {
    results.push(passed);
    console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
};

// Calls a controller the way Express would and resolves with { status, body }.
const call = (handler, { params = {}, body = {}, query = {} } = {}) => new Promise((resolve, reject) => {
    const res = {
        statusCode: 200,
        headers: {},
        status(code) { this.statusCode = code; return this; },
        setHeader(name, value) { this.headers[name] = value; },
        json(payload) { resolve({ status: this.statusCode, body: payload }); },
        send(payload) { resolve({ status: this.statusCode, body: payload }); }
    };
    const req = { params, body, query, user: { id: new mongoose.Types.ObjectId(), name: 'Numbering test', role: 'admin' } };
    Promise.resolve(handler(req, res)).catch(reject);
});

const seqs = (bom) => (bom.items || []).map((item) => item.seqNo);
const line = (name, qty = 1) => ({ itemCode: code(name), itemDescription: `Test part ${name}`, uom: 'NOS', qty });

const main = async () => {
    // 1. Product with three assemblies: 1, 2, 3.
    const created = await call(controller.createBOM, { body: { fgItemCode: code('P'), fgItemDescription: 'Test product', items: [line('A1'), line('A2'), line('A3')] } });
    check('product created', created.status === 201, `status ${created.status} ${created.body.message || ''} ${created.body.error || ''}`);
    const productId = created.body._id;
    check('product lines numbered 1, 2, 3', seqs(created.body).join() === '1,2,3', seqs(created.body).join());

    // 2. Create Assembly adds line 4 and its own BOM.
    const asm = await call(controller.createAssembly, { params: { id: productId }, body: { itemCode: code('SUB'), itemName: 'Test sub-assembly', qty: 1 } });
    check('assembly added as line 4', asm.status === 201 && asm.body.lineNo === 4, `status ${asm.status} lineNo ${asm.body.lineNo} ${asm.body.message || ''}`);
    const subId = String(asm.body.assemblyId);

    // 3. Twelve components under 4: 4.1 ... 4.12, ordered numerically.
    let last;
    for (let i = 1; i <= 12; i++) {
        last = await call(controller.addComponent, { params: { id: subId }, query: { parent: productId }, body: { itemCode: code(`C${i}`), itemName: `Part C${i}`, qty: i } });
    }
    check('12th component numbered 4.12', last.body.seqNo === '4.12', last.body.seqNo);
    const subSeqs = seqs(last.body.bom);
    check('4.10 comes after 4.9, not after 4.1', subSeqs.indexOf('4.10') === subSeqs.indexOf('4.9') + 1, subSeqs.join(' '));
    check('compareSeq orders 1.9 < 1.10 < 1.100 and 1.3.1 < 1.30.1',
        ['1.100', '1.10', '1.9', '1.30.1', '1.3.1'].sort(compareSeq).join(' ') === '1.3.1 1.9 1.10 1.30.1 1.100');

    // 4. Sub-sub-assembly 4.13 with components 4.13.1, 4.13.2.
    const subsub = await call(controller.createAssembly, { params: { id: subId }, body: { itemCode: code('SUBSUB'), itemName: 'Test sub-sub', qty: 1 } });
    check('sub-sub-assembly added as line 13 of the sub-assembly', subsub.body.lineNo === 13, `lineNo ${subsub.body.lineNo} ${subsub.body.message || ''}`);
    const subsubId = String(subsub.body.assemblyId);
    await call(controller.addComponent, { params: { id: subsubId }, query: { parent: subId }, body: { itemCode: code('D1'), itemName: 'Part D1' } });
    const d2 = await call(controller.addComponent, { params: { id: subsubId }, query: { parent: subId }, body: { itemCode: code('D2'), itemName: 'Part D2' } });
    check('level 4 numbers 4.13.1, 4.13.2', seqs(d2.body.bom).join() === '4.13.1,4.13.2', seqs(d2.body.bom).join());

    // 5. Edit form removes 4.2 and adds a row: 4.3 stays 4.3, the new row is 4.14.
    const subBom = (await call(controller.getBOMById, { params: { id: subId }, query: { parent: productId } })).body;
    const rows = subBom.items
        .filter((item) => item.lineNo !== 2)
        .map((item) => ({ _id: item._id, itemCode: item.itemCode, itemDescription: item.itemDescription, uom: item.uom, qty: item.qty }));
    rows.push(line('NEW1'));
    const edited = await call(controller.updateBOM, { params: { id: subId }, body: { fgItemCode: subBom.fgItemCode, items: rows } });
    const editedBom = (await call(controller.getBOMById, { params: { id: subId }, query: { parent: productId } })).body;
    const editedSeqs = seqs(editedBom);
    check('edit saved', edited.status === 200, `status ${edited.status} ${edited.body.message || ''}`);
    check('deleting 4.2 does not renumber 4.3', !editedSeqs.includes('4.2') && editedSeqs.includes('4.3'), editedSeqs.join(' '));
    check('new row in the edit gets 4.14', editedBom.items.find((item) => item.itemCode === code('NEW1'))?.seqNo === '4.14');
    const sameIds = subBom.items.filter((item) => item.lineNo !== 2).every((item) => editedBom.items.some((e) => String(e._id) === String(item._id) && e.lineNo === item.lineNo));
    check('kept lines keep their ids and numbers', sameIds);

    // 6. Remove the last line (4.14) then add: the new line is 4.15, 14 is not reused.
    const without14 = editedBom.items.filter((item) => item.lineNo !== 14)
        .map((item) => ({ _id: item._id, itemCode: item.itemCode, itemDescription: item.itemDescription, uom: item.uom, qty: item.qty }));
    await call(controller.updateBOM, { params: { id: subId }, body: { fgItemCode: subBom.fgItemCode, items: without14 } });
    const after = await call(controller.addComponent, { params: { id: subId }, query: { parent: productId }, body: { itemCode: code('NEW2'), itemName: 'Part NEW2' } });
    check('freed number is not reused (4.15, not 4.14)', after.body.seqNo === '4.15', after.body.seqNo);

    // 7. PDF payload and Excel export use the same numbers, grouped under their parents.
    const print = (await call(controller.getBOMForPrint, { params: { id: productId } })).body;
    const printSeqs = [...seqs(print.bom), ...print.subBoms.flatMap((sub) => seqs(sub.bom))];
    check('PDF payload numbers 1..4, 4.1.., 4.13.1', ['1', '4', '4.3', '4.15', '4.13.1', '4.13.2'].every((s) => printSeqs.includes(s)), printSeqs.join(' '));
    const exported = await call(controller.exportBOM, { params: { id: productId } });
    const sheet = XLSX.read(exported.body, { type: 'buffer' });
    const matrix = XLSX.utils.sheet_to_json(sheet.Sheets[sheet.SheetNames[0]], { header: 1 });
    check('Excel has the # column first', matrix[0][0] === '#', JSON.stringify(matrix[0]));
    const excelSeqs = matrix.slice(1).map((row) => String(row[0]));
    check('Excel numbers equal the PDF numbers', excelSeqs.join() === printSeqs.join(), `${excelSeqs.length} rows`);

    // 8. Re-uploading the export keeps every line's number, gaps included.
    const before = await BOMItem.find({ bomMasterId: subId }).sort({ lineNo: 1 }).lean();
    const upload = await importBOMWorkbook(exported.body, { fileName: 'roundtrip.xlsx' });
    const reloaded = await BOMItem.find({ bomMasterId: subId }).sort({ lineNo: 1 }).lean();
    check('re-upload succeeded', upload.failed === 0, JSON.stringify(upload.errors));
    check('re-upload keeps the numbers (gap at 4.2 kept)',
        before.map((l) => `${l.lineNo}:${l.itemCode}`).join() === reloaded.map((l) => `${l.lineNo}:${l.itemCode}`).join(),
        reloaded.map((l) => l.lineNo).join(','));

    // 9. Move the sub-sub-assembly (4.13) under the product: it becomes 5, its children 5.1, 5.2.
    const subsubLine = reloaded.find((l) => l.itemCode === code('SUBSUB'));
    const moved = await call(controller.moveComponent, { params: { id: subId, lineId: String(subsubLine._id) }, query: { parent: productId }, body: { targetBomId: productId } });
    check('move accepted', moved.status === 200, `status ${moved.status} ${moved.body.message || ''}`);
    check('moved line takes the next number under the product (5)', moved.body.seqNo === '5', moved.body.seqNo);
    check('move keeps the line id', String(moved.body.lineId) === String(subsubLine._id));
    const movedChildren = (await call(controller.getBOMById, { params: { id: subsubId }, query: { parent: productId } })).body;
    check('descendants follow: 5.1, 5.2', seqs(movedChildren).join() === '5.1,5.2', seqs(movedChildren).join());
    const subAfterMove = (await call(controller.getBOMById, { params: { id: subId }, query: { parent: productId } })).body;
    check('the old parent keeps its other numbers', seqs(subAfterMove).includes('4.12') && !seqs(subAfterMove).includes('4.13'), seqs(subAfterMove).join(' '));

    // 10. Circular references are refused.
    const loopAdd = await call(controller.addComponent, { params: { id: subsubId }, body: { itemCode: code('P'), itemName: 'Loop' } });
    check('product cannot be added under its own sub-assembly', loopAdd.status === 400, `${loopAdd.status} ${loopAdd.body.message || ''}`);
    const selfAdd = await call(controller.addComponent, { params: { id: subId }, body: { itemCode: code('SUB'), itemName: 'Self' } });
    check('a BOM cannot contain itself', selfAdd.status === 400, `${selfAdd.status}`);
    // Use the sub-sub-assembly inside the sub-assembly again (a shared sub-assembly), so moving the
    // sub-assembly under it would put the sub-assembly inside itself.
    const reuse = await call(controller.addComponent, { params: { id: subId }, body: { itemCode: code('SUBSUB'), itemName: 'Test sub-sub' } });
    check('a sub-assembly can be used under a second parent', reuse.status === 201, `${reuse.status} ${reuse.body.message || ''}`);
    const loopMove = await call(controller.moveComponent, { params: { id: productId, lineId: String(asm.body.lineId) }, body: { targetBomId: subsubId } });
    check('moving 4 under its own descendant is refused', loopMove.status === 400, `${loopMove.status} ${loopMove.body.message || ''}`);

    // 11. Concurrent adds never share a number.
    const parallel = await Promise.all(Array.from({ length: 8 }, (_, i) => call(controller.addComponent, {
        params: { id: subId }, body: { itemCode: code(`PAR${i}`), itemName: `Parallel ${i}` }
    })));
    const parallelNos = parallel.map((r) => r.body.lineNo);
    check('8 concurrent adds all succeed', parallel.every((r) => r.status === 201), parallel.map((r) => r.status).join(','));
    check('8 concurrent adds get 8 different numbers', new Set(parallelNos).size === 8, parallelNos.join(','));
    const allNos = (await BOMItem.find({ bomMasterId: subId }).lean()).map((l) => l.lineNo);
    check('no duplicate numbers in the BOM', new Set(allNos).size === allNos.length);

    // 12. Explicit renumber closes the gaps.
    const renum = await call(controller.renumberComponents, { params: { id: subId }, query: { parent: productId } });
    const renumSeqs = seqs(renum.body.bom);
    check('renumber gives 4.1..4.n without gaps', renumSeqs.every((s, i) => s === `4.${i + 1}`), renumSeqs.join(' '));
    const next = await call(controller.addComponent, { params: { id: subId }, query: { parent: productId }, body: { itemCode: code('AFTER'), itemName: 'After renumber' } });
    check('after renumber the next line follows on', next.body.seqNo === `4.${renumSeqs.length + 1}`, next.body.seqNo);

    // 13. An SAP BOM Costing Report keeps its own numbers, gaps included (2.3 stays 2.3).
    const costing = XLSX.utils.aoa_to_sheet([
        ['BOM Costing Report'],
        ['Item Code\nItem Name', `: ${code('CP')}\n: Costing product`],
        ['#', 'Item Code', 'Item Name', 'UOM', 'BOM Type', 'Quantity'],
        ['1', code('CA'), 'Costing part A', 'NOS', 'S', 1],
        ['2', code('CB'), 'Costing assembly B', 'NOS', 'P', 1],
        ['2.1', code('CB1'), 'Costing part B1', 'NOS', 'S', 2],
        ['2.3', code('CB3'), 'Costing part B3', 'NOS', 'S', 3]
    ]);
    const costingBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(costingBook, costing, 'Report');
    const costingUpload = await importBOMWorkbook(XLSX.write(costingBook, { type: 'buffer', bookType: 'xlsx' }), { fileName: 'costing.xlsx' });
    const costingSub = await BOMMaster.findOne({ fgSerialKey: code('CB').toUpperCase() }).lean();
    const costingLines = costingSub ? await BOMItem.find({ bomMasterId: costingSub._id }).sort({ lineNo: 1 }).lean() : [];
    check('costing report imported', costingUpload.failed === 0 && costingUpload.created === 2, JSON.stringify({ created: costingUpload.created, errors: costingUpload.errors }));
    check('costing report numbers kept (2.1, 2.3)', costingLines.map((l) => l.lineNo).join() === '1,3', costingLines.map((l) => l.lineNo).join());

    // 14. Database constraint, when the unique index has been built (server start or migration).
    const indexes = await BOMItem.collection.indexes();
    if (indexes.some((index) => index.name === 'bom_line_number_unique')) {
        const duplicate = await BOMItem.create({ bomMasterId: subId, lineNo: 1, itemCode: code('DUP'), qty: 1 }).then(() => null, (error) => error);
        check('unique index rejects a duplicate number', duplicate?.code === 11000, duplicate?.message);
    } else {
        console.log('  SKIP  unique index not built yet in this database (created on server start or by the migration)');
    }
};

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Test company ${companyId}, codes ${RUN}-*`);
    try {
        await runWithTenant(String(companyId), main, {});
    } catch (error) {
        console.error(error);
        results.push(false);
    } finally {
        const removed = await Promise.all([
            BOMItem.deleteMany({ companyId }, { bypassTenant: true }),
            BOMMaster.deleteMany({ companyId }, { bypassTenant: true })
        ]);
        console.log(`Cleaned up ${removed[0].deletedCount} lines and ${removed[1].deletedCount} BOMs.`);
        await mongoose.disconnect();
    }
    const failed = results.filter((passed) => !passed).length;
    console.log(failed ? `${failed} of ${results.length} checks failed.` : `All ${results.length} checks passed.`);
    process.exit(failed ? 1 : 0);
})();
