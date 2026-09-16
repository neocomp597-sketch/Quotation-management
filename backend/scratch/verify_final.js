const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Branch = require('../models/Branch');

async function verifyFinal() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'super@gmail.com' });
    const companyId = user.companyId;

    const totalEmps = await EmployeeProfile.countDocuments({ companyId });
    const assignedBranchEmps = await EmployeeProfile.countDocuments({ companyId, branchId: { $ne: null } });
    const blankBranchEmps = await EmployeeProfile.countDocuments({ companyId, branchId: null });

    console.log(`=== FINAL DB VERIFICATION FOR super@gmail.com ===`);
    console.log(`Total Employees in DB: ${totalEmps}`);
    console.log(`Employees assigned to existing Branch: ${assignedBranchEmps}`);
    console.log(`Employees with Branch left BLANK: ${blankBranchEmps}`);

    const branches = await Branch.find({ companyId });
    for (let b of branches) {
        const count = await EmployeeProfile.countDocuments({ companyId, branchId: b._id });
        console.log(`  - Branch "${b.name}": ${count} employees`);
    }

    process.exit(0);
}

verifyFinal();
