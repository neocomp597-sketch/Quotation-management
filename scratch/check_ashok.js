const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

const connectDB = require('../backend/config/db');

(async () => {
    try {
        await connectDB();
        const User = require('../backend/models/User');
        const EmployeeProfile = require('../backend/models/EmployeeProfile');
        
        console.log('--- USERS matching ashok or dp3002 ---');
        const users = await User.find({
            $or: [
                { email: /ashok/i },
                { email: /dp3002/i },
                { name: /ashok/i }
            ]
        }).lean();
        console.log('Users found:', users.map(u => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            employeeProfileId: u.employeeProfileId,
            companyId: u.companyId
        })));

        console.log('--- EMPLOYEES matching ashok or dp3002 ---');
        const emps = await EmployeeProfile.find({
            $or: [
                { email: /ashok/i },
                { email: /dp3002/i },
                { name: /ashok/i },
                { employeeId: /dp3002/i }
            ]
        }).setOptions({ bypassTenant: true, bypassBranch: true }).lean();
        console.log('Employees found:', emps.map(e => ({
            _id: e._id,
            name: e.name,
            employeeId: e.employeeId,
            email: e.email,
            status: e.status,
            companyId: e.companyId
        })));

        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
