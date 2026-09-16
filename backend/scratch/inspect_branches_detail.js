const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');
const Branch = require('../models/Branch');

async function inspectBranches() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'super@gmail.com' });
    const companyId = user.companyId;

    const branches = await Branch.find({ companyId });
    console.log("Current Branches in DB:");
    branches.forEach(b => {
        console.log(JSON.stringify(b, null, 2));
    });

    process.exit(0);
}

inspectBranches();
