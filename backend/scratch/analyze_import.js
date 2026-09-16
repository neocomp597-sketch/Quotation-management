const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Company = require('../models/Company');
const Branch = require('../models/Branch');
const EmployeeProfile = require('../models/EmployeeProfile');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Engineer = require('../models/Engineer');
const PayrollEmployeeSummary = require('../models/PayrollEmployeeSummary');

async function analyze() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({ email: 'super@gmail.com' });
        const companyId = user.companyId;

        const branches = await Branch.find({ companyId });
        console.log("Existing Branches:");
        branches.forEach(b => console.log(`- ID: ${b._id}, Name: "${b.name}", Code: "${b.code}", Prefix: "${b.branchPrefix}", City: "${b.city}", State: "${b.state}"`));

        const excelPath = path.join(__dirname, '../../Employee Report Writer - 1509.xlsx');
        const workbook = XLSX.readFile(excelPath);
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        const locationsInExcel = new Set();
        const deptsInExcel = new Set();
        const desigsInExcel = new Set();

        rows.forEach(r => {
            if (r.Location) locationsInExcel.add(String(r.Location).trim());
            if (r.Department) deptsInExcel.add(String(r.Department).trim());
            if (r.Designation) desigsInExcel.add(String(r.Designation).trim());
        });

        console.log("\nLocations found in Excel (" + locationsInExcel.size + "):");
        console.log(Array.from(locationsInExcel).sort());

        console.log("\nMapping test for Excel locations against Existing Branches:");
        const branchMap = new Map();
        // Index branches by normalized name, code, prefix, city
        branches.forEach(b => {
            if (b.name) branchMap.set(b.name.trim().toLowerCase(), b);
            if (b.code) branchMap.set(b.code.trim().toLowerCase(), b);
            if (b.branchPrefix) branchMap.set(b.branchPrefix.trim().toLowerCase(), b);
            if (b.city) branchMap.set(b.city.trim().toLowerCase(), b);
        });

        locationsInExcel.forEach(loc => {
            const locNorm = loc.toLowerCase();
            // Check direct match
            let matchedBranch = branchMap.get(locNorm);
            if (!matchedBranch) {
                // Try fuzzy/exact sub-matches if applicable, or check if branch name matches location
                for (let b of branches) {
                    const bName = b.name.trim().toLowerCase();
                    const bCode = b.code.trim().toLowerCase();
                    const bPrefix = b.branchPrefix ? b.branchPrefix.trim().toLowerCase() : '';
                    if (locNorm === bName || locNorm === bCode || locNorm === bPrefix || (b.city && locNorm === b.city.trim().toLowerCase())) {
                        matchedBranch = b;
                        break;
                    }
                }
            }
            console.log(`Excel Location: "${loc}" => ${matchedBranch ? `MATCHED Branch "${matchedBranch.name}" (ID: ${matchedBranch._id})` : 'BLANK (No matching branch)'}`);
        });

        const empCount = await EmployeeProfile.countDocuments({ companyId });
        const userCount = await User.countDocuments({ companyId, role: { $ne: 'SUPER_ADMIN' } });
        const deptCount = await Department.countDocuments({ companyId });
        const desigCount = await Designation.countDocuments({ companyId });
        const engCount = await Engineer.countDocuments({ companyId });

        console.log(`\nDB Counts for company (${companyId}):`);
        console.log(`- EmployeeProfile: ${empCount}`);
        console.log(`- Non-superadmin Users: ${userCount}`);
        console.log(`- Department Master: ${deptCount}`);
        console.log(`- Designation Master: ${desigCount}`);
        console.log(`- Branch Master: ${branches.length}`);
        console.log(`- Engineer Master: ${engCount}`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
analyze();
