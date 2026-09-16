const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');

async function syncAll940Users() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const superUser = await User.findOne({ email: 'super@gmail.com' });
        const companyId = superUser.companyId;

        const employees = await EmployeeProfile.find({ companyId }).lean();
        console.log(`Total EmployeeProfiles in DB for company: ${employees.length}`);

        // Fetch ALL existing users across all companies to prevent global email collisions
        const allUsers = await User.find({}).lean();
        const claimedEmails = new Set(allUsers.map(u => u.email.toLowerCase()));
        console.log(`Global User accounts in DB before sync: ${allUsers.length}`);

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('123456', salt);

        let createdCount = 0;
        let updatedCount = 0;

        for (const emp of employees) {
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

            // Check if existing user account is already assigned to this exact employee
            let existingUser = null;
            if (email) {
                existingUser = await User.findOne({ companyId, email });
            }

            if (existingUser) {
                existingUser.branchId = finalBranchId;
                existingUser.assignedBranches = rawAssignedBranches;
                await existingUser.save();
                updatedCount++;
            } else {
                // If email is missing or already claimed globally by another user, generate a unique fallback email
                if (!email || claimedEmails.has(email)) {
                    const codeClean = (emp.employeeId || emp.externalEmployeeCode || `emp_${emp._id}`).replace(/[^a-z0-9]/gi, '').toLowerCase();
                    let fallbackEmail = `${codeClean}@stelmec.com`;
                    let counter = 1;
                    while (claimedEmails.has(fallbackEmail)) {
                        fallbackEmail = `${codeClean}_${counter}@stelmec.com`;
                        counter++;
                    }
                    email = fallbackEmail;
                }

                claimedEmails.add(email);

                await User.create({
                    name: emp.name || 'Employee',
                    email: email,
                    passwordHash,
                    mustChangePassword: true,
                    role: 'employee',
                    companyId: companyId,
                    branchId: finalBranchId,
                    assignedBranches: rawAssignedBranches,
                    status: emp.status === 'Active' || emp.status === undefined,
                    isActive: emp.status === 'Active' || emp.status === undefined
                });
                createdCount++;
            }
        }

        console.log(`\n=== USER SYNC COMPLETE ===`);
        console.log(`- Created ${createdCount} new user accounts.`);
        console.log(`- Updated ${updatedCount} existing user accounts.`);

        const totalUsersAfter = await User.countDocuments({ companyId, role: 'employee' });
        const totalAdminsAfter = await User.countDocuments({ companyId, role: 'admin' });
        console.log(`Total Employee User Accounts for Company: ${totalUsersAfter}`);
        console.log(`Total Admin User Accounts for Company: ${totalAdminsAfter}`);
        console.log(`Total Team Users for Company: ${totalUsersAfter + totalAdminsAfter}`);

        process.exit(0);
    } catch (err) {
        console.error("Error syncing 940 users:", err);
        process.exit(1);
    }
}

syncAll940Users();
