const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

const grantSuperAdmin = async () => {
    const email = process.argv[2];
    if (!email) {
        throw new Error('Usage: node scripts/grantSuperAdmin.js <email>');
    }

    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
    });

    const result = await User.updateOne(
        { email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        {
            $set: {
                role: 'SUPER_ADMIN',
                isActive: true,
                status: true,
            },
            $unset: {
                companyId: '',
            },
        }
    );

    const user = await User.findOne({
        email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    }).select('email role companyId status isActive').lean();

    console.log(JSON.stringify({
        matched: result.matchedCount,
        modified: result.modifiedCount,
        user,
    }, null, 2));
};

grantSuperAdmin()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
    });
