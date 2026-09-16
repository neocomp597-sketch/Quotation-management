const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const { runWithTenant } = require('../middlewares/tenantContext');

async function clean1To1Users() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const superUser = await User.findOne({ email: 'super@gmail.com' });
        const companyId = superUser.companyId;

        await runWithTenant(companyId, async () => {
            const employees = await EmployeeProfile.find({ companyId }).lean();
            console.log(`Total EmployeeProfiles in DB: ${employees.length}`);

            // Remove all existing employee user accounts for this company to make it exact 1-to-1 (940)
            const delRes = await User.deleteMany({ companyId, role: 'employee' });
            console.log(`Cleared ${delRes.deletedCount} previous employee user accounts.`);

            // Fetch remaining non-employee users globally to avoid email collision
            const allUsers = await User.find({}).lean();
            const claimedEmails = new Set(allUsers.map(u => u.email.toLowerCase()));

            const salt = await bcrypt.genSalt(10);
            const defaultPasswordHash = await bcrypt.hash('123456', salt);

            const userDocs = [];

            for (let i = 0; i < employees.length; i++) {
                const emp = employees[i];

                const rawBranchId = emp.branchId?._id || (typeof emp.branchId === 'string' || emp.branchId instanceof mongoose.Types.ObjectId ? emp.branchId : null);
                let rawAssignedBranches = [];
                if (Array.isArray(emp.assignedBranches) && emp.assignedBranches.length > 0) {
                    rawAssignedBranches = emp.assignedBranches
                        .map(b => (b && typeof b === 'object' && b._id ? b._id : b))
                        .filter(b => b && mongoose.Types.ObjectId.isValid(b));
                }
                const finalBranchId = rawBranchId || (rawAssignedBranches.length > 0 ? rawAssignedBranches[0] : null);
                if (rawAssignedBranches.length === 0 && finalBranchId) {
                    rawAssignedBranches = [finalBranchId];
                }

                let email = emp.email ? String(emp.email).trim().toLowerCase() : '';
                if (!email || claimedEmails.has(email)) {
                    const codeClean = (emp.employeeId || emp.externalEmployeeCode || `emp_${emp._id}`).replace(/[^a-z0-9]/gi, '').toLowerCase();
                    let fallback = `${codeClean}@stelmec.com`;
                    let counter = 1;
                    while (claimedEmails.has(fallback)) {
                        fallback = `${codeClean}_${counter}@stelmec.com`;
                        counter++;
                    }
                    email = fallback;
                }

                claimedEmails.add(email);

                userDocs.push({
                    name: emp.name || 'Employee',
                    email: email,
                    passwordHash: defaultPasswordHash,
                    mustChangePassword: true,
                    role: 'employee',
                    companyId: companyId,
                    branchId: finalBranchId,
                    assignedBranches: rawAssignedBranches,
                    employeeProfileId: emp._id,
                    status: emp.status === 'Active' || emp.status === undefined,
                    isActive: emp.status === 'Active' || emp.status === undefined
                });
            }

            const createdUsers = await User.insertMany(userDocs);
            console.log(`Created ${createdUsers.length} exact 1-to-1 User accounts.`);

            const totalEmpUsers = await User.countDocuments({ companyId, role: 'employee' });
            const totalAdminUsers = await User.countDocuments({ companyId, role: 'admin' });
            console.log(`\n=== FINAL EXACT 1-TO-1 SUMMARY ===`);
            console.log(`- Total Employee Profiles: ${employees.length}`);
            console.log(`- Total Employee User Accounts: ${totalEmpUsers}`);
            console.log(`- Total Admin User Accounts: ${totalAdminUsers}`);
            console.log(`- Total Team Users on Authorization Page: ${totalEmpUsers + totalAdminUsers}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Error cleaning 1-to-1 users:", err);
        process.exit(1);
    }
}

clean1To1Users();
