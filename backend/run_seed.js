const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const seedData = require('./seed_data_direct');

async function run() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected. Running seedData...');
        await seedData();
        console.log('Finished seedData.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
