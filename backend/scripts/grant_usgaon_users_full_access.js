/**
 * grant_usgaon_users_full_access.js
 * ----------------------------------
 * Grants ALL ERP permission keys to every user assigned to the Usgaon branch.
 *
 * Usage:
 *   node backend/scripts/grant_usgaon_users_full_access.js
 *
 * What it does:
 *   1. Finds the Usgaon branch by name (case-insensitive) / code "USGOAN".
 *   2. Fetches all users whose branchId matches Usgaon.
 *   3. For each user, sets ALL known permission keys to true in customPermissions.
 *   4. Writes an audit log entry per user.
 *   5. Prints a full report (success / failed / skipped).
 *   6. Never touches: passwordHash, name, email, role, employeeProfileId, or any
 *      other non-permission field.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Branch = require('../models/Branch');
const { getAllPermissionKeys, sanitizePermissions } = require('../config/authorization');

// ── Build the "all true" permissions map ────────────────────────────────────
const ALL_KEYS = getAllPermissionKeys();

// De-duplicate (some child keys appear in multiple groups e.g. reports_main, purchase_grn)
const UNIQUE_KEYS = [...new Set(ALL_KEYS)];

const ALL_TRUE_PERMISSIONS = Object.fromEntries(UNIQUE_KEYS.map(k => [k, true]));
// sanitizePermissions ensures parent keys are derived correctly
const SANITIZED_FULL_PERMISSIONS = sanitizePermissions(ALL_TRUE_PERMISSIONS);

console.log(`\n📋 Total unique permission keys: ${UNIQUE_KEYS.length}`);
console.log(`📋 Sanitized keys: ${Object.keys(SANITIZED_FULL_PERMISSIONS).length}`);

// ── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!mongoUri) {
        console.error('❌  No MongoDB URI found in environment. Set MONGODB_URI.');
        process.exit(1);
    }

    console.log('\n🔌 Connecting to MongoDB…');
    await mongoose.connect(mongoUri);
    console.log('✅  Connected.\n');

    // ── Step 1: Find the Usgaon branch ──────────────────────────────────────
    const branch = await Branch.findOne({
        $or: [
            { name:  { $regex: /usgaon/i  } },
            { name:  { $regex: /usgoan/i  } },
            { code:  { $regex: /^USGOA?N$/i } },
            { branchPrefix: { $regex: /^USGOA?N$/i } }
        ]
    }).lean();

    if (!branch) {
        console.error('❌  Could not find Usgaon branch. Check branch name/code in the database.');
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`✅  Found branch: "${branch.name}" (code: ${branch.code}, _id: ${branch._id})`);
    const branchId = branch._id;

    // ── Step 2: Fetch all users in this branch ───────────────────────────────
    const users = await User.find({ branchId }).select('_id name email role customPermissions').lean();

    console.log(`\n👥  Users found in Usgaon branch: ${users.length}`);

    if (users.length === 0) {
        console.warn('⚠️   No users found. Verify branchId linkage.');
        await mongoose.disconnect();
        process.exit(0);
    }

    // ── Step 3: Apply full permissions ──────────────────────────────────────
    const results = {
        success:  [],
        failed:   [],
        skipped:  []
    };

    const timestamp = new Date().toISOString();
    console.log(`\n🔐  Granting ALL ${Object.keys(SANITIZED_FULL_PERMISSIONS).length} permissions to ${users.length} users…\n`);

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const idx  = i + 1;

        try {
            // Convert the sanitized plain object into a Map for Mongoose
            const permMap = new Map(Object.entries(SANITIZED_FULL_PERMISSIONS));

            await User.updateOne(
                { _id: user._id },
                { $set: { customPermissions: permMap } }
            );

            results.success.push({ id: user._id, name: user.name, email: user.email, role: user.role });

            if (idx % 25 === 0 || idx === users.length) {
                process.stdout.write(`\r  ✔  ${idx}/${users.length} done…`);
            }
        } catch (err) {
            results.failed.push({
                id:     user._id,
                name:   user.name,
                email:  user.email,
                reason: err.message
            });
        }
    }

    // ── Step 4: Verify ───────────────────────────────────────────────────────
    console.log('\n\n🔍  Verifying…');
    const verifyIds  = results.success.map(u => u.id);
    const verified   = await User.find({ _id: { $in: verifyIds } })
        .select('_id customPermissions')
        .lean();

    const verifyFailed = [];
    const keyCount     = Object.keys(SANITIZED_FULL_PERMISSIONS).length;

    for (const doc of verified) {
        const perms = doc.customPermissions instanceof Map
            ? Object.fromEntries(doc.customPermissions)
            : (typeof doc.customPermissions?.toObject === 'function'
                ? doc.customPermissions.toObject({ flattenMaps: true })
                : { ...doc.customPermissions });

        const setCount = Object.values(perms).filter(Boolean).length;
        if (setCount < keyCount) {
            verifyFailed.push({ id: doc._id, setCount, expected: keyCount });
        }
    }

    // ── Step 5: Print report ─────────────────────────────────────────────────
    console.log('\n');
    console.log('═'.repeat(70));
    console.log('  GRANT ALL ACCESS — FINAL REPORT');
    console.log('═'.repeat(70));
    console.log(`  Branch       : ${branch.name} (${branch.code})`);
    console.log(`  Timestamp    : ${timestamp}`);
    console.log(`  Total users  : ${users.length}`);
    console.log(`  ✅ Success   : ${results.success.length}`);
    console.log(`  ❌ Failed    : ${results.failed.length}`);
    console.log(`  ⚠️  Verify NG: ${verifyFailed.length}`);
    console.log('─'.repeat(70));

    if (results.failed.length > 0) {
        console.log('\n❌  FAILED USERS:');
        results.failed.forEach((u, i) =>
            console.log(`  ${i+1}. ${u.name} (${u.email}) — ${u.reason}`)
        );
    }

    if (verifyFailed.length > 0) {
        console.log('\n⚠️   VERIFICATION MISMATCH (set < expected):');
        verifyFailed.forEach((v, i) =>
            console.log(`  ${i+1}. _id=${v.id} — set ${v.setCount}/${v.expected} keys`)
        );
    }

    if (results.failed.length === 0 && verifyFailed.length === 0) {
        console.log('\n🎉  All users granted full access and verified successfully!');
    }

    // ── Step 6: Write audit log file ─────────────────────────────────────────
    const fs   = require('fs');
    const path = require('path');
    const logPath = path.resolve(__dirname, `grant_usgaon_audit_${Date.now()}.json`);
    const auditData = {
        operation:  'GRANT_ALL_ACCESS',
        branch:     { _id: branchId, name: branch.name, code: branch.code },
        timestamp,
        totalUsers:     users.length,
        successCount:   results.success.length,
        failedCount:    results.failed.length,
        verifyNgCount:  verifyFailed.length,
        permissionsGranted: Object.keys(SANITIZED_FULL_PERMISSIONS).length,
        successUsers:   results.success,
        failedUsers:    results.failed,
        verifyMismatch: verifyFailed
    };
    fs.writeFileSync(logPath, JSON.stringify(auditData, null, 2));
    console.log(`\n📄  Audit log saved to: ${logPath}`);
    console.log('═'.repeat(70) + '\n');

    await mongoose.disconnect();
    process.exit(results.failed.length > 0 || verifyFailed.length > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('\n💥  Unhandled error:', err.message);
    mongoose.disconnect();
    process.exit(1);
});
