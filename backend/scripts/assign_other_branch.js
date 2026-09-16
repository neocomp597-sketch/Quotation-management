const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Branch = require('../models/Branch');
const EmployeeProfile = require('../models/EmployeeProfile');
const { runWithTenant } = require('../middlewares/tenantContext');

async function assignOtherBranch() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const user = await User.findOne({ email: 'super@gmail.com' });
        const companyId = user.companyId;

        await runWithTenant(companyId, async () => {
            // 1. Find or create OTHER branch
            let otherBranch = await Branch.findOne({
                companyId,
                $or: [
                    { name: /other/i },
                    { code: /other/i }
                ]
            });

            if (!otherBranch) {
                otherBranch = await Branch.create({
                    name: 'OTHER',
                    code: 'OTHER',
                    branchPrefix: 'OTH',
                    address: 'Other Locations',
                    country: 'India',
                    state: '',
                    city: '',
                    status: 'Active',
                    companyId
                });
                console.log(`Created new Branch "OTHER" (ID: ${otherBranch._id})`);
            } else {
                console.log(`Using existing Branch "OTHER" (ID: ${otherBranch._id})`);
            }

            // 2. Count employees with blank branch
            const blankCount = await EmployeeProfile.countDocuments({ companyId, branchId: null });
            console.log(`Found ${blankCount} employees with blank branchId.`);

            // 3. Update all employees with blank branch to OTHER branch
            const updateRes = await EmployeeProfile.updateMany(
                { companyId, branchId: null },
                {
                    $set: {
                        branchId: otherBranch._id,
                        assignedBranches: [otherBranch._id],
                        branchPrefix: otherBranch.branchPrefix
                    }
                }
            );

            console.log(`Updated ${updateRes.modifiedCount} employees to "OTHER" Branch.`);

            // Also update User accounts for these employees
            const unassignedUsers = await User.find({ companyId, role: 'employee', branchId: null });
            console.log(`Updating ${unassignedUsers.length} employee Users with blank branchId to OTHER...`);
            await User.updateMany(
                { companyId, role: 'employee', branchId: null },
                {
                    $set: {
                        branchId: otherBranch._id,
                        assignedBranches: [otherBranch._id]
                    }
                }
            );

            // 4. Verify branch assignment across all employees
            console.log("\n=== VERIFICATION OF BRANCH ASSIGNMENT ===");
            const branches = await Branch.find({ companyId });
            let totalAssigned = 0;
            for (let b of branches) {
                const count = await EmployeeProfile.countDocuments({ companyId, branchId: b._id });
                totalAssigned += count;
                console.log(`- Branch "${b.name}" (Code: ${b.code}, Prefix: ${b.branchPrefix}): ${count} employees`);
            }

            const unassignedRemaining = await EmployeeProfile.countDocuments({ companyId, branchId: null });
            console.log(`- Employees with Blank Branch: ${unassignedRemaining}`);
            console.log(`- Total Employees in DB: ${totalAssigned + unassignedRemaining}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Error assigning OTHER branch:", err);
        process.exit(1);
    }
}

assignOtherBranch();
