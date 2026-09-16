const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');

async function inspectEmails() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'super@gmail.com' });
    const companyId = user.companyId;

    const employees = await EmployeeProfile.find({ companyId }).lean();
    console.log(`Total Employees in DB: ${employees.length}`);

    let withEmail = 0;
    let withoutEmail = 0;
    let uniqueEmails = new Set();
    let duplicateEmails = new Map();

    employees.forEach(emp => {
        if (emp.email && emp.email.trim()) {
            withEmail++;
            const em = emp.email.trim().toLowerCase();
            if (uniqueEmails.has(em)) {
                duplicateEmails.set(em, (duplicateEmails.get(em) || 1) + 1);
            } else {
                uniqueEmails.add(em);
            }
        } else {
            withoutEmail++;
        }
    });

    console.log(`- Employees WITH email: ${withEmail}`);
    console.log(`- Employees WITHOUT email (blank): ${withoutEmail}`);
    console.log(`- Unique email addresses: ${uniqueEmails.size}`);
    console.log(`- Duplicate emails count: ${duplicateEmails.size}`);
    if (duplicateEmails.size > 0) {
        console.log("Sample duplicates:", Array.from(duplicateEmails.entries()).slice(0, 10));
    }

    process.exit(0);
}

inspectEmails();
