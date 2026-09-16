const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Branch = require('../models/Branch');
const User = require('../models/User');

async function testMatch() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'super@gmail.com' });
    const companyId = user.companyId;

    const branches = await Branch.find({ companyId });
    console.log("Branches in DB:");
    branches.forEach(b => console.log(`- ID: ${b._id}, Name: "${b.name}", Code: "${b.code}", Prefix: "${b.branchPrefix}"`));

    const excelPath = path.join(__dirname, '../../Employee Report Writer - 1509.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const locationCounts = {};
    rows.forEach(r => {
        const loc = r.Location ? String(r.Location).trim() : 'MISSING';
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    console.log("\nLocation counts in Excel:");
    console.table(locationCounts);

    // Helper to normalize strings for comparison (stripping spaces, special chars, case-insensitive)
    function normalize(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    console.log("\nMatching Logic Test:");
    Object.keys(locationCounts).sort().forEach(loc => {
        const normLoc = normalize(loc);
        let matched = null;
        for (let b of branches) {
            const normName = normalize(b.name);
            const normCode = normalize(b.code);
            const normPrefix = normalize(b.branchPrefix);
            const normCity = normalize(b.city);

            if (normLoc === normName || normLoc === normCode || normLoc === normPrefix || (normCity && normLoc === normCity)) {
                matched = b;
                break;
            }
            // Also check common variants e.g. "usgaon" vs "usgoan" or "ullaria" vs "ularia"
            // "usgaon" -> "u s g a o n", "usgoan" -> "u s g o a n"
            if (
                (normLoc === 'usgaon' && normName === 'usgoan') ||
                (normLoc === 'usgoan' && normName === 'usgaon') ||
                (normLoc === 'ullaria' && normName === 'ularia') ||
                (normLoc === 'ularia' && normName === 'ullaria')
            ) {
                matched = b;
                break;
            }
        }
        console.log(`Location: "${loc}" (${locationCounts[loc]} emps) => ${matched ? `ASSIGN "${matched.name}" (ID: ${matched._id})` : 'BLANK'}`);
    });

    process.exit(0);
}
testMatch();
