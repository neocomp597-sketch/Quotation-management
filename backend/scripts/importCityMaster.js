const mongoose = require('mongoose');
const path = require('path');
const xlsx = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CityMaster = require('../models/CityMaster');
const StateMaster = require('../models/StateMaster');

const DEFAULT_STATE_MAPPINGS = {
    'MAHARASHTRA': { state: 'Maharashtra', shortCode: 'MH' },
    'GUJARAT': { state: 'Gujarat', shortCode: 'GJ' },
    'KARNATAKA': { state: 'Karnataka', shortCode: 'KA' },
    'TELANGANA': { state: 'Telangana', shortCode: 'TS' },
    'ANDHRA PRADESH': { state: 'Andhra Pradesh', shortCode: 'AP' },
    'TAMIL NADU': { state: 'Tamil Nadu', shortCode: 'TN' },
    'DELHI': { state: 'Delhi (NCT)', shortCode: 'DL' },
    'DELHI (NCT)': { state: 'Delhi (NCT)', shortCode: 'DL' },
    'WEST BENGAL': { state: 'West Bengal', shortCode: 'WB' },
    'UTTAR PRADESH': { state: 'Uttar Pradesh', shortCode: 'UP' },
    'MADHYA PRADESH': { state: 'Madhya Pradesh', shortCode: 'MP' },
    'RAJASTHAN': { state: 'Rajasthan', shortCode: 'RJ' },
    'PUNJAB': { state: 'Punjab', shortCode: 'PB' },
    'HARYANA': { state: 'Haryana', shortCode: 'HR' },
    'BIHAR': { state: 'Bihar', shortCode: 'BR' },
    'KERALA': { state: 'Kerala', shortCode: 'KL' },
    'ODISHA': { state: 'Odisha', shortCode: 'OD' },
    'JHARKHAND': { state: 'Jharkhand', shortCode: 'JH' },
    'ASSAM': { state: 'Assam', shortCode: 'AS' },
    'CHHATTISGARH': { state: 'Chhattisgarh', shortCode: 'CG' },
    'HIMACHAL PRADESH': { state: 'Himachal Pradesh', shortCode: 'HP' },
    'UTTARAKHAND': { state: 'Uttarakhand', shortCode: 'UK' },
    'GOA': { state: 'Goa', shortCode: 'GA' },
    'JAMMU AND KASHMIR': { state: 'Jammu & Kashmir', shortCode: 'JK' },
    'JAMMU & KASHMIR': { state: 'Jammu & Kashmir', shortCode: 'JK' },
    'LADAKH': { state: 'Ladakh', shortCode: 'LA' },
    'CHANDIGARH': { state: 'Chandigarh', shortCode: 'CH' },
    'PUDUCHERRY': { state: 'Puducherry', shortCode: 'PY' },
    'TRIPURA': { state: 'Tripura', shortCode: 'TR' },
    'MEGHALAYA': { state: 'Meghalaya', shortCode: 'ML' },
    'MANIPUR': { state: 'Manipur', shortCode: 'MN' },
    'NAGALAND': { state: 'Nagaland', shortCode: 'NL' },
    'MIZORAM': { state: 'Mizoram', shortCode: 'MZ' },
    'ARUNACHAL PRADESH': { state: 'Arunachal Pradesh', shortCode: 'AR' },
    'SIKKIM': { state: 'Sikkim', shortCode: 'SK' },
    'ANDAMAN AND NICOBAR ISLANDS': { state: 'Andaman & Nicobar Islands', shortCode: 'AN' },
    'ANDAMAN & NICOBAR ISLANDS': { state: 'Andaman & Nicobar Islands', shortCode: 'AN' },
    'THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU': { state: 'Dadra & Nagar Haveli and Daman & Diu', shortCode: 'DH' },
    'DADRA & NAGAR HAVELI AND DAMAN & DIU': { state: 'Dadra & Nagar Haveli and Daman & Diu', shortCode: 'DH' },
    'LAKSHADWEEP': { state: 'Lakshadweep', shortCode: 'LD' }
};

