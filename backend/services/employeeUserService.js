const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const bcrypt = require('bcryptjs');

/**
 * Ensures a User account exists for a given employee.
 * - Login ID: Employee email address (trimmed, lowercase)
 * - Default Password: 123456
 * - First-login prompt: mustChangePassword = true
 */
const syncUserForEmployee = async (employeeOrId) => {
    try {
        let employee = employeeOrId;
        if (!employee || typeof employee === 'string' || employee instanceof require('mongoose').Types.ObjectId) {
            employee = await EmployeeProfile.findById(employeeOrId).lean();
        }

        if (!employee) {
            return null;
        }

        const mongoose = require('mongoose');
        const companyId = employee.companyId || null;

        // Try to find user account linked by employeeProfileId or email
        let existingUser = await User.findOne({ companyId, employeeProfileId: employee._id });

        let emailStr = employee.email ? String(employee.email).trim().toLowerCase() : '';
        if (!existingUser && emailStr) {
            const escapedEmail = emailStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            existingUser = await User.findOne({
                companyId,
                email: { $regex: new RegExp("^" + escapedEmail + "$", "i") },
                employeeProfileId: null
            });
        }

        // Safely extract ObjectId reference for branchId & assignedBranches
        const rawBranchId = employee.branchId?._id || (typeof employee.branchId === 'string' || employee.branchId instanceof mongoose.Types.ObjectId ? employee.branchId : null);

        let rawAssignedBranches = [];
        if (Array.isArray(employee.assignedBranches) && employee.assignedBranches.length > 0) {
            rawAssignedBranches = employee.assignedBranches
                .map(b => (b && typeof b === 'object' && b._id ? b._id : b))
                .filter(b => b && mongoose.Types.ObjectId.isValid(b));
        }

        const finalBranchId = rawBranchId || (rawAssignedBranches.length > 0 ? rawAssignedBranches[0] : null);
        if (rawAssignedBranches.length === 0 && finalBranchId) {
            rawAssignedBranches = [finalBranchId];
        }

        if (existingUser) {
            existingUser.branchId = finalBranchId;
            existingUser.assignedBranches = rawAssignedBranches;
            existingUser.employeeProfileId = employee._id;
            await existingUser.save();
            return existingUser;
        }

        // Generate fallback email if missing or already taken
        const allUsers = await User.find({}).select('email').lean();
        const claimedEmails = new Set(allUsers.map(u => u.email.toLowerCase()));

        if (!emailStr || claimedEmails.has(emailStr)) {
            const codeClean = (employee.employeeId || employee.externalEmployeeCode || `emp_${employee._id}`).replace(/[^a-z0-9]/gi, '').toLowerCase();
            let fallback = `${codeClean}@stelmec.com`;
            let counter = 1;
            while (claimedEmails.has(fallback)) {
                fallback = `${codeClean}_${counter}@stelmec.com`;
                counter++;
            }
            emailStr = fallback;
        }

        // Create new User with default password '123456'
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('123456', salt);

        const newUser = await User.create({
            name: employee.name || 'Employee',
            email: emailStr,
            passwordHash,
            mustChangePassword: true,
            role: 'employee',
            companyId: companyId,
            branchId: finalBranchId,
            assignedBranches: rawAssignedBranches,
            employeeProfileId: employee._id,
            status: employee.status === 'Active' || employee.status === undefined,
            isActive: employee.status === 'Active' || employee.status === undefined
        });

        console.log(`[Auto User Sync] Created user account for employee: ${employee.name} (${emailStr})`);
        return newUser;
    } catch (error) {
        console.error(`[Auto User Sync Error] Failed to sync user for employee:`, error.message);
        return null;
    }
};

/**
 * Syncs user accounts for all existing employees.
 * Finds all EmployeeProfiles and ensures a 1-to-1 User account exists for each.
 */
const syncUsersForExistingEmployees = async (companyId = null) => {
    try {
        const query = {};
        if (companyId) {
            query.companyId = companyId;
        }

        const employees = await EmployeeProfile.find(query).lean();
        let createdCount = 0;
        let existingCount = 0;

        for (const emp of employees) {
            const user = await syncUserForEmployee(emp);
            if (user) {
                if (user.createdAt && (Date.now() - new Date(user.createdAt).getTime() < 5000)) {
                    createdCount++;
                } else {
                    existingCount++;
                }
            }
        }

        console.log(`[Auto User Sync Batch] Complete. Processed ${employees.length} employees: Created ${createdCount} users, ${existingCount} already existed.`);
        return { total: employees.length, createdCount, existingCount };
    } catch (error) {
        console.error('[Auto User Sync Batch Error]:', error.message);
        return { total: 0, createdCount: 0, existingCount: 0, error: error.message };
    }
};

module.exports = {
    syncUserForEmployee,
    syncUsersForExistingEmployees
};
