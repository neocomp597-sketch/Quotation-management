const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../models/User');
const Salesperson = require('../models/Salesperson');
const Territory = require('../models/Territory');
const CompanySettings = require('../models/CompanySettings');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/quotation_management");
        console.log("DB Connected successfully.");

        const usersCount = await User.countDocuments({});
        console.log("Total Users in DB:", usersCount);
        const users = await User.find({}).select('name email role status').lean();
        console.log("Users:", users);

        const salespersonsCount = await Salesperson.countDocuments({});
        console.log("Total Salespersons in DB:", salespersonsCount);
        const salespersons = await Salesperson.find({}).lean();
        console.log("Salespersons:", salespersons);

        const territoriesCount = await Territory.countDocuments({});
        console.log("Total Territories in DB:", territoriesCount);
        const territories = await Territory.find({}).populate('parent').populate('manager').populate('salesReps').lean();
        console.log("Territories:", territories);

        const companySettingsCount = await CompanySettings.countDocuments({});
        console.log("Total CompanySettings in DB:", companySettingsCount);
        const companySettings = await CompanySettings.find({}).lean();
        console.log("Company Settings:", companySettings);

        process.exit(0);
    } catch (e) {
        console.error("Error in diagnostic script:", e);
        process.exit(1);
    }
}
run();
