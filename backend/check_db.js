const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Planning = require('./models/Planning');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const counts = await Planning.aggregate([
            { $group: { _id: "$financialYear", count: { $sum: 1 } } }
        ]);
        console.log("DB Counts:", counts);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
