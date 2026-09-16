const path = require('path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Engineer = require('../models/Engineer');
const { runWithTenant } = require('../middlewares/tenantContext');

async function purgeNonExcelEmployees() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const user = await User.findOne({ email: 'super@gmail.com' });
        const companyId = user.companyId;

        await runWithTenant(companyId, async () => {
            const excelPath = path.join(__dirname, '../../Employee Report Writer - 1509.xlsx');
            const workbook = XLSX.readFile(excelPath);
            const excelRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            console.log(`Excel file contains ${excelRows.length} employee rows.`);

            const excelCodes = new Set();
            const excelNames = new Set();

            excelRows.forEach(r => {
                if (r['Employee code']) excelCodes.add(String(r['Employee code']).trim());
                if (r['Employee Name']) excelNames.add(String(r['Employee Name']).trim().toLowerCase());
            });

            const dbEmployees = await EmployeeProfile.find({ companyId }).lean();
            console.log(`Total EmployeeProfile records currently in DB: ${dbEmployees.length}`);

            const toDeleteIds = [];
            const toDeleteEmails = [];

            dbEmployees.forEach(e => {
                const codeMatch = e.employeeId && excelCodes.has(String(e.employeeId).trim());
                const nameMatch = e.name && excelNames.has(String(e.name).trim().toLowerCase());

                if (!codeMatch && !nameMatch) {
                    toDeleteIds.push(e._id);
                    if (e.email) toDeleteEmails.push(e.email.trim().toLowerCase());
                }
            });

            console.log(`Found ${toDeleteIds.length} old/test employee profiles to remove.`);

            if (toDeleteIds.length > 0) {
                const delEmps = await EmployeeProfile.deleteMany({ _id: { $in: toDeleteIds } });
                console.log(`Deleted ${delEmps.deletedCount} old EmployeeProfile records.`);

                // Delete associated User accounts for these purged employees
                const delUsers = await User.deleteMany({
                    companyId,
                    email: { $in: toDeleteEmails },
                    role: 'employee'
                });
                console.log(`Deleted ${delUsers.deletedCount} associated User accounts.`);

                // Delete associated Engineer records for these purged employees
                const delEngs = await Engineer.deleteMany({
                    companyId,
                    employeeId: { $in: toDeleteIds }
                });
                console.log(`Deleted ${delEngs.deletedCount} associated Engineer records.`);
            }

            const remainingEmps = await EmployeeProfile.countDocuments({ companyId });
            console.log(`\n=== VERIFICATION ===`);
            console.log(`Remaining EmployeeProfiles in DB: ${remainingEmps} (Expected: ${excelRows.length})`);
            console.log(`Exact Match: ${remainingEmps === excelRows.length ? 'YES - All old data removed successfully!' : 'NO'}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Error purging non-Excel employees:", err);
        process.exit(1);
    }
}

purgeNonExcelEmployees();
