const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Company = require('../models/Company');
const EmployeeProfile = require('../models/EmployeeProfile');

async function inspectAllEmployees() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const superUser = await User.findOne({ email: 'super@gmail.com' });
    console.log("superUser companyId:", superUser?.companyId);

    const allCompanies = await Company.find({}).lean();
    console.log("\nAll Companies in DB:", allCompanies.map(c => ({ id: c._id, name: c.name })));

    const allEmployees = await EmployeeProfile.find({}).lean();
    console.log(`\nTotal EmployeeProfile records across ALL companies: ${allEmployees.length}`);

    const companyCounts = {};
    allEmployees.forEach(e => {
        const cId = String(e.companyId || 'NO_COMPANY');
        companyCounts[cId] = (companyCounts[cId] || 0) + 1;
    });
    console.log("EmployeeProfile count by companyId:", companyCounts);

    const allUsers = await User.find({}).lean();
    console.log(`\nTotal User records across ALL companies: ${allUsers.length}`);
    const userRoleCounts = {};
    allUsers.forEach(u => {
        const r = `${u.role || 'no_role'} (company: ${u.companyId})`;
        userRoleCounts[r] = (userRoleCounts[r] || 0) + 1;
    });
    console.log("User count breakdown:", userRoleCounts);

    process.exit(0);
}

inspectAllEmployees();
