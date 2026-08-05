const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const SystemUpdate = require('../models/SystemUpdate');

async function checkAll() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tally-quotations');
    const docs = await SystemUpdate.find({});
    docs.forEach(doc => {
        console.log(`=== Version: ${doc.version} ===`);
        if (doc.releaseNotes) {
            console.log('  Release Notes:', JSON.stringify(doc.releaseNotes, null, 2));
        }
        if (doc.detailedChanges) {
            console.log('  Detailed Changes:', JSON.stringify(doc.detailedChanges, null, 2));
        }
    });
    process.exit(0);
}

checkAll();
