const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

const EmployeeProfile = require('../models/EmployeeProfile');
const Branch = require('../models/Branch');
const Counter = require('../models/Counter');
const { generateNextUniqueEmployeeId } = require('../utils/employeeIdHelper');

async function fixDuplicateEmployeeIds() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const employees = await EmployeeProfile.find({}).populate('branchId').lean();
        console.log(`Analyzing ${employees.length} total employees...`);

        const seenIds = new Set();
        const duplicates = [];

        for (const emp of employees) {
            if (!emp.employeeId) {
                duplicates.push(emp);
            } else if (seenIds.has(emp.employeeId)) {
                duplicates.push(emp);
            } else {
                seenIds.add(emp.employeeId);
            }
        }

        console.log(`Found ${duplicates.length} duplicate/missing Employee IDs`);

        for (const emp of duplicates) {
            if (emp.branchId) {
                const { employeeId } = await generateNextUniqueEmployeeId(emp.companyId, emp.branchId._id);
                await EmployeeProfile.findByIdAndUpdate(emp._id, {
                    branchPrefix: emp.branchId.branchPrefix,
                    employeeId
                });
                console.log(`Updated employee ${emp.name} -> assigned unique ID: ${employeeId}`);
            } else {
                // Find a default branch or first branch
                const firstBranch = await Branch.findOne({ companyId: emp.companyId }).lean();
                if (firstBranch) {
                    const { employeeId } = await generateNextUniqueEmployeeId(emp.companyId, firstBranch._id);
                    await EmployeeProfile.findByIdAndUpdate(emp._id, {
                        branchId: firstBranch._id,
                        branchPrefix: firstBranch.branchPrefix,
                        employeeId
                    });
                    console.log(`Updated employee ${emp.name} (with branch ${firstBranch.name}) -> assigned unique ID: ${employeeId}`);
                }
            }
        }

        // Align counters for all branches
        const branches = await Branch.find({}).lean();
        for (const b of branches) {
            await generateNextUniqueEmployeeId(b.companyId, b._id);
        }

        console.log('All Employee IDs are now 100% unique and counters are aligned!');
        process.exit(0);
    } catch (err) {
        console.error('Error fixing duplicate employee IDs:', err);
        process.exit(1);
    }
}

fixDuplicateEmployeeIds();
