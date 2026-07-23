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

        if (!employee || !employee.email) {
            return null;
        }

        const emailStr = String(employee.email).trim().toLowerCase();
        if (!emailStr) {
            return null;
        }

        // Search for existing user with matching email (case insensitive regex)
        const escapedEmail = emailStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const existingUser = await User.findOne({
            email: { $regex: new RegExp("^" + escapedEmail + "$", "i") }
        });

        if (existingUser) {
            return existingUser;
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
            companyId: employee.companyId || null,
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
 * Finds all EmployeeProfiles with an email and creates missing User accounts.
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
            if (!emp.email) continue;
            const emailStr = String(emp.email).trim().toLowerCase();
            if (!emailStr) continue;

            const escapedEmail = emailStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const existingUser = await User.findOne({
                email: { $regex: new RegExp("^" + escapedEmail + "$", "i") }
            }).lean();

            if (!existingUser) {
                const user = await syncUserForEmployee(emp);
                if (user) createdCount++;
            } else {
                existingCount++;
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
