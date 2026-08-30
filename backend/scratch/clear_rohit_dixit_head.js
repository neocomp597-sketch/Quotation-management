require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Department = require('../models/Department');

async function clearRohitHead() {
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI);
        }

        const result = await Department.updateMany(
            {
                $or: [
                    { head: { $regex: /rohit/i } },
                    { head: { $regex: /dixit/i } }
                ]
            },
            {
                $set: { head: '' }
            }
        );

        console.log(`[Department Head Fix] Cleared Rohit Dixit from department head field. Records updated: ${result.modifiedCount}`);
        return result.modifiedCount;
    } catch (err) {
        console.error('[Department Head Fix] Error:', err);
    }
}

module.exports = clearRohitHead;

if (require.main === module) {
    clearRohitHead().then(() => process.exit(0));
}
