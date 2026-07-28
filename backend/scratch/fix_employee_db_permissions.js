const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const RolePermission = require('../models/RolePermission');
const { DEFAULT_ROLE_PERMISSIONS } = require('../config/authorization');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db';

async function fixPermissions() {
    console.log('--- INSPECTING AND FIXING ROLEPERMISSIONS IN DB ---');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    try {
        const empRoleDoc = await RolePermission.findOne({ role: 'employee' });
        console.log('Current employee RolePermission in DB:', empRoleDoc);

        const defaultEmpPerms = DEFAULT_ROLE_PERMISSIONS.employee;
        console.log('Default Employee Permissions:', defaultEmpPerms);

        if (empRoleDoc) {
            console.log('Updating DB RolePermission for employee role...');
            empRoleDoc.menuVisibility = defaultEmpPerms;
            await empRoleDoc.save();
            console.log('✅ Updated employee RolePermission in DB successfully!');
        } else {
            console.log('Creating DB RolePermission for employee role...');
            await RolePermission.create({
                role: 'employee',
                label: 'Employee',
                description: 'Employee access for payslips and support',
                isCustom: false,
                menuVisibility: defaultEmpPerms
            });
            console.log('✅ Created employee RolePermission in DB successfully!');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

fixPermissions();
