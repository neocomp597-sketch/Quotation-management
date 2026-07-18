const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');

async function run() {
    try {
        console.log("Connecting to database...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully!");

        // Fetch all users
        const users = await User.find({}).lean();
        console.log("\n--- All Users ---");
        users.forEach(u => {
            console.log(`Email: ${u.email}`);
            console.log(`Role: ${u.role}`);
            console.log(`CompanyId: ${u.companyId}`);
            console.log(`ID: ${u._id}`);
            console.log('------------------');
        });

        process.exit(0);
    } catch (e) {
        console.error("Debug failed:", e);
        process.exit(1);
    }
}

run();
