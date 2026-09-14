const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Customer = require('../models/Customer');
const Asset = require('../models/Asset');
const Voucher = require('../models/Voucher');
const CustomerContact = require('../models/CustomerContact');

async function findDuplicatesAndFix() {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const allCusts = await Customer.find({}).lean();
        console.log(`Total Customers in DB: ${allCusts.length}`);

        // Find duplicates by externalCode or companyName
        const codeMap = {};
        allCusts.forEach(c => {
            const key = (c.externalCode || c.companyName || '').trim().toLowerCase();
            if (!key) return;
            if (!codeMap[key]) codeMap[key] = [];
            codeMap[key].push(c);
        });

        const duplicateGroups = Object.values(codeMap).filter(g => g.length > 1);
        console.log(`Found ${duplicateGroups.length} duplicate customer groups:`);

        for (const group of duplicateGroups) {
            console.log(`\nGroup (${group[0].companyName} / ${group[0].externalCode}):`);
            group.forEach(c => console.log(`  - ID: ${c._id}, companyName: ${c.companyName}, customerName: ${c.customerName}, code: ${c.externalCode}`));

            // Primary customer record (keep the one with oldest ID or the one linked to assets)
            const primary = group[0];
            const duplicateIds = group.slice(1).map(c => c._id);

            console.log(`Primary to KEEP: ${primary._id}`);
            console.log(`Duplicates to MERGE/REMOVE:`, duplicateIds);

            // Re-point Assets linked to duplicates -> Primary
            const updatedAssets = await Asset.updateMany(
                { customerId: { $in: duplicateIds } },
                { $set: { customerId: primary._id } }
            );
            console.log(`Updated ${updatedAssets.modifiedCount} Assets to Primary Customer ID.`);

            // Re-point Vouchers linked to duplicates -> Primary
            const updatedVouchers = await Voucher.updateMany(
                { customerId: { $in: duplicateIds } },
                { $set: { customerId: primary._id } }
            );
            console.log(`Updated ${updatedVouchers.modifiedCount} Vouchers to Primary Customer ID.`);

            // Re-point Contacts linked to duplicates -> Primary
            const updatedContacts = await CustomerContact.updateMany(
                { customerId: { $in: duplicateIds } },
                { $set: { customerId: primary._id } }
            );
            console.log(`Updated ${updatedContacts.modifiedCount} Contacts to Primary Customer ID.`);

            // Delete duplicate customer records
            const deletedCusts = await Customer.deleteMany({ _id: { $in: duplicateIds } });
            console.log(`Deleted ${deletedCusts.deletedCount} duplicate Customer records.`);
        }

        console.log('\nCustomer data cleanup complete!');
        process.exit(0);
    } catch (err) {
        console.error('Error during cleanup:', err);
        process.exit(1);
    }
}

findDuplicatesAndFix();
