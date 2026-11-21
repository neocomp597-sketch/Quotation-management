require('dotenv').config({ path: 'backend/.env' });
const connectDB = require('../backend/config/db');
const mongoose = require('mongoose');

(async () => {
    try {
        await connectDB();
        const Company = require('../backend/models/Company');
        const User = require('../backend/models/User');
        const EmployeeProfile = require('../backend/models/EmployeeProfile');

        const companies = await Company.find({}).lean();
        console.log('Companies:', companies.map(c => ({ _id: c._id, name: c.name, status: c.status })));

        const u1 = await User.findById('69e2ceddbb7bb2411ab6d21c').lean();
        console.log('User 1:', u1);

        const u2 = await User.findById('6ad325f90c3424127b92b7bb').lean();
        console.log('User 2:', u2);

        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
