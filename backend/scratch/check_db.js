const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const DealSource = require('../models/DealSource');

async function checkDb() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm');
        console.log('Connected to MongoDB');

        const usersCount = await User.countDocuments();
        const companiesCount = await Company.countDocuments();
        const sourcesCount = await DealSource.countDocuments();
        
        console.log('DB Counts:');
        console.log('Users:', usersCount);
        console.log('Companies:', companiesCount);
        console.log('Deal Sources:', sourcesCount);

        const users = await User.find().select('name email role companyId').lean();
        console.log('\nAll Users:');
        console.log(users);

        const companies = await Company.find().lean();
        console.log('\nAll Companies:');
        console.log(companies);

        const sources = await DealSource.find().lean();
        console.log('\nAll Deal Sources in DB (ignoring tenant filter):');
        console.log(sources);

    } catch (err) {
        console.error('Error checking DB:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkDb();
