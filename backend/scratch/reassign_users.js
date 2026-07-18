/**
 * Reassign Platform users to ABC Test and JJ Test companies.
 *
 * Usage:
 *   node scratch/reassign_users.js --dry-run   # Preview changes
 *   node scratch/reassign_users.js --apply      # Apply changes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');

const DRY_RUN = !process.argv.includes('--apply');

// --- Users to assign to "ABC Test" company ---
const ABC_EMAILS = [
    'ashok.advani@stelmec.com',
    'test@admin.com',
    'test@example.com',
    'test@user.final',
    'admin2@gmail.com',       // Admin (Admin2@gmail.com)
    'a9819191140@gmail.com',  // Abhishek Advani
    'sales@example.com',      // John Sales
];

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    // 1. List all companies
    const companies = await Company.find({}).lean();
    console.log('=== Existing Companies ===');
    const companyIds = new Set(companies.map(c => c._id.toString()));
    companies.forEach(c => {
        console.log(`  ${c.name} (${c._id}) [${c.status || 'no status'}]`);
    });
    console.log();

    // 2. Find ALL users and identify "orphan" / Platform users
    const allUsers = await User.find(
        {},
        { name: 1, email: 1, role: 1, isActive: 1, companyId: 1 }
    ).lean();

    console.log(`=== All Users (${allUsers.length}) ===`);
    for (const u of allUsers) {
        const companyMatch = companies.find(c => c._id.toString() === u.companyId?.toString());
        const companyLabel = companyMatch ? companyMatch.name : `ORPHAN (companyId: ${u.companyId || 'null'})`;
        console.log(`  ${u.name} <${u.email}> | company: ${companyLabel} | role: ${u.role} | ${u.isActive ? 'ACTIVE' : 'INACTIVE'}`);
    }
    console.log();

    // 3. Find users that show as "Platform" (orphan companyIds or specific company)
    // They might have a companyId that doesn't match any existing company,
    // or they might all share one companyId. Let's find them by email.
    const targetEmails = [
        ...ABC_EMAILS,
        'dear@gmail.com',
    ].map(e => e.toLowerCase().trim());

    const platformUsers = allUsers.filter(u => {
        const emailLower = u.email.toLowerCase().trim();
        // Include the explicit list plus any user whose company doesn't exist
        return targetEmails.includes(emailLower) || !u.companyId || !companyIds.has(u.companyId.toString());
    });

    console.log(`=== "Platform" Users (${platformUsers.length}) ===`);
    platformUsers.forEach(u => {
        console.log(`  ${u.name} <${u.email}> [companyId: ${u.companyId}]`);
    });
    console.log();

    // 4. Find or create "ABC Test" company
    let abcCompany = companies.find(c => /abc\s*test/i.test(c.name));
    if (!abcCompany) {
        if (DRY_RUN) {
            console.log('[DRY RUN] Would CREATE company: "ABC Test"');
            abcCompany = { _id: '<new>', name: 'ABC Test' };
        } else {
            abcCompany = await Company.create({ name: 'ABC Test', status: 'ACTIVE' });
            console.log(`Created company: ABC Test (${abcCompany._id})`);
        }
    } else {
        console.log(`Found existing company: ${abcCompany.name} (${abcCompany._id})`);
    }

    // 5. Find or create "JJ Test" company
    let jjCompany = companies.find(c => /jj\s*test/i.test(c.name));
    if (!jjCompany) {
        if (DRY_RUN) {
            console.log('[DRY RUN] Would CREATE company: "JJ Test"');
            jjCompany = { _id: '<new>', name: 'JJ Test' };
        } else {
            jjCompany = await Company.create({ name: 'JJ Test', status: 'ACTIVE' });
            console.log(`Created company: JJ Test (${jjCompany._id})`);
        }
    } else {
        console.log(`Found existing company: ${jjCompany.name} (${jjCompany._id})`);
    }
    console.log();

    // 6. Categorize users
    const abcNormalized = ABC_EMAILS.map(e => e.toLowerCase().trim());

    const abcUsers = [];
    const jjUsers = [];
    const skipUsers = [];

    for (const u of platformUsers) {
        const emailLower = u.email.toLowerCase().trim();
        if (emailLower === 'admin@gmail.com' || u.role === 'SUPER_ADMIN') {
            skipUsers.push(u);
        } else if (abcNormalized.includes(emailLower)) {
            abcUsers.push(u);
        } else {
            jjUsers.push(u);
        }
    }

    console.log('=== Assignment Plan ===\n');

    console.log(`→ ABC Test (${abcUsers.length} users):`);
    abcUsers.forEach(u => console.log(`    ${u.name} <${u.email}>`));

    console.log(`\n→ JJ Test (${jjUsers.length} users):`);
    jjUsers.forEach(u => console.log(`    ${u.name} <${u.email}>`));

    console.log(`\n→ SKIPPED / kept separate (${skipUsers.length} users):`);
    skipUsers.forEach(u => console.log(`    ${u.name} <${u.email}>`));
    console.log();

    if (DRY_RUN) {
        console.log('=== DRY RUN — no changes applied ===');
        console.log('Run with --apply to execute these changes.');
    } else {
        // Apply ABC assignments
        if (abcUsers.length > 0) {
            const result = await User.updateMany(
                { _id: { $in: abcUsers.map(u => u._id) } },
                { $set: { companyId: abcCompany._id } },
                { bypassTenant: true }
            );
            console.log(`✔ Assigned ${result.modifiedCount} users to ABC Test`);
        }

        // Apply JJ assignments
        if (jjUsers.length > 0) {
            const result = await User.updateMany(
                { _id: { $in: jjUsers.map(u => u._id) } },
                { $set: { companyId: jjCompany._id } },
                { bypassTenant: true }
            );
            console.log(`✔ Assigned ${result.modifiedCount} users to JJ Test`);
        }

        console.log('\n=== Done! All changes applied. ===');
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
