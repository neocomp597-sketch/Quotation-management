const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { ROLE_OPTIONS } = require('../config/authorization');
const RolePermission = require('../models/RolePermission');

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ companyId: req.user.companyId })
            .select('_id name email role status companyId createdAt')
            .sort({ createdAt: -1 })
            .lean();

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load users', error: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role = 'sales', status = true } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const isBuiltIn = ROLE_OPTIONS.includes(role);
        const customRole = !isBuiltIn ? await RolePermission.findOne({ role }).select('_id').lean() : null;
        if (!isBuiltIn && !customRole) {
            return res.status(400).json({ message: 'Invalid role supplied' });
        }

        const existingUser = await User.findOne({ email }).select('_id').lean();
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        if (role === 'admin') {
            const adminCount = await User.countDocuments({
                companyId: req.user.companyId,
                role: 'admin',
            });

            if (adminCount >= 3) {
                return res.status(400).json({
                    message: 'A maximum of 3 admins are allowed for this organization.'
                });
            }
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const user = await User.create({
            name,
            email,
            passwordHash,
            role,
            status,
            companyId: req.user.companyId,
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            companyId: user.companyId,
            createdAt: user.createdAt,
        });
    } catch (error) {
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
                token: req.headers.authorization.split(' ')[1] // Return same token
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
            status: updatedUser.status,
            createdAt: updatedUser.createdAt
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user role', error: error.message });
    }
};

