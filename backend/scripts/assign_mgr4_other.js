/**
 * Assigns MGR4 "OTHER" to all products that don't have an MGR4 set.
 * Usage: node scripts/assign_mgr4_other.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function main() {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!MONGO_URI) { console.error('Set MONGO_URI in .env'); process.exit(1); }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const MGR = require('../models/MGR');
    const Product = require('../models/Product');

    // Find the "OTHER" MGR4 record
    const otherMgr4 = await MGR.findOne({
        mgrType: 'MGR4',
        code: { $regex: /^other$/i }
    }).lean();

    if (!otherMgr4) {
        console.error('No MGR4 with code "OTHER" found. Create it first.');
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`Found MGR4 OTHER: [${otherMgr4.code}] ${otherMgr4.description} (${otherMgr4._id})`);

    // Update ALL products to MGR4 OTHER
    const result = await Product.updateMany(
        {},
        { $set: { mgr4: otherMgr4._id, updatedAt: new Date() } }
    );

    console.log(`\nUpdated ${result.modifiedCount} products → MGR4: OTHER`);
    console.log(`(${result.matchedCount} matched, ${result.modifiedCount} modified)`);

    try {
        const { invalidateProductCaches } = require('../utils/cacheInvalidation');
        await invalidateProductCaches();
        console.log('Product cache invalidated.');
    } catch (_) {}

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
