const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Notification = require('./models/Notification');
const User = require('./models/User');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");
        
        const notificationsCount = await Notification.countDocuments({});
        console.log("Total Notifications in DB:", notificationsCount);
        
        const sampleNotifications = await Notification.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('userId', 'name email')
            .lean();
            
        console.log("Sample Notifications:", JSON.stringify(sampleNotifications, null, 2));

        const users = await User.find({}).select('name email companyId').lean();
        console.log("Available Users in DB:", JSON.stringify(users, null, 2));
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
