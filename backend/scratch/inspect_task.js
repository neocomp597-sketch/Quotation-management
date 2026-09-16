const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Company = require('../models/Company');
const Branch = require('../models/Branch');
const EmployeeProfile = require('../models/EmployeeProfile');

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const user = await User.findOne({ email: 'super@gmail.com' });
        console.log("User super@gmail.com:", user ? { id: user._id, email: user.email, role: user.role, companyId: user.companyId } : "NOT FOUND");

        let companyId = user?.companyId;
        if (!companyId) {
            const company = await Company.findOne();
            console.log("Fallback Company:", company);
            companyId = company?._id;
        }

        if (companyId) {
            const company = await Company.findById(companyId);
            console.log("Company Details:", company);

            const branches = await Branch.find({ companyId });
            console.log("\nExisting Branches count:", branches.length);
            branches.forEach(b => {
                console.log(`Branch ID: ${b._id}, Name: '${b.name}', Code: '${b.code}', City: '${b.city}', State: '${b.state}', Prefix: '${b.branchPrefix}'`);
            });

            const employees = await EmployeeProfile.find({ companyId });
            console.log("\nExisting Employees count:", employees.length);
            console.log("Sample Employees:", employees.slice(0, 5).map(e => ({ id: e._id, empId: e.employeeId, name: e.name, branchId: e.branchId, dept: e.department, desig: e.designation })));
        }

        // Inspect Excel File
        const excelPath = path.join(__dirname, '../../Employee Report Writer - 1509.xlsx');
        console.log("\nReading Excel file:", excelPath);
        const workbook = XLSX.readFile(excelPath);
        console.log("Sheet names:", workbook.SheetNames);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        console.log("Total rows in Excel:", rows.length);
        if (rows.length > 0) {
            console.log("Excel Headers (Row 0 keys):", Object.keys(rows[0]));
            console.log("Sample Row 0:", JSON.stringify(rows[0], null, 2));
            console.log("Sample Row 1:", JSON.stringify(rows[1], null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error("Error inspecting:", err);
        process.exit(1);
    }
}

inspect();
