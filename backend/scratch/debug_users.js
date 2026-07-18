const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');
const Company = require('../models/Company');
const Customer = require('../models/Customer');

async function run() {
    try {
        console.log("Connecting to database at:", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully!");

        // 1. Fetch users
        const users = await User.find({ email: { $in: ['admin@gmail.com', 'guest@gmail.com'] } }).lean();
        console.log("\n--- Users ---");
        console.log(users);

        // 2. Fetch companies
        const companies = await Company.find({}).lean();
        console.log("\n--- Companies ---");
        console.log(companies);

        // 3. Fetch customers (bypassing tenant filter to see raw customers)
        // Since tenantPlugin intercepts queries, let's bypass it.
        const customers = await Customer.find({}).setOptions({ bypassTenant: true }).lean();
        console.log("\n--- Customers (Raw, Bypassing Tenant Filter) ---");
        console.log(customers);

        process.exit(0);
    } catch (e) {
        console.error("Debug failed:", e);
        process.exit(1);
    }
}

run();
