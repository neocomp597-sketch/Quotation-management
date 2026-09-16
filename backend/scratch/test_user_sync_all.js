const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');

async function testSyncAll() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'super@gmail.com' });
    const companyId = user.companyId;

    const employees = await EmployeeProfile.find({ companyId }).lean();
    console.log(`Total Employees in DB: ${employees.length}`);

    const existingUsers = await User.find({ companyId }).lean();
    console.log(`Current User accounts in DB: ${existingUsers.length}`);

    const usedEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));

    let generatedCount = 0;
    employees.forEach((emp, idx) => {
        let email = emp.email ? emp.email.trim().toLowerCase() : '';
        // If blank or already used by another user account
        if (!email || usedEmails.has(email)) {
            const codeClean = (emp.employeeId || emp.externalEmployeeCode || `EMP${1000 + idx}`).replace(/[^a-z0-9]/gi, '').toLowerCase();
            let fallbackEmail = `${codeClean}@stelmec.com`;
            let counter = 1;
            while (usedEmails.has(fallbackEmail)) {
                fallbackEmail = `${codeClean}_${counter}@stelmec.com`;
                counter++;
            }
            email = fallbackEmail;
            generatedCount++;
        }
        usedEmails.add(email);
    });

    console.log(`With auto-fallback unique email per employee code:`);
    console.log(`- Unique user account emails ready: ${usedEmails.size}`);
    console.log(`- Fallback emails generated for blank/duplicate emails: ${generatedCount}`);

    process.exit(0);
}

testSyncAll();
