/**
 * assign_mgr4_to_products.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Bulk-assigns MGR4 to every product in your company by matching each MGR4's
 * code and description keywords against the product name (case-insensitive).
 *
 * Strategy:
 *   1. Load all active MGR4 records.
 *   2. For each product, find the MGR4 whose code or description best matches
 *      the product name (longest / most-specific keyword wins).
 *   3. If a match is found AND the product's current mgr4 is different, update it.
 *
 * Usage (from the backend/ directory):
 *   node scripts/assign_mgr4_to_products.js
 *
 * Optional env / args:
 *   DRY_RUN=true   node scripts/assign_mgr4_to_products.js   → prints matches without saving
 *   COMPANY_ID=xxx node scripts/assign_mgr4_to_products.js   → limit to one company
 * ──────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN    = process.env.DRY_RUN === 'true';
const COMPANY_ID = process.env.COMPANY_ID || null;

async function main() {
    const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!MONGO_URI) {
        console.error('❌  Set MONGO_URI in .env before running this script.');
        process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected to MongoDB');
    if (DRY_RUN) console.log('⚠️   DRY RUN — no changes will be saved.\n');

    const MGR     = require('../models/MGR');
    const Product = require('../models/Product');

    // ── 1. Load all active MGR4 records ────────────────────────────────────────
    const mgr4Filter = COMPANY_ID
        ? { mgrType: 'MGR4', status: 'Active', companyId: new mongoose.Types.ObjectId(COMPANY_ID) }
        : { mgrType: 'MGR4', status: 'Active' };

    const mgr4List = await MGR.find(mgr4Filter).lean();
    if (!mgr4List.length) {
        console.error('❌  No active MGR4 records found. Create MGR4 entries first.');
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`📦  Found ${mgr4List.length} MGR4 records:`);
    mgr4List.forEach(m => console.log(`   • [${m.code}]  ${m.description}`));
    console.log('');

    // Build keyword arrays from each MGR4's code + description words (>= 3 chars, unique)
    const mgr4Keywords = mgr4List.map(m => {
        const words = [
            ...String(m.code || '').split(/[\s\-\/,]+/),
            ...String(m.description || '').split(/[\s\-\/,]+/)
        ]
            .map(w => w.trim().toLowerCase())
            .filter(w => w.length >= 3);

        // De-duplicate
        const unique = [...new Set(words)];
        return { mgr: m, keywords: unique };
    });

    // ── 2. Load all products ────────────────────────────────────────────────────
    const productFilter = COMPANY_ID
        ? { companyId: new mongoose.Types.ObjectId(COMPANY_ID) }
        : {};

    const products = await Product.find(productFilter)
        .select('_id productCode productName mgr4 companyId')
        .lean();

    console.log(`🏷️   Processing ${products.length} products...\n`);

    let matched   = 0;
    let updated   = 0;
    let skipped   = 0;
    let noMatch   = 0;
    const unmatched = [];

    for (const product of products) {
        const nameLower = String(product.productName || '').toLowerCase();

        // Score each MGR4 by counting how many of its keywords appear in the product name
        let bestMgr4  = null;
        let bestScore = 0;
        let bestTotalLen = 0;

        for (const { mgr, keywords } of mgr4Keywords) {
            let score = 0;
            let totalLen = 0;
            for (const kw of keywords) {
                if (nameLower.includes(kw)) {
                    score++;
                    totalLen += kw.length;
                }
            }
            if (
                score > bestScore ||
                (score === bestScore && score > 0 && totalLen > bestTotalLen)
            ) {
                bestScore    = score;
                bestTotalLen = totalLen;
                bestMgr4     = mgr;
            }
        }

        if (!bestMgr4 || bestScore === 0) {
            noMatch++;
            unmatched.push(`  ⚠️  No MGR4 match: [${product.productCode}] ${product.productName}`);
            continue;
        }

        matched++;
        const currentMgr4Id = String(product.mgr4 || '');
        const newMgr4Id     = String(bestMgr4._id);

        if (currentMgr4Id === newMgr4Id) {
            skipped++;
            continue;
        }

        console.log(
            `  ✔  [${product.productCode}] ${product.productName}\n` +
            `     → MGR4: [${bestMgr4.code}] ${bestMgr4.description}` +
            (currentMgr4Id ? ` (was ${currentMgr4Id})` : ' (new)')
        );

        if (!DRY_RUN) {
            await Product.findByIdAndUpdate(product._id, { mgr4: bestMgr4._id, updatedAt: new Date() });
        }
        updated++;
    }

    console.log('\n── Summary ─────────────────────────────────────────────────');
    console.log(`  Total products : ${products.length}`);
    console.log(`  Matched        : ${matched}`);
    console.log(`  Updated        : ${updated}  ${DRY_RUN ? '(dry run — not saved)' : ''}`);
    console.log(`  Already set    : ${skipped}`);
    console.log(`  No MGR4 match  : ${noMatch}`);

    if (unmatched.length) {
        console.log('\n🔍  Products with no matching MGR4:');
        unmatched.forEach(l => console.log(l));
    }

    if (!DRY_RUN && updated > 0) {
        // Invalidate product cache
        try {
            const { invalidateProductCaches } = require('../utils/cacheInvalidation');
            await invalidateProductCaches();
            console.log('\n✅  Product cache invalidated.');
        } catch (_) { /* cache may not be available in script context */ }
    }

    await mongoose.disconnect();
    console.log('🔌  Disconnected.\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
