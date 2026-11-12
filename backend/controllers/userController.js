const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const User = require('../models/User');
const MGR = require('../models/MGR');
const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const { ROLE_OPTIONS, mergeUserPermissions, diffUserPermissions } = require('../config/authorization');
const RolePermission = require('../models/RolePermission');
const { getTenantId, getScopedBranches } = require('../middlewares/tenantContext');
const { getRolePermissions, toPlainObject } = require('../middlewares/permissionMiddleware');
const { invalidateAuthUserCache, isSuperAdminRole } = require('../middlewares/authMiddleware');
const { broadcastCrmUpdate } = require('../config/socket');
const EmployeeProfile = require('../models/EmployeeProfile');
const { isBranchAdminRole } = require('../utils/branchScope');
const { formatDateTime } = require('../utils/dateFormat');

/**
 * An employee's login follows Employee Master (services/employeeUserService.js), so a name or email
 * changed on the login itself is saved on the employee too; the next sync would undo it otherwise.
 * Admin accounts keep their own name and login, so their employee is left as it is.
 */
const saveIdentityToEmployee = async (user) => {
    if (!user.employeeProfileId || isBranchAdminRole(user.role)) return;
    try {
        await EmployeeProfile.updateOne(
            { _id: user.employeeProfileId },
            { $set: { name: user.name, email: String(user.email || '').trim().toLowerCase() } }
        ).setOptions({ bypassBranch: true });
    } catch (error) {
        console.warn('[saveIdentityToEmployee] Failed:', error.message);
    }
};

const normalizeReportsTo = (reportsTo) => (reportsTo ? reportsTo : null);

const validateReportsTo = async ({ reportsTo, userId, companyId }) => {
    const normalized = normalizeReportsTo(reportsTo);
    if (!normalized) return null;

    if (userId && normalized.toString() === userId.toString()) {
        throw new Error('A user cannot report to themselves');
    }

    const senior = await User.findOne({ _id: normalized, companyId }).select('_id').lean();
    if (!senior) {
        throw new Error('Selected senior was not found in this company');
    }

    return normalized;
};

const Company = require('../models/Company');

const getEffectiveCompanyId = async (req) => {
    let companyId = req.query?.companyId || req.headers?.['x-company-id'] || req.body?.companyId || req.user?.companyId || getTenantId?.();
    if (!companyId) {
        const firstCompany = await Company.findOne().lean();
        if (firstCompany) {
            companyId = firstCompany._id.toString();
        }
    }
    return companyId?.toString ? companyId.toString() : companyId;
};

// The User model is not branch-scoped by tenantPlugin, so the active branch
// is applied here: users of the scoped branches plus users without a branch.
const withActiveBranchScope = (query) => {
    const scopedBranchIds = getScopedBranches();
    if (scopedBranchIds) {
        query.$or = [
            { branchId: { $in: scopedBranchIds } },
            { assignedBranches: { $in: scopedBranchIds } },
            { branchId: null, assignedBranches: { $size: 0 } },
            { branchId: null, assignedBranches: { $exists: false } },
            { branchId: { $exists: false }, assignedBranches: { $size: 0 } },
            { branchId: { $exists: false }, assignedBranches: { $exists: false } },
        ];
    }
    return query;
};

