const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { ROLE_OPTIONS } = require('../config/authorization');

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('_id name email role status createdAt')
            .sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load users', error: error.message });
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

        if (!ROLE_OPTIONS.includes(role)) {
            return res.status(400).json({ message: 'Invalid role supplied' });
        }

        if (req.user.id === id) {
            return res.status(400).json({ message: 'You cannot change your own role from this screen.' });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (role === 'admin') {
            const existingAdmin = await User.findOne({
                role: 'admin',
                _id: { $ne: id }
            }).select('_id name email');

            if (existingAdmin) {
                return res.status(400).json({
                    message: `Only one admin is allowed for this organization. ${existingAdmin.name} is already assigned as admin.`
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

