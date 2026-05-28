const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

async function inspect() {
    try {
        console.log('Connecting to MONGO_URI:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const superAdmins = await User.find({ role: { $in: ['SUPER_ADMIN', 'super_admin'] } }).lean();
        console.log('Super Admins found in DB:', superAdmins.length);
        superAdmins.forEach(u => {
            console.log('Super Admin Details:', {
                id: u._id,
                name: u.name,
                email: u.email,
                role: u.role,
                status: u.status,
                isActive: u.isActive,
                companyId: u.companyId
            });
        });
    } catch (err) {
        console.error('Error during inspection:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

inspect();
