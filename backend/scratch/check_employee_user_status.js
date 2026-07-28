const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quotation_db';

async function checkUser() {
    console.log('--- CHECKING USER DB STATUS ---');
    await mongoose.connect(MONGO_URI);
    try {
        const users = await User.find({ role: 'employee' }).select('name email role mustChangePassword').lean();
        console.log('Employee users in DB:', users);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkUser();
