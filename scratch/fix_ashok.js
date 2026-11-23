require('dotenv').config({ path: 'backend/.env' });
const connectDB = require('../backend/config/db');
const mongoose = require('mongoose');

(async () => {
    try {
        await connectDB();
        const User = require('../backend/models/User');
        const EmployeeProfile = require('../backend/models/EmployeeProfile');

        const u1 = await User.findById('69e2ceddbb7bb2411ab6d21c');
        const u2 = await User.findById('6ad325f90c3424127b92b7bb');
        const emp = await EmployeeProfile.findById('6ad325f90c3424127b92b7b6').setOptions({ bypassTenant: true, bypassBranch: true });

        console.log('Before:');
        console.log('User 1 (ABC Test):', u1 ? { id: u1._id, email: u1.email, companyId: u1.companyId } : 'Not found');
        console.log('User 2 (Stelmec):', u2 ? { id: u2._id, email: u2.email, companyId: u2.companyId } : 'Not found');
        console.log('Employee (Stelmec):', emp ? { id: emp._id, name: emp.name, email: emp.email } : 'Not found');

        if (u1 && u1.email === 'ashok.advani@stelmec.com') {
            u1.email = 'ashok.advani.abctest@stelmec.com';
            await u1.save();
            console.log('Updated User 1 email to ashok.advani.abctest@stelmec.com');
        }

        if (u2) {
            u2.email = 'ashok.advani@stelmec.com';
            if (u1 && u1.passwordHash) {
                // If Ashok set a password on User 1, copy that password hash so his password works
                u2.passwordHash = u1.passwordHash;
                u2.mustChangePassword = false;
            }
            await u2.save();
            console.log('Updated User 2 email to ashok.advani@stelmec.com and synced passwordHash');
        }

        const verifyU2 = await User.findById('6ad325f90c3424127b92b7bb').lean();
        console.log('After:');
        console.log('User 2 verified:', {
            id: verifyU2._id,
            name: verifyU2.name,
            email: verifyU2.email,
            companyId: verifyU2.companyId,
            employeeProfileId: verifyU2.employeeProfileId,
            role: verifyU2.role
        });

        await mongoose.disconnect();
        console.log('Done!');
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
