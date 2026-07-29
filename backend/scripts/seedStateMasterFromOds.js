const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const StateMaster = require('../models/StateMaster');
const Company = require('../models/Company');

const STATE_MASTER_ROWS = [
    { state: 'Andhra Pradesh', shortCode: 'AP', gstCode: '37' },
    { state: 'Arunachal Pradesh', shortCode: 'AR', gstCode: '12' },
    { state: 'Assam', shortCode: 'AS', gstCode: '18' },
    { state: 'Bihar', shortCode: 'BR', gstCode: '10' },
    { state: 'Chhattisgarh', shortCode: 'CG', gstCode: '22' },
    { state: 'Goa', shortCode: 'GA', gstCode: '30' },
    { state: 'Gujarat', shortCode: 'GJ', gstCode: '24' },
    { state: 'Haryana', shortCode: 'HR', gstCode: '6' },
    { state: 'Himachal Pradesh', shortCode: 'HP', gstCode: '2' },
    { state: 'Jharkhand', shortCode: 'JH', gstCode: '20' },
    { state: 'Karnataka', shortCode: 'KA', gstCode: '29' },
    { state: 'Kerala', shortCode: 'KL', gstCode: '32' },
    { state: 'Madhya Pradesh', shortCode: 'MP', gstCode: '23' },
    { state: 'Maharashtra', shortCode: 'MH', gstCode: '27' },
    { state: 'Manipur', shortCode: 'MN', gstCode: '14' },
    { state: 'Meghalaya', shortCode: 'ML', gstCode: '17' },
    { state: 'Mizoram', shortCode: 'MZ', gstCode: '15' },
    { state: 'Nagaland', shortCode: 'NL', gstCode: '13' },
    { state: 'Odisha', shortCode: 'OD', gstCode: '21' },
    { state: 'Punjab', shortCode: 'PB', gstCode: '3' },
    { state: 'Rajasthan', shortCode: 'RJ', gstCode: '8' },
    { state: 'Sikkim', shortCode: 'SK', gstCode: '11' },
    { state: 'Tamil Nadu', shortCode: 'TN', gstCode: '33' },
    { state: 'Telangana', shortCode: 'TS', gstCode: '36' },
    { state: 'Tripura', shortCode: 'TR', gstCode: '16' },
    { state: 'Uttar Pradesh', shortCode: 'UP', gstCode: '9' },
    { state: 'Uttarakhand', shortCode: 'UK', gstCode: '5' },
    { state: 'West Bengal', shortCode: 'WB', gstCode: '19' },
    { state: 'Andaman & Nicobar Islands', shortCode: 'AN', gstCode: '35' },
    { state: 'Chandigarh', shortCode: 'CH', gstCode: '4' },
    { state: 'Dadra & Nagar Haveli and Daman & Diu', shortCode: 'DH', gstCode: '26' },
    { state: 'Delhi (NCT)', shortCode: 'DL', gstCode: '7' },
    { state: 'Jammu & Kashmir', shortCode: 'JK', gstCode: '1' },
    { state: 'Ladakh', shortCode: 'LA', gstCode: '38' },
    { state: 'Lakshadweep', shortCode: 'LD', gstCode: '31' },
    { state: 'Puducherry', shortCode: 'PY', gstCode: '34' },
];

const LEGACY_STATE_ALIASES = {
    'Andaman and Nicobar Islands': 'Andaman & Nicobar Islands',
    'Dadra and Nagar Haveli and Daman and Diu': 'Dadra & Nagar Haveli and Daman & Diu',
    Delhi: 'Delhi (NCT)',
    'Jammu and Kashmir': 'Jammu & Kashmir',
};

const seedForCompany = async (companyId) => {
    let upserted = 0;
    let updated = 0;
    let deletedDuplicates = 0;

    for (const row of STATE_MASTER_ROWS) {
        const legacyNames = Object.entries(LEGACY_STATE_ALIASES)
            .filter(([, canonicalName]) => canonicalName === row.state)
            .map(([legacyName]) => legacyName);
        const matchingNames = [row.state, ...legacyNames];
        const existingRows = await StateMaster.find(
            { companyId, state: { $in: matchingNames } },
            null,
            { bypassTenant: true }
        ).sort({ createdAt: 1 });

        const keepRow = existingRows.find(item => item.country === 'India' && item.state === row.state) || existingRows[0];
        if (!keepRow) continue;

        await StateMaster.updateOne(
            { _id: keepRow._id },
            {
                $set: {
                    country: 'India',
                    state: row.state,
                    shortCode: row.shortCode,
                    gstCode: row.gstCode,
                    status: keepRow.status || 'Active',
                    updatedAt: new Date(),
                },
            },
            { bypassTenant: true }
        );

        const duplicateIds = existingRows
            .filter(item => String(item._id) !== String(keepRow._id))
            .map(item => item._id);
        if (duplicateIds.length > 0) {
            const deleteResult = await StateMaster.deleteMany(
                { _id: { $in: duplicateIds } },
                { bypassTenant: true }
            );
            deletedDuplicates += deleteResult.deletedCount || 0;
        }
    }

    for (const row of STATE_MASTER_ROWS) {
        const result = await StateMaster.updateOne(
            { companyId, country: 'India', state: row.state },
            {
                $set: {
                    country: 'India',
                    state: row.state,
                    shortCode: row.shortCode,
                    gstCode: row.gstCode,
                    status: 'Active',
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    companyId,
                    createdAt: new Date(),
                },
            },
            { upsert: true, bypassTenant: true }
        );

        upserted += result.upsertedCount || 0;
        updated += result.modifiedCount || 0;
    }

    return { companyId: String(companyId), upserted, updated, deletedDuplicates };
};

const main = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is missing in backend/.env');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const companies = await Company.find({}, '_id name', { bypassTenant: true }).lean();
    if (companies.length === 0) {
        throw new Error('No companies found. State Master is tenant scoped, so there is no company to seed.');
    }

    const results = [];
    for (const company of companies) {
        results.push(await seedForCompany(company._id));
    }

    console.log(JSON.stringify({
        rowsPerCompany: STATE_MASTER_ROWS.length,
        companies: companies.map(company => ({ id: String(company._id), name: company.name })),
        results,
    }, null, 2));

    await mongoose.disconnect();
};

if (require.main === module) {
    main().catch(async (error) => {
        console.error(error);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    });
}

module.exports = {
    STATE_MASTER_ROWS,
    seedForCompany,
};
