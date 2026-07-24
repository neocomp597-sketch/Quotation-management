const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Asset = require('../models/Asset');

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db');
    console.log('Distinct statuses:', await Asset.distinct('status'));
    console.log('Distinct statuses with customerId:', await Asset.distinct('status', { customerId: { $ne: null } }));
    console.log('Count of SOLD:', await Asset.countDocuments({ status: 'SOLD' }));
    console.log('Count of IN_STOCK:', await Asset.countDocuments({ status: 'IN_STOCK' }));
    const sampleSold = await Asset.find({ status: 'SOLD' }).limit(5).lean();
    console.log('Sample SOLD:', sampleSold);
    await mongoose.disconnect();
}
run();
