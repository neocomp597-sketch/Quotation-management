require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const Engineer = require('../models/Engineer');
const Branch = require('../models/Branch');
const CompanySettings = require('../models/CompanySettings');

async function assignSBU2Branch() {
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI);
        }
        console.log('[Branch Assign] Connected to DB');

        // Resolve companyId for super@gmail.com
        const superUser = await User.findOne({ email: 'super@gmail.com' });
        let companyId = superUser?.companyId;
        if (!companyId) {
            const company = await CompanySettings.findOne({});
            companyId = company?._id;
        }

        console.log('[Branch Assign] Target Company ID:', companyId);

        // Find or create SBU-II Branch (Code: USGOAN, Prefix: USG)
        let branch = await Branch.findOne({
            companyId,
            $or: [
                { code: 'USGOAN' },
                { branchPrefix: 'USG' },
                { name: { $regex: /^SBU[- ]?II$/i } }
            ]
        });

        if (!branch) {
            console.log('[Branch Assign] Branch SBU-II not found. Creating new branch...');
            branch = new Branch({
                name: 'SBU-II',
                code: 'USGOAN',
                branchPrefix: 'USG',
                companyId,
                status: 'Active'
            });
            await branch.save();
            console.log('[Branch Assign] Created Branch:', branch._id);
        } else {
            console.log('[Branch Assign] Found existing Branch:', branch._id, branch.name);
            branch.name = 'SBU-II';
            branch.code = 'USGOAN';
            branch.branchPrefix = 'USG';
            branch.status = 'Active';
            await branch.save();
        }

        const branchId = branch._id;

        // 1. Update ALL EmployeeProfiles
        const empResult = await EmployeeProfile.updateMany(
            { companyId },
            {
                $set: {
                    branchId: branchId,
                    assignedBranches: [branchId],
                    branchPrefix: 'USG'
                }
            }
        );
        console.log(`[Branch Assign] EmployeeProfiles updated: ${empResult.modifiedCount}`);

        // 2. Update ALL Users
        const userResult = await User.updateMany(
            { companyId },
            {
                $set: {
                    branchId: branchId,
                    assignedBranches: [branchId],
                    branches: [branchId],
                    branchPrefix: 'USG'
                }
            }
        );
        console.log(`[Branch Assign] Users updated: ${userResult.modifiedCount}`);

        // 3. Update ALL Engineers
        const engResult = await Engineer.updateMany(
            { companyId },
            {
                $set: {
                    branchId: branchId,
                    assignedBranches: [branchId],
                    branchPrefix: 'USG'
                }
            }
        );
        console.log(`[Branch Assign] Engineers updated: ${engResult.modifiedCount}`);

        console.log(`[Branch Assign] SUCCESS: All employees, users, and engineers assigned to Branch "SBU-II" (Code: USGOAN, Prefix: USG).`);
        return {
            branch,
            employeesUpdated: empResult.modifiedCount,
            usersUpdated: userResult.modifiedCount,
            engineersUpdated: engResult.modifiedCount
        };
    } catch (err) {
        console.error('[Branch Assign Error]:', err);
    }
}

module.exports = assignSBU2Branch;

if (require.main === module) {
    assignSBU2Branch().then(() => process.exit(0));
}
