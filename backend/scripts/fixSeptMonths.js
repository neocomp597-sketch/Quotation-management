const path = require('path');
const mongoose = require('mongoose');
const Planning = require('../models/Planning');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const FY_MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const run = async () => {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('MONGO_URI or MONGODB_URI is required');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully.');

    // 1. Find all documents where monthYear has 'Sept' or month is less than 1 or not 1-12
    const entries = await Planning.find({
        $or: [
            { monthYear: /Sept/i },
            { month: { $lt: 1 } },
            { month: { $gt: 12 } },
            { month: null }
        ]
    });

    console.log(`Found ${entries.length} entries with potential month issues.`);

    let updatedCount = 0;
    for (const entry of entries) {
        let changed = false;

        // Fix monthYear if it starts with 'Sept'
        if (entry.monthYear && entry.monthYear.toLowerCase().startsWith('sept')) {
            const parts = entry.monthYear.split('-');
            const yearSuffix = parts[1];
            entry.monthYear = `Sep-${yearSuffix}`;
            changed = true;
            console.log(`Updating monthYear: ${entry.monthYear} for ID ${entry._id}`);
        }

        // Calculate correct month index (1-12, starting Apr)
        if (entry.monthYear) {
            const prefix = entry.monthYear.split('-')[0].substring(0, 3);
            const expectedMonth = FY_MONTH_NAMES.findIndex(
                m => m.toLowerCase() === prefix.toLowerCase()
            ) + 1;

            if (expectedMonth > 0 && entry.month !== expectedMonth) {
                console.log(`Updating month from ${entry.month} to ${expectedMonth} for ID ${entry._id}`);
                entry.month = expectedMonth;
                changed = true;
            }
        }

        if (changed) {
            // Temporarily bypass validations if required, but standard save should work now since month is valid (1-12)
            await entry.save();
            updatedCount++;
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} entries.`);
};

run()
    .catch((error) => {
        console.error('Error during migration:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.close().catch(() => {});
        console.log('Connection closed.');
    });
