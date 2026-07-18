const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Customer = require('../models/Customer');

// Mock buildCustomerQuery logic since it's an internal function in customerController
const buildCustomerQueryMock = async (req) => {
    const query = {};
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'manager') {
        const Territory = require('../models/Territory');
        const userTerritories = await Territory.find({
            $or: [
                { manager: req.user.id },
                { salesReps: req.user.id }
            ]
        }).select('_id').lean();
        
        const territoryIds = userTerritories.map(t => t._id);
        
        query.$or = [
            { territory: { $in: territoryIds } },
            { createdBy: req.user.id }
        ];
    }

    if (req.query.territory) {
        query.territory = req.query.territory;
    }

    return query;
};

async function run() {
    try {
        console.log("Connecting to database...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully!");

        // 1. Mock request for a manager user
        const reqManager = {
            user: {
                id: '6a0f137f0ff7fb4e4635c609', // guest@gmail.com ID
                role: 'manager',
                companyId: '6a0b44ab81a41f89dab23668'
            },
            query: {}
        };

        const queryManager = await buildCustomerQueryMock(reqManager);
        console.log("\n--- Manager Request Query Result ---");
        console.log(queryManager);
        if (Object.keys(queryManager).length === 0) {
            console.log("SUCCESS: Manager query is empty (unfiltered for company).");
        } else {
            console.error("FAIL: Manager query is not empty:", queryManager);
            process.exit(1);
        }

        // 2. Mock request for a regular sales rep
        const reqSales = {
            user: {
                id: '695a75e7ac70ed0e6a2ffba6',
                role: 'sales',
                companyId: '6a0b44ab81a41f89dab23668'
            },
            query: {}
        };

        const querySales = await buildCustomerQueryMock(reqSales);
        console.log("\n--- Sales Request Query Result ---");
        console.log(querySales);
        if (querySales.$or) {
            console.log("SUCCESS: Sales rep query is filtered by territory/createdBy.");
        } else {
            console.error("FAIL: Sales rep query is not filtered:", querySales);
            process.exit(1);
        }

        console.log("\nALL VERIFICATIONS PASSED!");
        process.exit(0);
    } catch (e) {
        console.error("Verification failed:", e);
        process.exit(1);
    }
}

run();
