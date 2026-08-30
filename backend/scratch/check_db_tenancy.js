const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Company = require('../models/Company');
const RolePermission = require('../models/RolePermission');

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/quotation_db');
    console.log('--- COMPANIES ---');
    const companies = await Company.find().lean();
    console.log(companies.map(c => ({ id: c._id.toString(), name: c.companyName || c.name, code: c.code })));

    console.log('\n--- ADMIN USERS ---');
    const users = await User.find({ role: { $in: ['admin', 'super_admin', 'superadmin'] } }).lean();
    console.log(users.map(u => ({ id: u._id.toString(), email: u.email, role: u.role, companyId: u.companyId?.toString() })));

    console.log('\n--- ROLE PERMISSIONS COUNT BY COMPANY ---');
    const rolePerms = await RolePermission.find().lean();
    console.log(rolePerms.map(rp => ({ id: rp._id.toString(), role: rp.role, companyId: rp.companyId?.toString(), label: rp.label })));

    await mongoose.disconnect();
}

run().catch(console.error);
