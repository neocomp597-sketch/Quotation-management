const mongoose = require('mongoose');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const bcrypt = require('bcryptjs');
const { insertRows, writeRows } = require('../utils/importBatch');

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

const idOrNull = (value) => (value ? String(value) : '');
const sameIds = (a = [], b = []) => a.length === b.length && a.every((id, i) => idOrNull(id) === idOrNull(b[i]));

/** The branch fields a user gets from its employee (same rules as syncUserForEmployee). */
const branchFieldsOf = (employee) => {
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
    return { branchId: finalBranchId, assignedBranches: rawAssignedBranches };
};

/**
 * Syncs user accounts for all existing employees.
 * Finds all EmployeeProfiles and ensures a 1-to-1 User account exists for each.
 *
 * Same outcome as calling syncUserForEmployee for every employee in turn, but the users are read
 * once and the changes are written in bulk: per employee that meant two lookups, and per new
 * account a read of every user plus a password hash, which took minutes after a large import.
 * New accounts share one hash of the default password (they must change it at first login).
 */
const syncUsersForExistingEmployees = async (companyId = null) => {
    try {
        const query = {};
        if (companyId) {
            query.companyId = companyId;
        }

        const employees = await EmployeeProfile.find(query).lean();
        const companyIds = [...new Set(employees.map((emp) => idOrNull(emp.companyId)))];
        const [companyUsers, allEmails] = await Promise.all([
            User.find({ companyId: { $in: companyIds.map((id) => id || null) } })
                .select('_id companyId email employeeProfileId branchId assignedBranches')
                .lean(),
            User.find({}).select('email').lean()
        ]);

        // Lookups as syncUserForEmployee makes them: by employee link, else an unlinked user
        // with the same email (ignoring case), first in collection order.
        const linked = new Map();
        const unlinkedByEmail = new Map();
        companyUsers.forEach((user) => {
            const scope = idOrNull(user.companyId);
            if (user.employeeProfileId) {
                const key = `${scope}|${user.employeeProfileId}`;
                if (!linked.has(key)) linked.set(key, user);
            } else if (user.email) {
                const key = `${scope}|${String(user.email).toLowerCase()}`;
                if (!unlinkedByEmail.has(key)) unlinkedByEmail.set(key, []);
                unlinkedByEmail.get(key).push(user);
            }
        });
        const claimedEmails = new Set(allEmails.map((u) => String(u.email || '').toLowerCase()));

        const updates = new Map();
        const newUsers = [];
        let passwordHash = null;
        let existingCount = 0;

        for (const employee of employees) {
            const scope = idOrNull(employee.companyId);
            let existingUser = linked.get(`${scope}|${employee._id}`) || null;
            let emailStr = employee.email ? String(employee.email).trim().toLowerCase() : '';
            if (!existingUser && emailStr) {
                const candidates = unlinkedByEmail.get(`${scope}|${emailStr}`) || [];
                existingUser = candidates.shift() || null;
            }

            const fields = branchFieldsOf(employee);
            if (existingUser) {
                const changed = idOrNull(existingUser.branchId) !== idOrNull(fields.branchId)
                    || !sameIds(existingUser.assignedBranches, fields.assignedBranches)
                    || idOrNull(existingUser.employeeProfileId) !== idOrNull(employee._id);
                Object.assign(existingUser, fields, { employeeProfileId: employee._id });
                linked.set(`${scope}|${employee._id}`, existingUser);
                if (changed) updates.set(String(existingUser._id), existingUser);
                existingCount++;
                continue;
            }

            // Generate fallback email if missing or already taken
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
            claimedEmails.add(emailStr);

            // New User with default password '123456'
            if (!passwordHash) {
                const salt = await bcrypt.genSalt(10);
                passwordHash = await bcrypt.hash('123456', salt);
            }
            const newUser = {
                _id: new mongoose.Types.ObjectId(),
                name: employee.name || 'Employee',
                email: emailStr,
                passwordHash,
                mustChangePassword: true,
                role: 'employee',
                companyId: employee.companyId || null,
                ...fields,
                employeeProfileId: employee._id,
                status: employee.status === 'Active' || employee.status === undefined,
                isActive: employee.status === 'Active' || employee.status === undefined
            };
            newUsers.push(newUser);
            linked.set(`${scope}|${employee._id}`, newUser);
        }

        const changedUsers = [...updates.values()];
        const updateFailures = await writeRows(User, changedUsers.map((user) => ({
            updateOne: {
                filter: { _id: user._id },
                update: { $set: { branchId: user.branchId, assignedBranches: user.assignedBranches, employeeProfileId: user.employeeProfileId } }
            }
        })));
        updateFailures.forEach((error, index) => {
            console.error(`[Auto User Sync Error] Failed to update user ${changedUsers[index].email}:`, error.message || error.errmsg);
        });
        const createFailures = await insertRows(User, newUsers);
        createFailures.forEach((error, index) => {
            console.error(`[Auto User Sync Error] Failed to create user ${newUsers[index].email}:`, error.message || error.errmsg);
        });
        const createdCount = newUsers.length - createFailures.size;

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
