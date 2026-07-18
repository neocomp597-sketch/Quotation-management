const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Planning = require('../models/Planning');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const sample = await Planning.findOne({}).lean();
        console.log("Sample Planning Document:", JSON.stringify(sample, null, 2));
        
        const uniqueMonthYears = await Planning.distinct("monthYear");
        console.log("Unique MonthYears in DB:", uniqueMonthYears);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
