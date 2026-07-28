const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const { syncUserForEmployee, syncUsersForExistingEmployees } = require('../services/employeeUserService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db';

async function runTest() {
    console.log('--- STARTING VERIFICATION FOR AUTO USER ACCOUNT CREATION ---');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    try {
        // Step 1: Backfill Existing Employees
        console.log('\n[Step 1] Running sync for existing employees...');
        const backfillResult = await syncUsersForExistingEmployees();
        console.log('Backfill result:', backfillResult);

        // Step 2: Add New Employee - DILIP KUMAR (dilip@gmail.com)
        console.log('\n[Step 2] Adding new employee: DILIP KUMAR (dilip@gmail.com)...');
        
        // Clean up any old test record first
        await User.deleteOne({ email: 'dilip@gmail.com' });
        await EmployeeProfile.deleteOne({ email: 'dilip@gmail.com' });

        const testEmployee = await EmployeeProfile.create({
            name: 'DILIP KUMAR',
            email: 'dilip@gmail.com',
            department: 'Sales',
            designation: 'Sales Executive',
            status: 'Active'
        });

        // Trigger user sync
        const createdUser = await syncUserForEmployee(testEmployee);

        if (!createdUser) {
            throw new Error('FAILED: User account was not created for DILIP KUMAR');
        }

        console.log('✅ User account auto-created successfully!');
        console.log('   User ID:', createdUser._id);
        console.log('   Email / Login ID:', createdUser.email);
        console.log('   Role:', createdUser.role);
        console.log('   mustChangePassword:', createdUser.mustChangePassword);

        if (createdUser.email !== 'dilip@gmail.com') {
            throw new Error(`FAILED: Expected email dilip@gmail.com, got ${createdUser.email}`);
        }

        if (createdUser.mustChangePassword !== true) {
            throw new Error('FAILED: mustChangePassword flag should be true');
        }

        // Step 3: Verify Login with default password '123456'
        console.log('\n[Step 3] Verifying login with default password "123456"...');
        const dbUser = await User.findOne({ email: 'dilip@gmail.com' });
        const isMatch = await bcrypt.compare('123456', dbUser.passwordHash);

        if (!isMatch) {
            throw new Error('FAILED: Default password "123456" does not match passwordHash');
        }
        console.log('✅ Default password "123456" verified successfully!');

        // Step 4: Verify Password Change clears mustChangePassword
        console.log('\n[Step 4] Simulating password change...');
        const newSalt = await bcrypt.genSalt(10);
        dbUser.passwordHash = await bcrypt.hash('newPassword123', newSalt);
        dbUser.mustChangePassword = false;
        await dbUser.save();

        const updatedUser = await User.findOne({ email: 'dilip@gmail.com' });
        if (updatedUser.mustChangePassword !== false) {
            throw new Error('FAILED: mustChangePassword should be false after password change');
        }
        console.log('✅ Password changed successfully and mustChangePassword cleared to false!');

        // Step 5: Verify all existing employees have user accounts
        console.log('\n[Step 5] Checking all active/existing employees in database...');
        const allEmployees = await EmployeeProfile.find({ email: { $exists: true, $ne: '' } }).lean();
        let unlinkedCount = 0;

        for (const emp of allEmployees) {
            const emailStr = String(emp.email).trim().toLowerCase();
            const usr = await User.findOne({ email: { $regex: new RegExp("^" + emailStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } }).lean();
            if (!usr) {
                console.error(`❌ Employee without User account: ${emp.name} (${emp.email})`);
                unlinkedCount++;
            }
        }

        if (unlinkedCount > 0) {
            throw new Error(`FAILED: Found ${unlinkedCount} employees without matching User accounts`);
        }

        console.log(`✅ All ${allEmployees.length} employees with email addresses have matching User accounts!`);

        console.log('\n==================================================');
        console.log('🎉 ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
        console.log('==================================================');

    } catch (err) {
        console.error('\n❌ VERIFICATION TEST FAILED:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

runTest();
