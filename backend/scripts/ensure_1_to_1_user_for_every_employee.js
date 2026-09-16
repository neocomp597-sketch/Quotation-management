const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const { runWithTenant } = require('../middlewares/tenantContext');

async function ensure1To1Users() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const superUser = await User.findOne({ email: 'super@gmail.com' });
        const companyId = superUser.companyId;

        await runWithTenant(companyId, async () => {
            const employees = await EmployeeProfile.find({ companyId });
            console.log(`Total EmployeeProfiles in DB: ${employees.length}`);

            // Get all existing users globally
            const allUsers = await User.find({});
            const claimedEmails = new Set(allUsers.map(u => u.email.toLowerCase()));

            const salt = await bcrypt.genSalt(10);
            const defaultPasswordHash = await bcrypt.hash('123456', salt);

            let createdCount = 0;
            let updatedCount = 0;

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

                // Try to find existing User account for this specific employee profile
                let user = await User.findOne({ companyId, employeeProfileId: emp._id });

                // Fallback search by email if not linked by employeeProfileId
                if (!user && emp.email) {
                    const matchByEmail = await User.findOne({ companyId, email: String(emp.email).trim().toLowerCase(), employeeProfileId: null });
                    if (matchByEmail) {
                        user = matchByEmail;
                        user.employeeProfileId = emp._id;
                    }
                }

                if (user) {
                    user.branchId = finalBranchId;
                    user.assignedBranches = rawAssignedBranches;
                    user.employeeProfileId = emp._id;
                    await user.save();
                    updatedCount++;
                } else {
                    // Generate unique login email if emp.email is missing or already taken by another User
                    let targetEmail = emp.email ? String(emp.email).trim().toLowerCase() : '';
                    if (!targetEmail || claimedEmails.has(targetEmail)) {
                        const codeClean = (emp.employeeId || emp.externalEmployeeCode || `emp_${emp._id}`).replace(/[^a-z0-9]/gi, '').toLowerCase();
                        let fallback = `${codeClean}@stelmec.com`;
                        let counter = 1;
                        while (claimedEmails.has(fallback)) {
                            fallback = `${codeClean}_${counter}@stelmec.com`;
                            counter++;
                        }
                        targetEmail = fallback;
                    }

                    claimedEmails.add(targetEmail);

                    await User.create({
                        name: emp.name || 'Employee',
                        email: targetEmail,
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
                    createdCount++;
                }
            }

            console.log(`\n=== 1-TO-1 USER SYNC COMPLETE ===`);
            console.log(`- Created ${createdCount} new user accounts.`);
            console.log(`- Updated ${updatedCount} existing user accounts.`);

            const totalEmployeeUsers = await User.countDocuments({ companyId, role: 'employee' });
            const totalAdminUsers = await User.countDocuments({ companyId, role: 'admin' });
            console.log(`Total Employee Profiles in DB: ${employees.length}`);
            console.log(`Total Employee User Accounts in DB: ${totalEmployeeUsers}`);
            console.log(`Total Admin User Accounts in DB: ${totalAdminUsers}`);
            console.log(`Total Team Users displayed on Authorization page: ${totalEmployeeUsers + totalAdminUsers}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Error during 1-to-1 user sync:", err);
        process.exit(1);
    }
}

ensure1To1Users();
