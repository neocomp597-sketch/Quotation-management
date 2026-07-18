const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Customer = require('../models/Customer');

async function run() {
    try {
        console.log('Connecting to MONGO_URI:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');
        
        // Find the latest saved customer
        const latest = await Customer.findOne().sort({ createdAt: -1 }).lean();
        console.log('Latest customer in DB:', JSON.stringify(latest, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

run();
