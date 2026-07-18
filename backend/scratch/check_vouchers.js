const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');
const Warranty = require('../models/Warranty');

async function run() {
    await connectDB();
    const warranties = await Warranty.find({}).limit(10).lean();
    console.log(`Found ${warranties.length} warranties:`);
    for (const w of warranties) {
        console.log(`- Serial: ${w.serialNumber}, customerId: ${w.customerId}, productId: ${w.productId}`);
    }
    process.exit(0);
}

run().catch(console.error);
