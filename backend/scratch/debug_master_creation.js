const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const TicketSource = require('../models/TicketSource');
const TicketCategory = require('../models/TicketCategory');
const TicketType = require('../models/TicketType');
const Priority = require('../models/Priority');
const User = require('../models/User');
const { runWithTenant } = require('../middlewares/tenantContext');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const user = await User.findOne().lean();
        if (!user) {
            console.log("No user found.");
            process.exit(0);
        }
        console.log("User companyId:", user.companyId);

        const companyId = user.companyId ? user.companyId.toString() : null;

        // Try dropping index directly in the test script
        try {
            const Counter = require('../models/Counter');
            await Counter.collection.dropIndex('type_1_prefix_1_year_1');
            console.log("SUCCESS: Index type_1_prefix_1_year_1 dropped!");
        } catch (err) {
            console.log("INFO: Index drop failed or already dropped:", err.message);
        }

        await runWithTenant(companyId, async () => {
            // Test Counter creation
            try {
                const Counter = require('../models/Counter');
                const counter = await Counter.findOneAndUpdate(
                    { type: 'ticket', companyId, prefix: 'CSM', year: 2026 },
                    { $inc: { seq: 1 } },
                    { new: true, upsert: true, setDefaultsOnInsert: true }
                );
                console.log("Counter updated successfully:", counter);
            } catch (err) {
                console.error("Counter update failed:", err);
            }

            // Test sources
            try {
                const src = await TicketSource.create({ name: 'Test Source ' + Date.now() });
                console.log("TicketSource created:", src);
            } catch (err) {
                console.error("TicketSource creation failed:", err);
            }

            // Test categories
            try {
                const cat = await TicketCategory.create({ name: 'Test Category ' + Date.now(), description: 'Desc' });
                console.log("TicketCategory created:", cat);
            } catch (err) {
                console.error("TicketCategory creation failed:", err);
            }
        });

        process.exit(0);
    } catch (err) {
        console.error("DB connection or other error:", err);
        process.exit(1);
    }
}
run();
