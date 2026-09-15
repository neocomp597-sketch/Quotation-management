const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function analyze() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db');
        console.log('Connected to MongoDB');

        const EmployeeProfile = mongoose.model('EmployeeProfile', new mongoose.Schema({}, { strict: false }));
        const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
        const Branch = mongoose.model('Branch', new mongoose.Schema({}, { strict: false }));

        // Find USGOAN branch
        const usgaonBranch = await Branch.findOne({ 
            $or: [
                { name: { $regex: 'usgoan', $options: 'i' } },
                { name: { $regex: 'usgaon', $options: 'i' } }
            ]
        });

        console.log('Usgaon Branch Found:', usgaonBranch);

        const excelPath = 'D:\\tally\\Quotations\\Employee detail - SBU2.xlsx';
        const wb = xlsx.readFile(excelPath);
        const excelData = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        console.log('Excel Total Rows:', excelData.length);

        const dbEmps = await EmployeeProfile.find({});
        console.log('Total DB Employee Profiles:', dbEmps.length);

        let matchedCount = 0;
        let createdCount = 0;
        let updatedCount = 0;

        for (const row of excelData) {
            const extCode = String(row['EMP Code'] || '').trim();
            const name = String(row['Employee Name'] || '').trim();
            const contact = String(row['Contact'] || '').trim();
            const email = String(row['Official Mail Id'] || '').trim();
            const dept = String(row['Department'] || '').trim();
            const desig = String(row['Designation'] || '').trim();

            let emp = dbEmps.find(e => e.externalEmployeeCode && String(e.externalEmployeeCode).trim().toLowerCase() === extCode.toLowerCase());
            if (!emp) {
                emp = dbEmps.find(e => e.name && e.name.trim().toLowerCase() === name.toLowerCase());
            }

            if (emp) {
                matchedCount++;
                console.log(`Matched DB Emp: "${emp.name}" (ext: ${emp.externalEmployeeCode}) -> Excel Email: "${email}", Phone: "${contact}"`);
            } else {
                console.log(`NEW Emp in Excel not in DB: "${name}" (ext: ${extCode}), Email: "${email}", Phone: "${contact}"`);
            }
        }

        console.log(`Summary: Matched: ${matchedCount} / ${excelData.length}`);

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

analyze();
