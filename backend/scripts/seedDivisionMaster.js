/**
 * One-time seed: the standard Division Master for companies that existed before the
 * Division Master was added. New companies get it when they are created (models/Company.js).
 *
 * Inserts only the default codes a company is missing (U, UC, IND, EXP, CCD, OTHERS);
 * existing divisions are never changed. Dry run unless --apply is given.
 *
 * Usage (from backend/):
 *   node scripts/seedDivisionMaster.js --company=<companyId>            # report only
 *   node scripts/seedDivisionMaster.js --company=<companyId> --apply
 *   node scripts/seedDivisionMaster.js --all-companies --apply
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('../models/Company');
const Division = require('../models/Division');
const { DEFAULT_DIVISIONS, seedDefaultDivisions } = require('../utils/divisionSegment');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ALL_COMPANIES = args.includes('--all-companies');
const companyArg = (args.find(a => a.startsWith('--company=')) || '').split('=')[1];

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

    const companies = companyArg
        ? await Company.find({ _id: companyArg }).select('_id name').lean()
        : await Company.find({}).select('_id name').lean();
    if (!companies.length) console.log('No matching company found.');

    console.log(APPLY ? 'APPLY' : 'DRY RUN');
    for (const company of companies) {
        const existing = await Division.find({ companyId: company._id })
            .setOptions({ bypassTenant: true })
            .select('code')
            .lean();
        const have = new Set(existing.map(d => d.code));
        const missing = DEFAULT_DIVISIONS.filter(d => !have.has(d.code)).map(d => d.code);
        console.log(`[${company._id}] ${company.name}: ${existing.length} division(s), missing: ${missing.join(', ') || 'none'}`);
        if (APPLY && missing.length) {
            const inserted = await seedDefaultDivisions(company._id);
            console.log(`[${company._id}] inserted: ${inserted}`);
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
