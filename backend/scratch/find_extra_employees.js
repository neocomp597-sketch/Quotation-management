const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');

async function checkDiff() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'super@gmail.com' });
    const companyId = user.companyId;

    const excelPath = path.join(__dirname, '../../Employee Report Writer - 1509.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const excelRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    console.log(`Excel has ${excelRows.length} rows.`);

    const excelEmpCodes = new Set();
    const excelNames = new Set();

    excelRows.forEach(r => {
        if (r['Employee code']) excelEmpCodes.add(String(r['Employee code']).trim());
        if (r['Employee Name']) excelNames.add(String(r['Employee Name']).trim().toLowerCase());
    });

    const dbEmployees = await EmployeeProfile.find({ companyId }).lean();
    console.log(`DB has ${dbEmployees.length} EmployeeProfile records.`);

    const notInExcel = [];
    dbEmployees.forEach(e => {
        const codeMatch = e.employeeId && excelEmpCodes.has(String(e.employeeId).trim());
        const nameMatch = e.name && excelNames.has(String(e.name).trim().toLowerCase());

        if (!codeMatch && !nameMatch) {
            notInExcel.push({
                _id: e._id,
                employeeId: e.employeeId,
                name: e.name,
                email: e.email,
                branchId: e.branchId,
                createdAt: e.createdAt
            });
        }
    });

    console.log(`Found ${notInExcel.length} employees in DB that are NOT in the Excel file:`);
    console.log(JSON.stringify(notInExcel, null, 2));

    process.exit(0);
}

checkDiff();