exports.getAllUsers = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const query = withActiveBranchScope(companyId ? { companyId } : {});

        const users = await User.find(query)
            .select('_id name email role reportsTo branchId assignedBranches status companyId customPermissions mgrAccess vendorId createdAt')
            .populate('reportsTo', 'name email')
            .populate('branchId', 'name code branchPrefix')
            .populate('assignedBranches', 'name code branchPrefix')
            .populate('vendorId', 'name code companyName')
            .sort({ createdAt: -1 })
            .lean();

        res.json(users);
    } catch (error) {
        console.error('[getAllUsers] Error:', error.message, error.stack);
        res.status(500).json({ message: 'Failed to load users', error: error.message });
    }
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const USER_ACTIVITY_SORTS = {
    name: (a, b) => a.name.localeCompare(b.name),
    createdAt: (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
    modifiedAt: (a, b) => (a.modifiedAt || 0) - (b.modifiedAt || 0),
};

/**
 * Created and last modified dates of the users matching `query`. updatedAt holds every change since
 * it was added; a user last changed before that shows the latest change recorded elsewhere on the
 * record or in the audit log, and no date at all when nothing was recorded.
 */
const loadUserActivity = async (query) => {
    const users = await User.find(query)
        .select('name email role status isActive branchId createdAt updatedAt customPermissionsUpdatedAt passwordChangedAt')
        .populate('branchId', 'name')
        .sort({ createdAt: -1 })
        .lean();

    const auditDates = await AuditLog.aggregate([
        { $match: { entityType: 'User', entityId: { $in: users.map((user) => user._id) } } },
        { $group: { _id: '$entityId', timestamp: { $max: '$timestamp' } } },
    ]);
    const lastAudit = new Map(auditDates.map((row) => [row._id.toString(), row.timestamp]));

    return users.map((user) => {
        const changes = [user.updatedAt, user.customPermissionsUpdatedAt, user.passwordChangedAt, lastAudit.get(user._id.toString())].filter(Boolean);
        return {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            branch: user.branchId?.name || '',
            isActive: user.status !== false && user.isActive !== false,
            createdAt: user.createdAt,
            modifiedAt: changes.length ? new Date(Math.max(...changes.map((date) => new Date(date).getTime()))) : null,
        };
    });
};

// The users matching the request's search, in the order it asks for. The list and the Excel share it.
const listUserActivity = async (req) => {
    const query = withActiveBranchScope({ companyId: req.user?.companyId });
    const search = String(req.query.search || '').trim();
    if (search) {
        const regex = new RegExp(escapeRegex(search), 'i');
        query.$and = [{ $or: [{ name: regex }, { email: regex }] }];
    }

    const rows = await loadUserActivity(query);
    const compare = Object.hasOwn(USER_ACTIVITY_SORTS, req.query.sortBy)
        ? USER_ACTIVITY_SORTS[req.query.sortBy]
        : USER_ACTIVITY_SORTS.modifiedAt;
    rows.sort(req.query.order === 'asc' ? compare : (a, b) => compare(b, a));
    return rows;
};

// GET /api/users/activity?search=&sortBy=name|createdAt|modifiedAt&order=asc|desc&page=&limit=
exports.getUserActivity = async (req, res) => {
    try {
        const rows = await listUserActivity(req);

        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
        const pages = Math.max(Math.ceil(rows.length / limit), 1);
        const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), pages);

        res.json({
            data: rows.slice((page - 1) * limit, page * limit),
            pagination: { page, limit, total: rows.length, pages },
        });
    } catch (error) {
        console.error('[getUserActivity] Error:', error.message);
        res.status(500).json({ message: 'Failed to load user activity', error: error.message });
    }
};

const USER_ACTIVITY_COLUMNS = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Email', key: 'email', width: 36 },
    { header: 'Role', key: 'role', width: 14 },
    { header: 'Branch', key: 'branch', width: 24 },
    { header: 'Status', key: 'status', width: 10 },
    // Dates are text in the ARCRM format, as in the other exports; Excel date formats cannot upper-case the month.
    { header: 'Created On', key: 'createdOn', width: 22, style: { numFmt: '@' } },
    { header: 'Last Modified', key: 'lastModified', width: 22, style: { numFmt: '@' } },
];

