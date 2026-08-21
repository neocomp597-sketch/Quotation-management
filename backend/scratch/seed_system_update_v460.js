const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const SystemUpdate = require('../models/SystemUpdate');

async function seedV460Update() {
    try {
        console.log('Connecting to MongoDB at:', process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tally-quotations');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tally-quotations');
        console.log('Connected to MongoDB.');

        const updateData = {
            version: "v4.8.0-auth-granularity-darkmode",
            title: "Individual User Permission Overrides, Accordion UI, Vendor Login Split & Dark Mode Standardization",
            message: "We have introduced granular per-user permission overrides, collapsible accordion permission cards, a dedicated Vendor Login management tab, and completed full dark-mode UI standardization across Authorization, Enquiry Visit Management, and Vouchers.",
            releaseNotes: [
                "Individual User Permission Overrides: Added custom permissions support for individual team users beyond default role permissions with automatic permission count calculation.",
                "Collapsible Accordion Permission UI: Converted all role and user permission cards into smooth accordion components with zero blank-space collapsed views.",
                "Vendor Logins Separation: Decoupled vendor user accounts from Team Users into a dedicated 'Vendor Logins' tab under Authorization management.",
                "Granular Merging Engine: Updated authorization backend controller to merge role defaults with custom user permissions in real-time.",
                "Application-Wide Dark Mode Standardization: Fully audited and applied Tailwind CSS dark mode utilities across Authorization matrix, Enquiry Detail, Visit Management, and Voucher records.",
                "Standalone Visit Management: Integrated full-page visit scheduling and logging interface with GPS reverse geocoding and visit history tracking."
            ],
            detailedChanges: [
                { date: "2026-08-20", module: "Admin & System", submodule: "Authorization Matrix", changes: "Implemented individual user custom permissions map, permission merging logic, accordion card UI, and dedicated Vendor Logins tab." },
                { date: "2026-08-20", module: "UI & Aesthetics", submodule: "Dark Mode Audit", changes: "Standardized slate dark mode theme across Authorization, Enquiry Detail, Schedule Visit, and Vouchers." },
                { date: "2026-08-19", module: "Vendor Portal", submodule: "Authentication Sync", changes: "Automated vendor user account linkage with Vendor Master profiles." },
                { date: "2026-08-18", module: "Enquiry Module", submodule: "Visit Management", changes: "Created standalone Enquiry Visit scheduling page with GPS reverse geocoding and complete visit history." }
            ],
            deployedBy: "Super Admin",
            deployedAt: new Date(),
            isActive: true
        };

        const doc = await SystemUpdate.findOneAndUpdate(
            { version: updateData.version },
            updateData,
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );

        console.log(`✅ Seeded SystemUpdate [${doc.version}]: ${doc.title}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to seed system update:', err);
        process.exit(1);
    }
}

seedV460Update();
