require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Department = require('../models/Department');
const User = require('../models/User');

async function findRohit() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const depts = await Department.find({}).lean();
        console.log('All Departments in DB:');
        console.log(JSON.stringify(depts, null, 2));

        const deptsWithRohit = await Department.find({
            $or: [
                { head: { $regex: /rohit/i } },
                { head: { $regex: /dixit/i } }
            ]
        });

        console.log('\nDepartments with Rohit Dixit as head:', deptsWithRohit.length);
        if (deptsWithRohit.length > 0) {
            console.log(JSON.stringify(deptsWithRohit, null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findRohit();