// GET /api/users/activity/export?search=&sortBy=name|createdAt|modifiedAt&order=asc|desc
// .xlsx of every user matching the search, not just one page.
exports.exportUserActivity = async (req, res) => {
    try {
        const rows = await listUserActivity(req);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('User Activity');
        sheet.columns = USER_ACTIVITY_COLUMNS;
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: USER_ACTIVITY_COLUMNS.length } };
        for (const row of rows) {
            sheet.addRow({
                name: row.name,
                email: row.email,
                role: row.role ? row.role.charAt(0).toUpperCase() + row.role.slice(1) : '',
                branch: row.branch || '-',
                status: row.isActive ? 'Active' : 'Inactive',
                createdOn: formatDateTime(row.createdAt),
                lastModified: formatDateTime(row.modifiedAt, 'No change recorded'),
            });
        }

        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).replace(/-/g, '');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="User_Activity_${today}.xlsx"`);
        res.setHeader('X-Total-Count', String(rows.length));
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Total-Count');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('[exportUserActivity] Error:', error.message);
        res.status(500).json({ message: 'Failed to export user activity', error: error.message });
    }
};

// GET /api/users/activity/:id
exports.getUserActivityById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid user id' });
        }
        const [row] = await loadUserActivity(withActiveBranchScope({ _id: req.params.id, companyId: req.user?.companyId }));
        if (!row) return res.status(404).json({ message: 'User not found' });
        res.json(row);
    } catch (error) {
        console.error('[getUserActivityById] Error:', error.message);
        res.status(500).json({ message: 'Failed to load user activity', error: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role = 'sales', status = true, reportsTo, branchId, assignedBranches, vendorId } = req.body;

        const companyId = await getEffectiveCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing' });
        }

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const isBuiltIn = ROLE_OPTIONS.includes(role);
        const customRole = !isBuiltIn ? await RolePermission.findOne({ role, companyId }).select('_id').lean() : null;
        if (!isBuiltIn && !customRole) {
            return res.status(400).json({ message: 'Invalid role supplied' });
        }

        const normalizedEmail = email ? String(email).trim().toLowerCase() : '';
        const existingUser = await User.findOne({ email: { $regex: new RegExp("^" + normalizedEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } }).select('_id').lean();
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        if (role === 'admin') {
            const adminCount = await User.countDocuments({
                companyId,
                role: 'admin',
            });

            if (adminCount >= 3) {
                return res.status(400).json({
                    message: 'A maximum of 3 admins are allowed for this organization.'
                });
            }
        }

        const validatedReportsTo = await validateReportsTo({ reportsTo, companyId });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        const branchesList = Array.isArray(assignedBranches) ? assignedBranches : (branchId ? [branchId] : []);
        const primaryBranch = branchId || (branchesList.length > 0 ? branchesList[0] : null);

        const user = await User.create({
            name,
            email: normalizedEmail,
            passwordHash,
            role,
            reportsTo: validatedReportsTo,
            branchId: primaryBranch,
            assignedBranches: branchesList,
            vendorId: vendorId || null,
            status,
            companyId,
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            reportsTo: user.reportsTo,
            branchId: user.branchId,
            assignedBranches: user.assignedBranches,
            vendorId: user.vendorId,
            customPermissions: user.customPermissions || {},
            status: user.status,
            companyId: user.companyId,
            createdAt: user.createdAt,
        });
    } catch (error) {
        if (/report to|senior|themselves/i.test(error.message)) {
            return res.status(400).json({ message: error.message });
        }
        console.error('[createUser] Error:', error.message, error.stack);
        res.status(500).json({ message: 'Failed to create user', error: error.message });
    }
};

// Update User Profile
exports.updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (user) {
            const previousIdentity = `${user.name}|${user.email}`;
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;

            if (req.body.password) {
                const salt = await bcrypt.genSalt(10);
                user.passwordHash = await bcrypt.hash(req.body.password, salt);
            }

            const updatedUser = await user.save();
            if (`${updatedUser.name}|${updatedUser.email}` !== previousIdentity) await saveIdentityToEmployee(updatedUser);

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                token: req.headers.authorization.split(' ')[1]
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const companyId = await getEffectiveCompanyId(req);
        const isBuiltIn = ROLE_OPTIONS.includes(role);
        const customRole = !isBuiltIn ? await RolePermission.findOne({ role, companyId }).select('_id').lean() : null;

        if (!isBuiltIn && !customRole) {
            return res.status(400).json({ message: 'Invalid role supplied' });
        }

        if (req.user.id === id) {
            return res.status(400).json({ message: 'You cannot change your own role from this screen.' });
        }

        const user = await User.findOne({ _id: id, companyId: req.user.companyId });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (role === 'admin') {
            const adminCount = await User.countDocuments({
                companyId: req.user.companyId,
                role: 'admin',
                _id: { $ne: id }
            });

            if (adminCount >= 3) {
                return res.status(400).json({
                    message: `A maximum of 3 admins are allowed for this organization.`
                });
            }
        }

        user.role = role;
        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            reportsTo: updatedUser.reportsTo,
            status: updatedUser.status,
            createdAt: updatedUser.createdAt
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user role', error: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, role, reportsTo, branchId, assignedBranches, vendorId } = req.body;

        const user = await User.findOne({ _id: id, companyId: req.user.companyId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const previousIdentity = `${user.name}|${user.email}`;

        if (email && email !== user.email) {
            const normalizedEmail = String(email).trim().toLowerCase();
            const existing = await User.findOne({
                _id: { $ne: user._id },
                email: { $regex: new RegExp("^" + normalizedEmail.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") }
            }).select('_id').lean();
            if (existing) {
                return res.status(400).json({ message: 'Email already exists' });
            }
            user.email = normalizedEmail;
        }

        if (name) user.name = name;
        if (branchId !== undefined) user.branchId = branchId || null;
        if (assignedBranches !== undefined) {
            user.assignedBranches = Array.isArray(assignedBranches) ? assignedBranches : (branchId ? [branchId] : []);
            if (!user.branchId && user.assignedBranches.length > 0) {
                user.branchId = user.assignedBranches[0];
            }
        }
        if (vendorId !== undefined) user.vendorId = vendorId || null;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.passwordHash = await bcrypt.hash(password, salt);
        }

        if (reportsTo !== undefined) {
            user.reportsTo = await validateReportsTo({
                reportsTo,
                userId: id,
                companyId: req.user.companyId,
            });
        }

        // Handle role change if provided and different
        if (role && role !== user.role) {
            if (req.user.id === id) {
                return res.status(400).json({ message: 'You cannot change your own role.' });
            }

            const isBuiltIn = ROLE_OPTIONS.includes(role);
            const customRole = !isBuiltIn ? await RolePermission.findOne({ role, companyId: user.companyId }).select('_id').lean() : null;
            if (!isBuiltIn && !customRole) {
                return res.status(400).json({ message: 'Invalid role supplied' });
            }

            if (role === 'admin') {
                const adminCount = await User.countDocuments({
                    companyId: req.user.companyId,
                    role: 'admin',
                    _id: { $ne: id }
                });
                if (adminCount >= 3) {
                    return res.status(400).json({
                        message: 'A maximum of 3 admins are allowed for this organization.'
                    });
                }
            }

            user.role = role;
        }

        const updatedUser = await user.save();
        if (`${updatedUser.name}|${updatedUser.email}` !== previousIdentity) await saveIdentityToEmployee(updatedUser);
        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            reportsTo: updatedUser.reportsTo,
            branchId: updatedUser.branchId,
            assignedBranches: updatedUser.assignedBranches,
            vendorId: updatedUser.vendorId,
            customPermissions: updatedUser.customPermissions || {},
            status: updatedUser.status,
            createdAt: updatedUser.createdAt
        });
    } catch (error) {
        if (/report to|senior|themselves/i.test(error.message)) {
            return res.status(400).json({ message: error.message });
        }
        console.error('[updateUser] Error:', error.message);
        res.status(500).json({ message: 'Failed to update user', error: error.message });
    }
};

/**
 * Saves one user's individual permissions. The client sends the full set the user
 * should end up with (`permissions`); only what differs from the role is stored,
 * so later role changes still reach this user. `customPermissions` (the overrides
 * themselves, `{}` = back to role defaults) is accepted from older clients.
 */
exports.updateUserPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions, customPermissions } = req.body || {};
        const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

        if (!isPlainObject(permissions) && !isPlainObject(customPermissions)) {
            return res.status(400).json({ message: 'Permissions are required' });
        }

        if (id === req.user.id && !isSuperAdminRole(req.user.role)) {
            return res.status(403).json({ message: 'You cannot change your own permissions. Ask another administrator.' });
        }

        const user = await User.findOne({ _id: id, companyId: req.user.companyId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const rolePermissions = await getRolePermissions(String(user.companyId), user.role);
        const previousCustom = toPlainObject(user.customPermissions);
        const previousEffective = mergeUserPermissions(user.role, rolePermissions, previousCustom);
        const desired = isPlainObject(permissions)
            ? permissions
            : mergeUserPermissions(user.role, rolePermissions, customPermissions);
        const nextCustom = diffUserPermissions(user.role, rolePermissions, desired);
        const nextEffective = mergeUserPermissions(user.role, rolePermissions, nextCustom);

        // One document holds all of the user's overrides, so they are saved all at once or not at all.
        user.customPermissions = nextCustom;
        user.customPermissionsUpdatedBy = req.user.id;
        user.customPermissionsUpdatedAt = new Date();
        await user.save();

        // protect caches the user (with these overrides) between requests
        await invalidateAuthUserCache(user._id.toString());

        const changes = Object.keys({ ...previousEffective, ...nextEffective })
            .filter((key) => Boolean(previousEffective[key]) !== Boolean(nextEffective[key]));
        if (changes.length) {
            try {
                await AuditLog.create({
                    action: Object.keys(nextCustom).length ? 'USER_PERMISSIONS_UPDATED' : 'USER_PERMISSIONS_RESET',
                    entityType: 'User',
                    entityId: user._id,
                    userId: req.user.id,
                    userName: req.user.name,
                    oldValue: Object.fromEntries(changes.map((key) => [key, Boolean(previousEffective[key])])),
                    newValue: Object.fromEntries(changes.map((key) => [key, Boolean(nextEffective[key])])),
                    reason: `Permissions of ${user.name}`,
                    companyId: user.companyId
                });
            } catch (auditError) {
                console.warn('[updateUserPermissions] Audit log failed:', auditError.message);
            }
        }

        try {
            broadcastCrmUpdate('PERMISSIONS', 'UPDATE', { companyId: String(user.companyId), userId: user._id.toString() });
        } catch (broadcastError) {
            console.warn('[updateUserPermissions] Broadcast failed:', broadcastError.message);
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            customPermissions: nextCustom,
            effectivePermissions: nextEffective,
            customPermissionsUpdatedAt: user.customPermissionsUpdatedAt,
            message: 'User permissions updated successfully'
        });
    } catch (error) {
        console.error('[updateUserPermissions] Error:', error.message);
        res.status(500).json({ message: 'Failed to update user permissions', error: error.message });
    }
};

/**
 * Saves the MGR values one user's Invoice Bulk Upload data is limited to (`mgrAccess`: MGR ids,
 * [] = no limit). Admins are never limited, whatever is saved (utils/mgrAccess.js).
 */
exports.updateUserMgrAccess = async (req, res) => {
    try {
        const { id } = req.params;
        const { mgrAccess } = req.body || {};
        if (!Array.isArray(mgrAccess) || mgrAccess.some((value) => !mongoose.Types.ObjectId.isValid(value))) {
            return res.status(400).json({ message: 'MGR access must be a list of MGR values' });
        }

        const user = await User.findOne({ _id: id, companyId: req.user.companyId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const ids = [...new Set(mgrAccess.map(String))];
        const mgrs = await MGR.find({ _id: { $in: ids }, companyId: req.user.companyId }).select('mgrType code').lean();
        if (mgrs.length !== ids.length) {
            return res.status(400).json({ message: 'Some of the MGR values no longer exist. Reload the page and try again.' });
        }

        const previous = (user.mgrAccess || []).map(String);
        await User.updateOne({ _id: user._id }, { $set: { mgrAccess: ids } });

        try {
            await AuditLog.create({
                action: 'USER_MGR_ACCESS_UPDATED',
                entityType: 'User',
                entityId: user._id,
                userId: req.user.id,
                userName: req.user.name,
                oldValue: { mgrAccess: previous },
                newValue: { mgrAccess: mgrs.map((mgr) => `${mgr.mgrType} ${mgr.code}`) },
                reason: `MGR access of ${user.name}`,
                companyId: user.companyId
            });
        } catch (auditError) {
            console.warn('[updateUserMgrAccess] Audit log failed:', auditError.message);
        }

        res.json({ _id: user._id, mgrAccess: ids, message: 'MGR access updated successfully' });
    } catch (error) {
        console.error('[updateUserMgrAccess] Error:', error.message);
        res.status(500).json({ message: 'Failed to update MGR access', error: error.message });
    }
};

/**
 * The branches one user may switch between (Authorization > Team Users). Staff without a branch
 * cannot log in, so this is also how an admin lets them back in. A login that follows an employee
 * is saved on Employee Master too; the next sync would undo it otherwise.
 */
exports.updateUserBranches = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedBranches } = req.body || {};
        if (!Array.isArray(assignedBranches) || assignedBranches.length === 0
            || assignedBranches.some((value) => !mongoose.Types.ObjectId.isValid(value))) {
            return res.status(400).json({ message: 'Select at least one branch' });
        }

        const user = await User.findOne({ _id: id, companyId: req.user.companyId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (isBranchAdminRole(user.role)) {
            return res.status(400).json({ message: 'Admins can work in every branch; no branch needs to be assigned.' });
        }

        const ids = [...new Set(assignedBranches.map(String))];
        const branches = await Branch.find({ _id: { $in: ids }, companyId: req.user.companyId })
            .select('name code branchPrefix')
            .sort({ name: 1 })
            .setOptions({ bypassTenant: true })
            .lean();
        if (branches.length !== ids.length) {
            return res.status(400).json({ message: 'Some of these branches no longer exist. Reload the page and try again.' });
        }

        const previous = (user.assignedBranches || []).map(String);
        const branchId = ids.includes(String(user.branchId)) ? String(user.branchId) : ids[0];
        await User.updateOne({ _id: user._id }, { $set: { assignedBranches: ids, branchId } });
        await invalidateAuthUserCache(user._id.toString());

        if (user.employeeProfileId) {
            await EmployeeProfile.updateOne(
                { _id: user.employeeProfileId },
                { $set: { assignedBranches: ids, branchId } }
            ).setOptions({ bypassBranch: true });
        }

        try {
            await AuditLog.create({
                action: 'USER_BRANCHES_UPDATED',
                entityType: 'User',
                entityId: user._id,
                userId: req.user.id,
                userName: req.user.name,
                oldValue: { assignedBranches: previous },
                newValue: { assignedBranches: branches.map((branch) => branch.name) },
                reason: `Branch access of ${user.name}`,
                companyId: user.companyId
            });
        } catch (auditError) {
            console.warn('[updateUserBranches] Audit log failed:', auditError.message);
        }

        res.json({ _id: user._id, branchId, assignedBranches: branches, message: 'Branch access updated successfully' });
    } catch (error) {
        console.error('[updateUserBranches] Error:', error.message);
        res.status(500).json({ message: 'Failed to update branch access', error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.id === id) {
            return res.status(400).json({ message: 'You cannot delete your own account.' });
        }

        const user = await User.findOne({ _id: id, companyId: req.user.companyId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({
                companyId: req.user.companyId,
                role: 'admin'
            });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last admin of the organization.' });
            }
        }

        await User.deleteOne({ _id: id });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('[deleteUser] Error:', error.message);
        res.status(500).json({ message: 'Failed to delete user', error: error.message });
    }
};

exports.getUserNote = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('personalNote').lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ note: user.personalNote || '' });
    } catch (error) {
        console.error('[getUserNote] Error:', error.message);
        res.status(500).json({ message: 'Failed to fetch personal note', error: error.message });
    }
};

exports.updateUserNote = async (req, res) => {
    try {
        const { note } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.personalNote = typeof note === 'string' ? note : '';
        await user.save();
        res.json({ note: user.personalNote });
    } catch (error) {
        console.error('[updateUserNote] Error:', error.message);
        res.status(500).json({ message: 'Failed to update personal note', error: error.message });
    }
};

