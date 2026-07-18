const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function testLoad() {
    try {
        console.log("Loading models...");
        const EmployeeProfile = require('../models/EmployeeProfile');
        const Territory = require('../models/Territory');
        const PayrollEmployeeSummary = require('../models/PayrollEmployeeSummary');
        const MGR = require('../models/MGR');
        console.log("Models loaded successfully!");

        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm');
        console.log('Connected to MongoDB.');
        
        console.log("Checking EmployeeProfile keys:", Object.keys(EmployeeProfile.schema.paths));
        console.log("Checking Territory keys:", Object.keys(Territory.schema.paths));
        console.log("Checking PayrollEmployeeSummary basicDetails keys:", Object.keys(PayrollEmployeeSummary.schema.paths).filter(p => p.startsWith('basicDetails')));

        if (!EmployeeProfile.schema.paths.dob) {
            throw new Error("dob field missing from EmployeeProfile schema");
        }
        if (!Territory.schema.paths.mgr1 || !Territory.schema.paths.mgr5) {
            throw new Error("mgr1-5 fields missing from Territory schema");
        }
        if (!PayrollEmployeeSummary.schema.paths['basicDetails.dob']) {
            throw new Error("dob field missing from PayrollEmployeeSummary basicDetails schema");
        }

        console.log("ALL SCHEMAS VERIFIED SUCCESSFULLY!");
    } catch (err) {
        console.error("Verification failed:", err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

testLoad();
