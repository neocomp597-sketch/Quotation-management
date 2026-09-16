const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Branch = require('../models/Branch');

async function finalVerify() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'super@gmail.com' });
    const companyId = user.companyId;

    console.log(`=== FINAL VERIFICATION FOR super@gmail.com ===`);
    const branches = await Branch.find({ companyId });

    let grandTotal = 0;
    for (let b of branches) {
        const empCount = await EmployeeProfile.countDocuments({ companyId, branchId: b._id });
        grandTotal += empCount;
        console.log(`- Branch "${b.name}" (Code: ${b.code}, Prefix: ${b.branchPrefix}): ${empCount} employees`);
    }

    const unassigned = await EmployeeProfile.countDocuments({ companyId, branchId: null });
    console.log(`- Employees with Blank Branch: ${unassigned}`);
    console.log(`Total Employees in DB: ${grandTotal + unassigned}`);

    process.exit(0);
}

finalVerify();
