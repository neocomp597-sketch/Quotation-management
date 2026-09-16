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
const { runWithTenant } = require('../middlewares/tenantContext');
const { syncUsersForExistingEmployees } = require('../services/employeeUserService');
const { syncAllEngineers } = require('../services/engineerSyncService');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const superUser = await User.findOne({ email: 'super@gmail.com' });
        if (!superUser) {
            throw new Error("User super@gmail.com not found");
        }

        const companyId = superUser.companyId;
        console.log(`Operating on companyId: ${companyId}`);

        await runWithTenant(companyId, async () => {
            // 1. Check existing master data counts BEFORE cleanup
            const deptBefore = await Department.countDocuments({ companyId });
            const desigBefore = await Designation.countDocuments({ companyId });
            const branchBefore = await Branch.countDocuments({ companyId });
            const empBefore = await EmployeeProfile.countDocuments({ companyId });

            console.log("\n=== Pre-cleanup Counts ===");
            console.log(`- EmployeeProfile: ${empBefore}`);
            console.log(`- Department Master: ${deptBefore}`);
            console.log(`- Designation Master: ${desigBefore}`);
            console.log(`- Branch Master: ${branchBefore}`);

            // 2. Remove Existing Employee Data ONLY
            console.log("\n=== Task 1: Removing Existing Employee Data ===");
            const deletedEmp = await EmployeeProfile.deleteMany({ companyId });
            console.log(`Deleted ${deletedEmp.deletedCount} EmployeeProfile records.`);

            // Delete employee users (preserving superadmin user)
            const deletedUsers = await User.deleteMany({
                companyId,
                _id: { $ne: superUser._id },
                role: 'employee'
            });
            console.log(`Deleted ${deletedUsers.deletedCount} employee User records.`);

            // Delete engineers synced from employees
            const deletedEngineers = await Engineer.deleteMany({ companyId });
            console.log(`Deleted ${deletedEngineers.deletedCount} Engineer records.`);

            // Delete payroll summary if present
            const deletedPayrollSum = await PayrollEmployeeSummary.deleteMany({ companyId });
            console.log(`Deleted ${deletedPayrollSum.deletedCount} PayrollEmployeeSummary records.`);

            // Verify Masters are untouched
            const deptAfterCleanup = await Department.countDocuments({ companyId });
            const desigAfterCleanup = await Designation.countDocuments({ companyId });
            const branchAfterCleanup = await Branch.countDocuments({ companyId });

            console.log("\n=== Master Data Integrity Verification ===");
            console.log(`- Department Master: ${deptAfterCleanup} (was ${deptBefore}) -> ${deptAfterCleanup === deptBefore ? 'UNTOUCHED OK' : 'CHANGED ERROR'}`);
            console.log(`- Designation Master: ${desigAfterCleanup} (was ${desigBefore}) -> ${desigAfterCleanup === desigBefore ? 'UNTOUCHED OK' : 'CHANGED ERROR'}`);
            console.log(`- Branch Master: ${branchAfterCleanup} (was ${branchBefore}) -> ${branchAfterCleanup === branchBefore ? 'UNTOUCHED OK' : 'CHANGED ERROR'}`);

            // 3. Load Existing Branches for Location -> Branch matching logic
            const existingBranches = await Branch.find({ companyId }).lean();
            console.log("\nExisting Branches available for matching:");
            existingBranches.forEach(b => console.log(`  - Branch "${b.name}" (Code: ${b.code}, Prefix: ${b.branchPrefix}, ID: ${b._id})`));

            const norm = (s) => s ? String(s).trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';

            const findMatchingBranch = (locationStr) => {
                if (!locationStr) return null;
                const normLoc = norm(locationStr);
                if (!normLoc) return null;

                for (const b of existingBranches) {
                    const normName = norm(b.name);
                    const normCode = norm(b.code);
                    const normPrefix = norm(b.branchPrefix);
                    const normCity = norm(b.city);

                    if (normLoc === normName || normLoc === normCode || normLoc === normPrefix || (normCity && normLoc === normCity)) {
                        return b;
                    }
                    if (
                        (normLoc === 'usgaon' && normName === 'usgoan') ||
                        (normLoc === 'usgoan' && normName === 'usgaon') ||
                        (normLoc === 'ullaria' && normName === 'ularia') ||
                        (normLoc === 'ularia' && normName === 'ullaria')
                    ) {
                        return b;
                    }
                }
                return null;
            };

            // 4. Import New Employee Data from Excel
            const excelPath = path.join(__dirname, '../../Employee Report Writer - 1509.xlsx');
            console.log(`\n=== Task 2 & 3: Importing New Employees from ${excelPath} ===`);

            const workbook = XLSX.readFile(excelPath);
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            console.log(`Total rows to process: ${rows.length}`);

            let matchedBranchCount = 0;
            let blankBranchCount = 0;
            const branchAssignmentSummary = {};
            const blankLocationSummary = {};

            const employeeDocs = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const empCode = row['Employee code'] ? String(row['Employee code']).trim() : `EMP${1000 + i + 1}`;
                const name = row['Employee Name'] ? String(row['Employee Name']).trim() : null;
                if (!name) continue;

                const email = row['Email'] ? String(row['Email']).trim().toLowerCase() : '';
                const mobile = row['Mobile Number'] ? String(row['Mobile Number']).trim() : '';
                const department = row['Department'] ? String(row['Department']).trim() : '';
                const designation = row['Designation'] ? String(row['Designation']).trim() : '';
                const locationRaw = row['Location'] ? String(row['Location']).trim() : '';

                const matchedBranch = findMatchingBranch(locationRaw);

                if (matchedBranch) {
                    matchedBranchCount++;
                    branchAssignmentSummary[matchedBranch.name] = (branchAssignmentSummary[matchedBranch.name] || 0) + 1;
                } else {
                    blankBranchCount++;
                    const locKey = locationRaw || 'NO_LOCATION_MENTIONED';
                    blankLocationSummary[locKey] = (blankLocationSummary[locKey] || 0) + 1;
                }

                employeeDocs.push({
                    employeeId: empCode,
                    externalEmployeeCode: empCode,
                    name,
                    email,
                    mobile,
                    phone: mobile,
                    contactNumber: mobile,
                    location: locationRaw,
                    branchId: matchedBranch ? matchedBranch._id : null,
                    assignedBranches: matchedBranch ? [matchedBranch._id] : [],
                    branchPrefix: matchedBranch ? matchedBranch.branchPrefix : null,
                    department,
                    designation,
                    joiningDate: new Date(),
                    status: 'Active',
                    companyId
                });
            }

            const createdEmps = await EmployeeProfile.insertMany(employeeDocs);
            const importedCount = createdEmps.length;

            console.log(`Successfully created ${importedCount} EmployeeProfile records.`);
            console.log(`- Employees assigned to an existing Branch: ${matchedBranchCount}`);
            console.log(`- Employees with Branch left BLANK: ${blankBranchCount}`);

            console.log("\nBranch Assignment Breakdown:");
            console.table(branchAssignmentSummary);

            console.log("\nBlank Branch Breakdown by Location:");
            console.table(blankLocationSummary);

            // 5. Auto sync User accounts & Engineers
            console.log("\n=== Auto-syncing User Accounts and Service Engineers ===");
            const userSyncResult = await syncUsersForExistingEmployees(companyId);
            console.log(`User Sync Result: Created ${userSyncResult.createdCount} user accounts.`);

            const syncedEngineers = await syncAllEngineers(companyId);
            console.log(`Engineer Sync Result: Synced ${syncedEngineers.length} service engineers.`);

            // Final verification
            const finalEmpCount = await EmployeeProfile.countDocuments({ companyId });
            console.log(`\n=== FINAL VERIFICATION ===`);
            console.log(`Total Employee Profiles in DB: ${finalEmpCount}`);
            console.log(`Total Department Master in DB: ${await Department.countDocuments({ companyId })}`);
            console.log(`Total Designation Master in DB: ${await Designation.countDocuments({ companyId })}`);
            console.log(`Total Branch Master in DB: ${await Branch.countDocuments({ companyId })}`);
        });

        process.exit(0);
    } catch (error) {
        console.error("Error during employee cleanup and import:", error);
        process.exit(1);
    }
}

run();
