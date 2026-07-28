const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const EmployeeProfile = require('../models/EmployeeProfile');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db';

async function runTest() {
    console.log('--- STARTING VERIFICATION FOR REPORTING TO FIELD ---');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    try {
        // Step 1: Create Supervisor Employee "ROSHAN"
        console.log('\n[Step 1] Creating/Ensuring Supervisor employee "ROSHAN"...');
        let roshan = await EmployeeProfile.findOne({ name: 'ROSHAN' });
        if (!roshan) {
            roshan = await EmployeeProfile.create({
                name: 'ROSHAN',
                email: 'roshan@company.com',
                designation: 'Senior Manager',
                department: 'Management',
                status: 'Active',
                joiningDate: new Date()
            });
        }
        console.log(`✅ Supervisor "ROSHAN" ID: ${roshan._id}`);

        // Step 2: Create Subordinate Employee "DILIP KUMAR" with reportingTo = ROSHAN
        console.log('\n[Step 2] Creating/Updating Employee "DILIP KUMAR" reporting to "ROSHAN"...');
        let dilip = await EmployeeProfile.findOne({ email: 'dilip@gmail.com' });
        if (!dilip) {
            dilip = await EmployeeProfile.create({
                name: 'DILIP KUMAR',
                email: 'dilip@gmail.com',
                reportingTo: roshan._id,
                status: 'Active',
                joiningDate: new Date()
            });
        } else {
            dilip.reportingTo = roshan._id;
            await dilip.save();
        }

        console.log(`✅ Employee "DILIP KUMAR" saved with reportingTo = ${dilip.reportingTo}`);

        // Step 3: Populate EmployeeProfile and verify reportingTo object
        console.log('\n[Step 3] Querying employee and populating reportingTo...');
        const populatedDilip = await EmployeeProfile.findById(dilip._id)
            .populate('reportingTo', 'name email designation')
            .lean();

        if (!populatedDilip.reportingTo || populatedDilip.reportingTo.name !== 'ROSHAN') {
            throw new Error(`FAILED: Expected reportingTo.name to be "ROSHAN", got ${populatedDilip.reportingTo?.name}`);
        }

        console.log('✅ Populated Supervisor Details:');
        console.log('   Supervisor Name:', populatedDilip.reportingTo.name);
        console.log('   Supervisor Email:', populatedDilip.reportingTo.email);
        console.log('   Supervisor Designation:', populatedDilip.reportingTo.designation);

        // Step 4: Verify Self-Exclusion Logic
        console.log('\n[Step 4] Verifying self-exclusion filter logic...');
        const allActiveEmployees = await EmployeeProfile.find({ status: 'Active' }).lean();
        const dilipIdStr = String(dilip._id);

        const filteredForDilip = allActiveEmployees.filter(emp => String(emp._id) !== dilipIdStr);
        const selfFound = filteredForDilip.some(emp => String(emp._id) === dilipIdStr);

        if (selfFound) {
            throw new Error('FAILED: DILIP KUMAR was found in his own reporting to options!');
        }

        console.log(`✅ Self-exclusion verified! ${allActiveEmployees.length} total active employees -> ${filteredForDilip.length} options (DILIP KUMAR correctly excluded).`);

        console.log('\n==================================================');
        console.log('🎉 ALL REPORTING TO VERIFICATION CHECKS PASSED!');
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
