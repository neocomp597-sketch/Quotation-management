const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');
const User = require('./models/User');

async function test() {
    try {
        console.log('Connecting to database...');
        await connectDB();
        console.log('Database connected.');

        console.log('Finding all users...');
        const users = await User.find({}).lean();
        console.log('Users found:', users.length);
        console.log('First user:', users[0]);
    } catch (error) {
        console.error('Error during query:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

test();
