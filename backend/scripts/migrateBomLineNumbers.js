/**
 * Migration for hierarchical BOM numbering (all companies).
 *
 * What the data looks like
 *   The hierarchy is already stored: BOMItem.bomMasterId is the parent BOM, and a line whose
 *   item code has a BOM of its own is a sub-assembly. Each line's sibling number is lineNo, so
 *   1.3.2 is line 2 of the BOM opened by line 3 of the product. No number strings are stored.
 *
 * What this does
 *   1. Checks every BOM's lines: lineNo must be a whole number >= 1 and unique within the BOM.
 *      A line that breaks this (missing, zero, fractional, or a duplicate) gets the next number
 *      after the BOM's highest; valid lines keep theirs, so no established number changes.
 *   2. Sets BOMMaster.lastLineNo (the counter new lines continue from) and componentCount.
 *   3. Creates the unique { bomMasterId, lineNo } index.
 *   It also reports lines whose BOM no longer exists (left alone).
 *
 * Dry run by default. Re-running is safe.
 *   node scripts/migrateBomLineNumbers.js            # report only
 *   node scripts/migrateBomLineNumbers.js --apply    # write the fixes and create the index
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const BOMItem = require('../models/BOMItem');

const APPLY = process.argv.includes('--apply');
const isValid = (value) => Number.isInteger(value) && value >= 1;

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const masters = db.collection('bommasters');
    const items = db.collection('bomitems');

    const report = { boms: 0, lines: 0, bomsToFix: 0, linesToRenumber: 0, countersToSet: 0, orphanLines: 0 };

    const masterIds = new Set((await masters.find({}, { projection: { _id: 1 } }).toArray()).map((m) => String(m._id)));
    for await (const master of masters.find({}, { projection: { _id: 1, fgItemCode: 1, companyId: 1, lastLineNo: 1, componentCount: 1 } })) {
        report.boms++;
        const lines = await items.find({ bomMasterId: master._id }, { projection: { _id: 1, lineNo: 1 } })
            .sort({ lineNo: 1, _id: 1 })
            .toArray();
        report.lines += lines.length;

        const seen = new Set();
        const bad = [];
        lines.forEach((line) => {
            if (isValid(line.lineNo) && !seen.has(line.lineNo)) seen.add(line.lineNo);
            else bad.push(line);
        });
        let next = Math.max(0, ...seen);
        const fixes = bad.map((line) => ({ id: line._id, from: line.lineNo, to: ++next }));
        const lastLineNo = Math.max(master.lastLineNo || 0, next);

        if (fixes.length) {
            report.bomsToFix++;
            report.linesToRenumber += fixes.length;
            console.log(`BOM ${master.fgItemCode} (${master._id}): ${fixes.map((f) => `${f.from ?? 'none'} -> ${f.to}`).join(', ')}`);
        }
        const counterChanges = master.lastLineNo !== lastLineNo || master.componentCount !== lines.length;
        if (counterChanges) report.countersToSet++;

        if (APPLY) {
            if (fixes.length) {
                await items.bulkWrite(fixes.map((fix) => ({ updateOne: { filter: { _id: fix.id }, update: { $set: { lineNo: fix.to } } } })));
            }
            if (counterChanges) {
                await masters.updateOne({ _id: master._id }, { $set: { lastLineNo, componentCount: lines.length } });
            }
        }
    }

    const lineBoms = await items.distinct('bomMasterId');
    const orphanIds = lineBoms.filter((id) => !masterIds.has(String(id)));
    if (orphanIds.length) report.orphanLines = await items.countDocuments({ bomMasterId: { $in: orphanIds } });

    if (APPLY) {
        await BOMItem.createIndexes();
        const names = (await items.indexes()).map((index) => index.name);
        console.log('Indexes on bomitems:', names.join(', '));
    }

    console.log(APPLY ? 'Applied.' : 'Dry run (nothing written). Use --apply to write.', report);
    await mongoose.disconnect();
})().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
