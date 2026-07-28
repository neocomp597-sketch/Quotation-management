const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotations';

async function runVerification() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB.');

        const EmployeeProfile = require('../models/EmployeeProfile');
        const User = require('../models/User');
        const Asset = require('../models/Asset');
        const Company = require('../models/Company');

        // Fetch or create test company
        let company = await Company.findOne();
        if (!company) {
            company = await Company.create({ name: 'Test Corp' });
        }
        const companyId = company._id;

        console.log('\n--- TESTING REQUIREMENT 1: Auto User Creation ---');
        const testEmail = `test.employee.${Date.now()}@example.com`;
        const payrollController = require('../controllers/payrollController');

        const mockReq = {
            body: {
                name: 'DILIP KUMAR',
                email: testEmail,
                mobile: '9876543210',
                joiningDate: new Date(),
                department: 'Service',
                designation: 'Service Engineer'
            },
            user: { id: new mongoose.Types.ObjectId(), email: 'admin@test.com', companyId }
        };

        let createdEmp = null;
        const mockRes = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { createdEmp = data; return this; }
        };

        await payrollController.createEmployee(mockReq, mockRes);
        console.log('Employee creation response status:', mockRes.statusCode);

        if (!createdEmp || !createdEmp._id) {
            throw new Error('FAILED to create employee via payrollController');
        }

        console.log('Created Employee:', createdEmp.name, 'with ID:', createdEmp._id);

        // Check if user account was auto created
        const autoUser = await User.findOne({ email: testEmail });
        if (!autoUser) {
            throw new Error('FAILED: Auto user account was not created in User model!');
        }

        console.log('✅ PASS: Auto user created in User model!');
        console.log('Auto User Email:', autoUser.email);
        console.log('Auto User Role:', autoUser.role);
        console.log('Auto User mustChangePassword:', autoUser.mustChangePassword);

        const passwordMatch = await bcrypt.compare('123456', autoUser.passwordHash);
        if (!passwordMatch) {
            throw new Error('FAILED: Password hash does not match default password 123456!');
        }
        console.log('✅ PASS: Default password "123456" verified!');

        if (autoUser.mustChangePassword !== true) {
            throw new Error('FAILED: mustChangePassword flag is not true on auto-created user!');
        }
        console.log('✅ PASS: mustChangePassword is true for first login prompt!');

        console.log('\n--- TESTING REQUIREMENT 2: Reporting To Field ---');
        // Create supervisor employee
        const supervisor = await EmployeeProfile.create({
            name: 'ROSHAN SUPERVISOR',
            email: `roshan.${Date.now()}@example.com`,
            joiningDate: new Date(),
            companyId
        });

        // Update DILIP KUMAR to report to ROSHAN
        const updateReq = {
            params: { id: createdEmp._id },
            body: { reportingTo: supervisor._id },
            user: { id: new mongoose.Types.ObjectId(), email: 'admin@test.com', companyId }
        };

        let updatedEmp = null;
        const updateRes = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { updatedEmp = data; return this; }
        };

        await payrollController.updateEmployee(updateReq, updateRes);
        console.log('Updated Employee Reporting To:', updatedEmp?.reportingTo);

        if (!updatedEmp || !updatedEmp.reportingTo || String(updatedEmp.reportingTo._id || updatedEmp.reportingTo) !== String(supervisor._id)) {
            throw new Error('FAILED: Reporting To field failed to update or populate!');
        }
        console.log('✅ PASS: Reporting To field successfully linked & populated supervisor:', updatedEmp.reportingTo.name);

        console.log('\n--- TESTING REQUIREMENT 3: Serial No. Partial Search ---');
        const serialSuffix = String(Math.floor(1000 + Math.random() * 9000)); // e.g. 1002
        const serial1 = `CE${serialSuffix}`;
        const serial2 = `JH${serialSuffix}`;
        const serial3 = `FV${serialSuffix}`;

        await Asset.create([
            { serialNumber: serial1, companyId, status: 'IN_STOCK' },
            { serialNumber: serial2, companyId, status: 'IN_STOCK' },
            { serialNumber: serial3, companyId, status: 'IN_STOCK' }
        ]);

        const warrantyAmcController = require('../controllers/warrantyAmcController');
        const searchReq = {
            query: { q: serialSuffix },
            user: { companyId }
        };

        let searchHits = [];
        const searchRes = {
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { searchHits = data; return this; }
        };

        await warrantyAmcController.searchSerialNumbers(searchReq, searchRes);

        console.log(`Partial search query "${serialSuffix}" returned ${searchHits.length} results:`);
        searchHits.forEach(h => console.log(' - Serial:', h.serialNumber));

        if (searchHits.length < 3) {
            throw new Error(`FAILED: Partial search for "${serialSuffix}" expected at least 3 results, got ${searchHits.length}`);
        }

        const foundSerials = searchHits.map(h => h.serialNumber);
        if (!foundSerials.includes(serial1) || !foundSerials.includes(serial2) || !foundSerials.includes(serial3)) {
            throw new Error('FAILED: Partial search results missing expected serial numbers!');
        }

        console.log('✅ PASS: Partial serial number search successfully matched all suffix serials!');

        console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');

        // Cleanup test data
        await EmployeeProfile.deleteOne({ _id: createdEmp._id });
        await EmployeeProfile.deleteOne({ _id: supervisor._id });
        await User.deleteOne({ _id: autoUser._id });
        await Asset.deleteMany({ serialNumber: { $in: [serial1, serial2, serial3] } });

    } catch (err) {
        console.error('❌ VERIFICATION FAILURE:', err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

runVerification();
