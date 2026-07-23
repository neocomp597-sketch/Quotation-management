const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const payrollController = require('../controllers/payrollController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db';

async function runTest() {
    console.log('--- STARTING VERIFICATION FOR MY PAYSLIPS API ---');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    try {
        // Step 1: Find or mock user
        const user = await User.findOne({ email: 'dilip@gmail.com' }).lean() || await User.findOne().lean();

        console.log(`\n[Step 1] Testing getMyPayslips for user: ${user.email} (${user.name})...`);

        const req = { user: { id: user._id, email: user.email } };
        let responseData = null;
        const res = {
            json: (data) => { responseData = data; return res; },
            status: (code) => res
        };

        await payrollController.getMyPayslips(req, res);

        if (!Array.isArray(responseData)) {
            throw new Error('FAILED: getMyPayslips did not return an array');
        }

        console.log(`✅ getMyPayslips returned ${responseData.length} payslip record(s) for ${user.email}`);

        // Step 2: Test getPublicSettings
        console.log('\n[Step 2] Testing getPublicSettings...');
        let settingsData = null;
        const settingsRes = {
            json: (data) => { settingsData = data; return settingsRes; },
            status: (code) => settingsRes
        };

        await payrollController.getPublicSettings(req, settingsRes);

        if (!settingsData) {
            throw new Error('FAILED: getPublicSettings did not return settings');
        }

        console.log('✅ Public Settings:', settingsData);

        console.log('\n==================================================');
        console.log('🎉 ALL MY PAYSLIPS API CHECKS PASSED!');
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
