const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const { syncUsersForExistingVendors } = require('../services/vendorUserService');

async function runSync() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const res = await syncUsersForExistingVendors();
        console.log("Sync Result:", res);

        const vendors = await Vendor.find({}).lean();
        console.log(`Total vendors in DB: ${vendors.length}`);

        for (const v of vendors) {
            const user = v.vendorUserId ? await User.findById(v.vendorUserId).lean() : await User.findOne({ email: v.email || v.username }).lean();
            console.log(`Vendor: "${v.name}" | Email: "${v.email}" | Username: "${v.username}" | loginEnabled: ${v.loginEnabled} | User Created: ${!!user} | Role: ${user?.role}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

runSync();
