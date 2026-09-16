const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');

async function inspectUsers() {
    await mongoose.connect(process.env.MONGO_URI);
    const superUser = await User.findOne({ email: 'super@gmail.com' });
    const companyId = superUser.companyId;

    const users = await User.find({ companyId }).lean();
    console.log(`Total users for company (${companyId}): ${users.length}`);

    users.forEach(u => {
        console.log(`User: email=${u.email}, name="${u.name}", role=${u.role}, _id=${u._id}`);
    });

    process.exit(0);
}

inspectUsers();
