const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm_db';
const SystemUpdate = require('../models/SystemUpdate');

async function seedV390() {
    console.log('--- Seeding System Update v3.9.0-csm-engineers ---');
    await mongoose.connect(MONGO_URI);

    const doc = await SystemUpdate.findOneAndUpdate(
        { version: "v3.9.0-csm-engineers" },
        {
            version: "v3.9.0-csm-engineers",
            title: "Engineer-Wise Complaint Visibility & Service Engineer Auto-Sync",
            message: "We have implemented engineer-wise access control for support complaints and auto-synchronization of Service Engineer employees to the Engineers Master module.",
            releaseNotes: [
                "Engineer-Wise Complaint Visibility: Support tickets/complaints are restricted so each service engineer only views and manages complaints assigned to them",
                "Admin & Supervisor Oversight: Users with Admin or Manager roles retain full access to view, filter, and reassign all system complaints across engineers",
                "Reassignment Protection: Restricted complaint reassignment privileges exclusively to Admin and Manager roles with 403 Forbidden enforcement",
                "Service Engineer Auto-Sync: Employees created or updated in Employee Master with designation 'Service Engineer' automatically sync to Engineers Master with Name, Email, Mobile, and Status",
                "Dynamic Inactive Sync: Changing an employee's designation away from 'Service Engineer' or marking them Inactive/Resigned automatically updates their status to Inactive in Engineers Master",
                "Quotation Version Snapshot Fix: Resolved QuotationVersion snapshot creation during quotation edits to ensure smooth quotation revisions and zero HTTP 500 errors"
            ],
            deployedBy: "Super Admin",
            deployedAt: new Date("2026-07-22T21:00:00Z"),
            isActive: true
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    console.log('✅ System Update Seeded successfully:', doc.version, doc.title);
    await mongoose.disconnect();
}

seedV390().catch(err => {
    console.error('❌ Failed to seed SystemUpdate:', err);
    mongoose.disconnect();
    process.exit(1);
});
