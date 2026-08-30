require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function updatePassword() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const email = 'waghom730@gmail.com';
        const newPassword = '123456';

        let user = await User.findOne({ email: { $regex: new RegExp("^" + email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } });

        if (!user) {
            console.log(`User ${email} not found in DB.`);
            process.exit(1);
        }

        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(newPassword, salt);
        user.mustChangePassword = false;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.passwordChangedAt = new Date();
        await user.save();

        console.log(`Successfully updated password for user: ${user.email} (${user.name}) to '${newPassword}'`);
        process.exit(0);
    } catch (err) {
        console.error('Error updating password:', err);
        process.exit(1);
    }
}

updatePassword();
