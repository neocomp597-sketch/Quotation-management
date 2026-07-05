const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');
const csmMasterController = require('../controllers/csmMasterController');

async function run() {
    try {
        console.log("Connecting to database...");
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/crm');
        console.log("Connected successfully!");

        const adminUser = await User.findOne({ email: 'admin@gmail.com' });
        if (!adminUser) {
            console.error("Admin user not found!");
            process.exit(1);
        }

        console.log("Found admin user with companyId:", adminUser.companyId);

        // Mock req and res
        const req = {
            user: {
                id: adminUser._id,
                companyId: adminUser.companyId
            }
        };

        const res = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log("Seeding response data:", data);
            }
        };

        console.log("Running seedMhData...");
        await csmMasterController.seedMhData(req, res);
        console.log("Seeding complete!");

        process.exit(0);
    } catch (e) {
        console.error("Seeding failed:", e);
        process.exit(1);
    }
}

run();
