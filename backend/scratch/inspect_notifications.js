const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const Notification = require('../models/Notification');

async function run() {
    await connectDB();
    console.log("DB Connected");

    const users = await User.find({}).lean();
    console.log(`\n--- USERS (${users.length}) ---`);
    users.forEach(u => {
        console.log(`ID: ${u._id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, CompanyId: ${u.companyId}`);
    });

    const meetings = await Meeting.find({}).lean();
    console.log(`\n--- MEETINGS (${meetings.length}) ---`);
    meetings.forEach(m => {
        console.log(`ID: ${m._id}, Title: ${m.title}, Organizer: ${m.organizerId}, Participants: ${JSON.stringify(m.participants)}, CompanyId: ${m.companyId}, CreatedBy: ${m.createdBy}`);
    });

    const notifications = await Notification.find({}).lean();
    console.log(`\n--- NOTIFICATIONS (${notifications.length}) ---`);
    notifications.forEach(n => {
        console.log(`ID: ${n._id}, User: ${n.userId}, Title: ${n.title}, Type: ${n.type}, IsRead: ${n.isRead}, IsDismissed: ${n.isDismissed}, CompanyId: ${n.companyId}`);
    });

    await mongoose.disconnect();
}
run().catch(console.error);
