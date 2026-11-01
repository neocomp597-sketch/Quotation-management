const mongoose = require('mongoose');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const bcrypt = require('bcryptjs');
const { insertRows, writeRows } = require('../utils/importBatch');
const { isBranchAdminRole } = require('../utils/branchScope');
const { invalidateAuthUserCache } = require('../middlewares/authMiddleware');

const emailOf = (value) => (value ? String(value).trim().toLowerCase() : '');
const exactEmail = (email) => new RegExp(`^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');

/**
 * What an employee's login must change to follow Employee Master: its name, and its login ID (the
 * employee's email) unless another account holds that email (`emailTaken`). Without this an employee
 * renamed or given a new email keeps a login under the old details, which looks like no login at all.
 * Admin accounts keep their own name and login.
 */
const identityChanges = (user, employee, emailTaken) => {
    if (isBranchAdminRole(user.role)) return {};
    const changes = {};
    const name = String(employee.name || '').trim();
    if (name && name !== user.name) changes.name = name;
    const email = emailOf(employee.email);
    if (email && email !== emailOf(user.email) && !emailTaken(email)) changes.email = email;
    return changes;
};

/**
 * Ensures a User account exists for a given employee and follows it.
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

        let emailStr = emailOf(employee.email);
        if (!existingUser && emailStr) {
            // An account with this email that has no employee, or whose employee was since
            // deleted (the employee was added again), is this employee's account.
            const holder = await User.findOne({ companyId, email: exactEmail(emailStr) });
            const holderHasEmployee = holder?.employeeProfileId
                && await EmployeeProfile.exists({ _id: holder.employeeProfileId }).setOptions({ bypassBranch: true });
            if (holder && !holderHasEmployee) existingUser = holder;
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
            const emailHolder = emailStr && emailStr !== emailOf(existingUser.email)
                ? await User.findOne({ _id: { $ne: existingUser._id }, email: exactEmail(emailStr) }).select('_id').lean()
                : null;
            existingUser.set(identityChanges(existingUser, employee, () => Boolean(emailHolder)));
            existingUser.branchId = finalBranchId;
            existingUser.assignedBranches = rawAssignedBranches;
            existingUser.employeeProfileId = employee._id;
            await existingUser.save();
            await invalidateAuthUserCache(existingUser._id.toString());
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
                .select('_id companyId name email role employeeProfileId branchId assignedBranches')
                .lean(),
            User.find({}).select('email').lean()
        ]);

        // Lookups as syncUserForEmployee makes them: by employee link, else a user with the same
        // email (ignoring case) who has no employee or whose employee was since deleted, first
        // in collection order.
        const employeeIds = new Set(employees.map((employee) => String(employee._id)));
        const linked = new Map();
        const unlinkedByEmail = new Map();
        companyUsers.forEach((user) => {
            const scope = idOrNull(user.companyId);
            if (user.employeeProfileId && employeeIds.has(String(user.employeeProfileId))) {
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
                const identity = identityChanges(existingUser, employee, (email) => claimedEmails.has(email));
                if (identity.email) {
                    claimedEmails.delete(emailOf(existingUser.email));
                    claimedEmails.add(identity.email);
                }
                if (Object.keys(identity).length > 0) {
                    console.log(`[Auto User Sync] Login follows Employee Master: "${existingUser.name}" <${existingUser.email}> is now "${identity.name || existingUser.name}" <${identity.email || existingUser.email}>`);
                }
                const changed = Object.keys(identity).length > 0
                    || idOrNull(existingUser.branchId) !== idOrNull(fields.branchId)
                    || !sameIds(existingUser.assignedBranches, fields.assignedBranches)
                    || idOrNull(existingUser.employeeProfileId) !== idOrNull(employee._id);
                Object.assign(existingUser, fields, identity, { employeeProfileId: employee._id });
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
                update: { $set: { name: user.name, email: user.email, branchId: user.branchId, assignedBranches: user.assignedBranches, employeeProfileId: user.employeeProfileId } }
            }
        })));
        updateFailures.forEach((error, index) => {
            console.error(`[Auto User Sync Error] Failed to update user ${changedUsers[index].email}:`, error.message || error.errmsg);
        });
        // protect caches the user between requests
        await Promise.all(changedUsers.map((user) => invalidateAuthUserCache(String(user._id)).catch(() => null)));
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
