const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { ROLE_OPTIONS } = require('../config/authorization');
const RolePermission = require('../models/RolePermission');
const { getTenantId } = require('../middlewares/tenantContext');

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
    let companyId = req.user?.companyId || getTenantId?.();
    if (!companyId) {
        const firstCompany = await Company.findOne().lean();
        if (firstCompany) {
            companyId = firstCompany._id.toString();
        }
    }
    return companyId;
};

exports.getAllUsers = async (req, res) => {
    try {
        const companyId = await getEffectiveCompanyId(req);
        const query = companyId ? { companyId } : {};

        const users = await User.find(query)
            .select('_id name email role reportsTo branchId assignedBranches status companyId customPermissions vendorId createdAt')
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
        const customRole = !isBuiltIn ? await RolePermission.findOne({ role }).select('_id').lean() : null;
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
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;

            if (req.body.password) {
                const salt = await bcrypt.genSalt(10);
                user.passwordHash = await bcrypt.hash(req.body.password, salt);
            }

            const updatedUser = await user.save();

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

        const isBuiltIn = ROLE_OPTIONS.includes(role);
        const customRole = !isBuiltIn ? await RolePermission.findOne({ role }).select('_id').lean() : null;

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
            const customRole = !isBuiltIn ? await RolePermission.findOne({ role }).select('_id').lean() : null;
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

exports.updateUserPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { customPermissions } = req.body;

        const user = await User.findOne({ _id: id, companyId: req.user.companyId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.customPermissions = customPermissions || {};
        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            customPermissions: user.customPermissions,
            message: 'User permissions updated successfully'
        });
    } catch (error) {
        console.error('[updateUserPermissions] Error:', error.message);
        res.status(500).json({ message: 'Failed to update user permissions', error: error.message });
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