const main = async () => {
    const filePath = path.join(__dirname, '..', '..', 'City Master.xlsx');
    console.log(`Loading excel from: ${filePath}`);

    if (!process.env.MONGO_URI) {
        console.error('MONGO_URI missing in backend/.env');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully.');

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    console.log(`Total rows read from Excel: ${rows.length}`);

    // Pre-fetch StateMaster lookup
    const dbStates = await StateMaster.find({}, null, { bypassTenant: true }).lean();
    const stateLookup = {};
    dbStates.forEach(s => {
        const normName = s.state.toUpperCase().replace(/\s+/g, ' ');
        stateLookup[normName] = { state: s.state, shortCode: s.shortCode };
        if (s.shortCode) stateLookup[s.shortCode.toUpperCase()] = { state: s.state, shortCode: s.shortCode };
    });

    Object.keys(DEFAULT_STATE_MAPPINGS).forEach(k => {
        if (!stateLookup[k]) stateLookup[k] = DEFAULT_STATE_MAPPINGS[k];
    });

    let batchOps = [];
    let processed = 0;
    let totalInsertedOrUpdated = 0;
    const BATCH_SIZE = 5000;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rawOffice = row.officename || row.office || row.city || row.City || '';
        const rawPincode = String(row.pincode || row.Pincode || row.pin || '').trim().replace(/\D/g, '');
        const rawState = String(row.statename || row.state || row.State || '').trim();
        const rawDistrict = String(row.district || row.District || '').trim();

        if (!rawOffice && !rawPincode && !rawState) continue;

        const pincode = rawPincode.padStart(6, '0').slice(-6);
        let mappedState = rawState;
        let mappedCode = '';

        if (rawState) {
            const norm = rawState.toUpperCase().replace(/\s+/g, ' ');
            if (stateLookup[norm]) {
                mappedState = stateLookup[norm].state;
                mappedCode = stateLookup[norm].shortCode;
            } else {
                const words = rawState.split(' ');
                mappedState = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                mappedCode = rawState.length >= 2 ? rawState.substring(0, 2).toUpperCase() : rawState.toUpperCase();
            }
        }

        const cityClean = rawOffice.trim() || 'Unknown City';
        const districtClean = rawDistrict.trim() || cityClean;

        batchOps.push({
            updateOne: {
                filter: { pincode, city: cityClean, state: mappedState },
                update: {
                    $set: {
                        country: 'India',
                        state: mappedState,
                        stateCode: mappedCode,
                        district: districtClean,
                        area: cityClean,
                        city: cityClean,
                        pincode,
                        status: 'Active',
                        updatedAt: new Date()
                    }
                },
                upsert: true
            }
        });

        processed++;

        if (batchOps.length >= BATCH_SIZE) {
            const res = await CityMaster.bulkWrite(batchOps, { ordered: false, bypassTenant: true });
            totalInsertedOrUpdated += (res.upsertedCount || 0) + (res.modifiedCount || 0);
            console.log(`Processed ${processed}/${rows.length} rows... (${totalInsertedOrUpdated} upserted/updated)`);
            batchOps = [];
        }
    }

    if (batchOps.length > 0) {
        const res = await CityMaster.bulkWrite(batchOps, { ordered: false, bypassTenant: true });
        totalInsertedOrUpdated += (res.upsertedCount || 0) + (res.modifiedCount || 0);
        console.log(`Processed final batch. Total processed: ${processed}/${rows.length}`);
    }

    const totalInDb = await CityMaster.countDocuments({}, { bypassTenant: true });
    const maharashtraCount = await CityMaster.countDocuments({ stateCode: 'MH' }, { bypassTenant: true });

    console.log(`\n=== IMPORT COMPLETED SUCCESSFULLY ===`);
    console.log(`Total rows in Excel: ${rows.length}`);
    console.log(`Total records in CityMaster collection: ${totalInDb}`);
    console.log(`Maharashtra (MH) records count: ${maharashtraCount}`);

    await mongoose.disconnect();
    process.exit(0);
};

main().catch(async (err) => {
    console.error('Import failed:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
