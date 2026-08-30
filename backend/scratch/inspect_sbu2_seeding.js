require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const CompanySettings = require('../models/CompanySettings');

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Find super@gmail.com user and company
        const superUser = await User.findOne({ email: 'super@gmail.com' });
        console.log('Super User:', superUser ? { id: superUser._id, companyId: superUser.companyId } : 'Not found');

        let companyId = superUser?.companyId;
        if (!companyId) {
            const company = await CompanySettings.findOne({});
            companyId = company?._id;
        }
        console.log('Company ID:', companyId);

        // Inspect Excel File
        const excelPath = path.join(__dirname, '../../Employee detail - SBU2.xlsx');
        const workbook = xlsx.readFile(excelPath);
        console.log('Sheet Names:', workbook.SheetNames);

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        console.log(`Total Excel Rows in ${sheetName}:`, rows.length);
        if (rows.length > 0) {
            console.log('Excel Columns:', Object.keys(rows[0]));
            console.log('Sample Excel Row 0:', rows[0]);
            console.log('Sample Excel Row 1:', rows[1]);
        }

        // Check seeded EmployeeProfiles in DB
        const profiles = await EmployeeProfile.find({ companyId }).limit(10).lean();
        console.log('\n--- Seeded Employee Profiles in DB (Sample 10) ---');
        profiles.forEach(p => {
            console.log({
                employeeId: p.employeeId,
                name: p.name,
                email: p.email,
                phone: p.phone,
                mobile: p.mobile,
                contactNumber: p.contactNumber
            });
        });

        // Check seeded Users in DB
        const users = await User.find({ companyId, role: { $ne: 'SuperAdmin' } }).limit(10).lean();
        console.log('\n--- Seeded Users in DB (Sample 10) ---');
        users.forEach(u => {
            console.log({
                name: u.name,
                email: u.email,
                phone: u.phone,
                mobile: u.mobile,
                role: u.role
            });
        });

        process.exit(0);
    } catch (err) {
        console.error('Inspection Error:', err);
        process.exit(1);
    }
}

inspect();
