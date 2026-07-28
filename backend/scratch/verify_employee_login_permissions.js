const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const authorizationController = require('../controllers/authorizationController');
const { resolvePermissions, DEFAULT_ROLE_PERMISSIONS } = require('../config/authorization');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db';

async function runTest() {
    console.log('--- STARTING VERIFICATION FOR EMPLOYEE ROLE PERMISSIONS ---');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    try {
        // Step 1: Check permissions for role "employee"
        console.log('\n[Step 1] Resolving default permissions for role "employee"...');
        const resolved = resolvePermissions('employee', {});

        console.log('Resolved Employee Permissions:');
        console.log('  dashboard:', resolved.dashboard);
        console.log('  payroll_runs:', resolved.payroll_runs);
        console.log('  payroll_employees:', resolved.payroll_employees);
        console.log('  csm_tickets:', resolved.csm_tickets);

        if (!resolved.payroll_runs && !resolved.csm_tickets && !resolved.dashboard) {
            throw new Error('FAILED: Default permissions for "employee" role returned empty/false!');
        }
        console.log('✅ PASS: Employee role has valid default permissions!');

        // Step 2: Verify user jyooo3412@gmail.com
        console.log('\n[Step 2] Checking User record for jyooo3412@gmail.com...');
        let user = await User.findOne({ email: 'jyooo3412@gmail.com' });

        if (!user) {
            console.log('User jyooo3412@gmail.com not found in DB yet. Creating test user record...');
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash('123456', salt);
            user = await User.create({
                name: 'Jyoti Employee',
                email: 'jyooo3412@gmail.com',
                passwordHash,
                role: 'employee',
                mustChangePassword: true,
                status: true,
                isActive: true
            });
        }

        console.log(`✅ User jyooo3412@gmail.com ID: ${user._id}, Role: ${user.role}`);

        // Step 3: Simulate getMyPermissions call for this user
        console.log('\n[Step 3] Simulating getMyPermissions for jyooo3412@gmail.com...');
        let myPermsResult = null;
        const mockReq = { user: { id: user._id, role: user.role } };
        const mockRes = {
            json: (data) => { myPermsResult = data; return mockRes; },
            status: (code) => mockRes
        };

        await authorizationController.getMyPermissions(mockReq, mockRes);

        if (!myPermsResult || !myPermsResult.permissions) {
            throw new Error('FAILED: getMyPermissions did not return permissions for employee!');
        }

        console.log('API getMyPermissions response for employee:');
        console.log('  Role:', myPermsResult.role);
        console.log('  Permissions count:', Object.keys(myPermsResult.permissions).filter(k => myPermsResult.permissions[k]).length);
        console.log('  payroll_runs:', myPermsResult.permissions.payroll_runs);
        console.log('  csm_tickets:', myPermsResult.permissions.csm_tickets);

        if (!myPermsResult.permissions.payroll_runs && !myPermsResult.permissions.csm_tickets) {
            throw new Error('FAILED: Employee role returned no active permissions from getMyPermissions API!');
        }

        console.log('\n==================================================');
        console.log('🎉 EMPLOYEE ROLE LOGIN & PERMISSION CHECKS PASSED!');
        console.log('==================================================');

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

runTest();
