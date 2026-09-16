const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');

async function inspectRemaining() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'super@gmail.com' });
    const companyId = user.companyId;

    const employees = await EmployeeProfile.find({ companyId }).lean();
    console.log(`Total Employees in DB: ${employees.length}`);

    const users = await User.find({ companyId, role: 'employee' }).lean();
    console.log(`Total Employee Users in DB: ${users.length}`);

    const userEmails = new Set(users.map(u => u.email.toLowerCase()));
    const unSynced = [];

    employees.forEach(emp => {
        const empEmail = emp.email ? emp.email.trim().toLowerCase() : '';
        if (empEmail && !userEmails.has(empEmail)) {
            unSynced.push({ id: emp._id, empId: emp.employeeId, name: emp.name, email: emp.email });
        }
    });

    console.log(`Unsynced employees count: ${unSynced.length}`);
    if (unSynced.length > 0) {
        console.log("Sample unsynced:", unSynced.slice(0, 10));
    }

    process.exit(0);
}

inspectRemaining();
