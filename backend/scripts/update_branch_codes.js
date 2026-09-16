const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Branch = require('../models/Branch');
const { runWithTenant } = require('../middlewares/tenantContext');

const branchUpdates = [
    {
        id: '6a8d34e8ce4e4e951e10dbbf',
        expectedName: 'ULARIA',
        targetCode: 'SBU-I',
        state: 'Gujarat',
        country: 'India'
    },
    {
        id: '6a927734d38fc49a298a500a',
        expectedName: 'USGOAN',
        targetCode: 'SBU-II',
        state: 'Maharashtra',
        country: 'India'
    },
    {
        id: '6a944aa13b0e0f436ca251d7',
        expectedName: 'ANDHERI BAND- STAND',
        targetCode: 'HO',
        state: 'Maharashtra',
        country: 'India'
    },
    {
        id: '6a927827d38fc49a298a5028',
        expectedName: 'SATIVALI',
        targetCode: 'SBU-III',
        state: 'Maharashtra',
        country: 'India'
    },
    {
        id: '6a944a673b0e0f436ca251ce',
        expectedName: 'EPC',
        targetCode: 'EPC',
        state: 'Maharashtra',
        country: 'India'
    },
    {
        id: '6a8c061fac99b5d51a116b2e',
        expectedName: 'NASHIK',
        targetCode: 'STC',
        state: 'Maharashtra',
        country: 'India'
    }
];

async function updateBranchCodes() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const user = await User.findOne({ email: 'super@gmail.com' });
        const companyId = user.companyId;

        await runWithTenant(companyId, async () => {
            console.log(`Updating branches for company: ${companyId}\n`);

            for (const item of branchUpdates) {
                const branch = await Branch.findById(item.id);
                if (branch) {
                    const oldCode = branch.code;
                    const oldState = branch.state;
                    const oldCountry = branch.country;

                    branch.code = item.targetCode;
                    branch.state = item.state;
                    branch.country = item.country;
                    await branch.save();

                    console.log(`[UPDATED] Branch: "${branch.name}" (ID: ${branch._id})`);
                    console.log(`  - Code: '${oldCode}' => '${branch.code}' ${oldCode !== branch.code ? '(UPDATED)' : '(MATCHED)'}`);
                    console.log(`  - State: '${oldState}' => '${branch.state}'`);
                    console.log(`  - Country: '${oldCountry}' => '${branch.country}'`);
                } else {
                    console.log(`[NOT FOUND] Branch ID ${item.id}`);
                }
            }

            console.log("\nFinal Branch Summary in DB:");
            const allBranches = await Branch.find({ companyId });
            allBranches.forEach(b => {
                console.log(`- Name: "${b.name}", Code: "${b.code}", Prefix: "${b.branchPrefix}", State: "${b.state}", Country: "${b.country}"`);
            });
        });

        process.exit(0);
    } catch (err) {
        console.error("Error updating branch codes:", err);
        process.exit(1);
    }
}

updateBranchCodes();
