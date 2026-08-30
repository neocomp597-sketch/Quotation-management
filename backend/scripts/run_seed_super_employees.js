const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { seedSuperEmployees } = require('../services/seedSuperEmployeesService');

async function run() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation_db';
        console.log('Connecting to MongoDB at:', mongoUri);
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB.');

        const result = await seedSuperEmployees();
        console.log('\n================ RESULT ================');
        console.log(JSON.stringify(result, null, 2));
        console.log('========================================\n');

        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Execution Error:', err);
        process.exit(1);
    }
}

run();
