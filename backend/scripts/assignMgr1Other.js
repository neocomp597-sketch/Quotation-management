/**
 * One-time migration: assign MGR 1 = OTHER to Product Master records.
 *
 * For each company it uses the existing "other" MGR1 entry (code OTH / OTHER / OTHERS,
 * or description Other), creating "OTHER - Other" only when none exists, then sets
 * products' mgr1 to it.
 *
 * By default only products WITHOUT an MGR 1 (null / missing / pointing at a deleted
 * MGR) are changed, so legitimate assignments are kept. Pass --overwrite to set
 * MGR 1 = OTHER on every product of the company, replacing what is there.
 *
 * The run is a dry run unless --apply is given.
 *
 * Usage (from backend/):
 *   node scripts/assignMgr1Other.js --company=<companyId>                 # report only
 *   node scripts/assignMgr1Other.js --company=<companyId> --apply         # fill blanks
 *   node scripts/assignMgr1Other.js --company=<companyId> --apply --overwrite
 *   node scripts/assignMgr1Other.js --all-companies --apply               # every company
 */
require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const OVERWRITE = args.includes('--overwrite');
const ALL_COMPANIES = args.includes('--all-companies');
const companyArg = (args.find(a => a.startsWith('--company=')) || '').split('=')[1];

const OTHER_CODE = 'OTHER';
const OTHER_DESCRIPTION = 'Other';

const run = async () => {
    if (!process.env.MONGO_URI) {
        console.error('MONGO_URI is not set.');
        process.exit(1);
    }
    if (!ALL_COMPANIES && !companyArg) {
        console.error('Pass --company=<companyId> or --all-companies.');
        process.exit(1);
    }
    if (companyArg && !mongoose.Types.ObjectId.isValid(companyArg)) {
        console.error(`Invalid company id: ${companyArg}`);
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const products = db.collection('products');
    const mgrs = db.collection('mgrs');

    const companyIds = companyArg
        ? [new mongoose.Types.ObjectId(companyArg)]
        : (await products.distinct('companyId')).filter(Boolean);

    console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} | mode: ${OVERWRITE ? 'overwrite every product' : 'only products without MGR 1'}`);

    for (const companyId of companyIds) {
        // Reuse the company's existing "other" MGR1 (Stelmec keeps OTH - OTHER) before
        // creating one, so a re-run never adds a duplicate.
        let other = await mgrs.findOne({
            companyId,
            mgrType: 'MGR1',
            $or: [
                { code: { $regex: '^(OTH|OTHER|OTHERS)$', $options: 'i' } },
                { description: { $regex: '^others?$', $options: 'i' } }
            ]
        }, { sort: { createdAt: 1 } });

        if (!other) {
            console.log(`[${companyId}] MGR1 "${OTHER_CODE}" does not exist${APPLY ? ' - creating it' : ' - would be created'}`);
            if (APPLY) {
                const doc = {
                    companyId,
                    mgrType: 'MGR1',
                    code: OTHER_CODE,
                    description: OTHER_DESCRIPTION,
                    problemList: [],
                    status: 'Active',
                    createdAt: new Date()
                };
                const { insertedId } = await mgrs.insertOne(doc);
                other = { ...doc, _id: insertedId };
            }
        } else if (other.status !== 'Active') {
            console.log(`[${companyId}] MGR1 "${other.code}" is ${other.status}${APPLY ? ' - activating it' : ' - would be activated'}`);
            if (APPLY) await mgrs.updateOne({ _id: other._id }, { $set: { status: 'Active' } });
        }

        let filter = { companyId };
        if (!OVERWRITE) {
            // "Without MGR 1" also covers a reference to an MGR that no longer exists.
            const validMgr1Ids = await mgrs.distinct('_id', { companyId, mgrType: 'MGR1' });
            filter = { companyId, $or: [{ mgr1: null }, { mgr1: { $exists: false } }, { mgr1: { $nin: validMgr1Ids } }] };
        }
        if (other) {
            filter = { $and: [filter, { mgr1: { $ne: other._id } }] };
        }

        const total = await products.countDocuments({ companyId });
        const toChange = await products.countDocuments(filter);
        console.log(`[${companyId}] products: ${total}, to set MGR 1 = ${OTHER_CODE}: ${toChange}`);

        if (APPLY && other && toChange > 0) {
            const result = await products.updateMany(filter, { $set: { mgr1: other._id, updatedAt: new Date() } });
            console.log(`[${companyId}] updated: ${result.modifiedCount}`);
        }
    }

    // Cached product lists embed MGR values; drop them so the change shows at once.
    if (APPLY) {
        try {
            const { invalidateProductCaches } = require('../utils/cacheInvalidation');
            await invalidateProductCaches();
        } catch (err) {
            console.warn('Product cache invalidation skipped:', err.message);
        }
    }

    await mongoose.disconnect();
    process.exit(0);
};

run().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
