/**
 * Migration script: assign MGR 4 = OTHER to all products (and assets) of Stelmec org.
 *
 * Usage (from backend/):
 *   node scripts/assignMgr4Other.js --company=6a8bf304ac99b5d51a116954 --apply --overwrite
 */
require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const OVERWRITE = args.includes('--overwrite');
const ALL_COMPANIES = args.includes('--all-companies');
const companyArg = (args.find(a => a.startsWith('--company=')) || '').split('=')[1] || '6a8bf304ac99b5d51a116954';

const OTHER_CODE = 'OTHER';
const OTHER_DESCRIPTION = 'other';

const run = async () => {
    if (!process.env.MONGO_URI) {
        console.error('MONGO_URI is not set.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const products = db.collection('products');
    const assets = db.collection('assets');
    const mgrs = db.collection('mgrs');

    const companyIds = companyArg
        ? [new mongoose.Types.ObjectId(companyArg)]
        : (await products.distinct('companyId')).filter(Boolean);

    console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} | mode: ${OVERWRITE ? 'overwrite every product' : 'only products without MGR 4'}`);

    for (const companyId of companyIds) {
        let other = await mgrs.findOne({
            companyId,
            mgrType: 'MGR4',
            $or: [
                { code: { $regex: '^(OTH|OTHER|OTHERS)$', $options: 'i' } },
                { description: { $regex: '^others?$', $options: 'i' } }
            ]
        }, { sort: { createdAt: 1 } });

        if (!other) {
            console.log(`[${companyId}] MGR4 "${OTHER_CODE}" does not exist${APPLY ? ' - creating it' : ' - would be created'}`);
            if (APPLY) {
                const doc = {
                    companyId,
                    mgrType: 'MGR4',
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
            console.log(`[${companyId}] MGR4 "${other.code}" is ${other.status}${APPLY ? ' - activating it' : ' - would be activated'}`);
            if (APPLY) await mgrs.updateOne({ _id: other._id }, { $set: { status: 'Active' } });
        }

        let filter = { companyId };
        if (!OVERWRITE) {
            const validMgr4Ids = await mgrs.distinct('_id', { companyId, mgrType: 'MGR4' });
            filter = { companyId, $or: [{ mgr4: null }, { mgr4: { $exists: false } }, { mgr4: { $nin: validMgr4Ids } }] };
        }
        if (other) {
            filter = { $and: [filter, { mgr4: { $ne: other._id } }] };
        }

        const totalProducts = await products.countDocuments({ companyId });
        const toChangeProducts = await products.countDocuments(filter);
        console.log(`[${companyId}] Products total: ${totalProducts}, to set MGR 4 = ${other ? other.code : OTHER_CODE}: ${toChangeProducts}`);

        if (APPLY && other && toChangeProducts > 0) {
            const result = await products.updateMany(filter, { $set: { mgr4: other._id, updatedAt: new Date() } });
            console.log(`[${companyId}] Products updated: ${result.modifiedCount}`);
        }

        // Also update assets of this company
        const totalAssets = await assets.countDocuments({ companyId });
        console.log(`[${companyId}] Assets (serialized products) total: ${totalAssets}`);
        if (APPLY && other) {
            const assetRes = await assets.updateMany(
                { companyId },
                { $set: { mgr4: OTHER_CODE } }
            );
            console.log(`[${companyId}] Assets updated with mgr4 = '${OTHER_CODE}': ${assetRes.modifiedCount}`);
        }
    }

    if (APPLY) {
        try {
            const { invalidateProductCaches } = require('../utils/cacheInvalidation');
            await invalidateProductCaches();
            console.log('Product caches successfully invalidated.');
        } catch (err) {
            console.warn('Product cache invalidation skipped:', err.message);
        }
    }

    await mongoose.disconnect();
    console.log('Migration finished successfully.');
    process.exit(0);
};

run().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
