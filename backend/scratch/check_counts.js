const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function checkAllCounts() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: 'super@gmail.com' });
    const companyId = user.companyId;

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Checking collections for companyId: ${companyId}`);

    for (let c of collections) {
        const collectionName = c.name;
        try {
            const count = await mongoose.connection.db.collection(collectionName).countDocuments({
                $or: [
                    { companyId: companyId },
                    { companyId: new mongoose.Types.ObjectId(companyId) },
                    { companyId: String(companyId) }
                ]
            });
            if (count > 0) {
                console.log(`- ${collectionName}: ${count} records`);
            }
        } catch (e) {
            // ignore
        }
    }

    process.exit(0);
}

checkAllCounts();
