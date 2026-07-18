const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const SystemUpdate = require('../models/SystemUpdate');

async function run() {
    try {
        console.log("Connecting to database at:", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully!");

        // 1. Clean up old test data if exists
        await SystemUpdate.deleteMany({ version: 'v99.9.9' });
        console.log("Cleaned up old test updates.");

        // 2. Create a test update
        const update = new SystemUpdate({
            version: 'v99.9.9',
            title: 'Test Integration Version',
            message: 'This is a scratch-based integration test for system updates.',
            releaseNotes: [
                'Test release note item 1',
                'Test release note item 2',
                'Test release note item 3'
            ],
            deployedBy: 'Scratch Test Runner'
        });

        await update.save();
        console.log("Created test update successfully!");

        // 3. Query all updates
        const allUpdates = await SystemUpdate.find({ isActive: true }).sort({ deployedAt: -1 }).lean();
        console.log(`Found ${allUpdates.length} system updates in database.`);
        const found = allUpdates.find(u => u.version === 'v99.9.9');
        if (found) {
            console.log("Integration test matches: verified created update successfully!");
            console.log("Update Details:", found);
        } else {
            throw new Error("Could not find the created test update in results!");
        }

        // 4. Retrieve latest update
        const latest = await SystemUpdate.findOne({ isActive: true }).sort({ deployedAt: -1 }).lean();
        console.log("Latest Update retrieved:", latest.version, latest.title);

        // 5. Clean up
        await SystemUpdate.deleteMany({ version: 'v99.9.9' });
        console.log("Removed test update. Verification complete!");

        process.exit(0);
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

run();
