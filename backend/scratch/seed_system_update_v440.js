const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const SystemUpdate = require('../models/SystemUpdate');

async function seedV440Update() {
    try {
        console.log('Connecting to MongoDB at:', process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tally-quotations');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tally-quotations');
        console.log('Connected to MongoDB.');

        const updateData = {
            version: "v4.4.0-csm-reporting-hierarchy",
            title: "Customer Service Reporting Hierarchy, Ticket Visibility & System Updates Sync",
            message: "We have integrated the Organization Chart reporting hierarchy into Customer Service, added 'My Complaints' and 'My Team Complaints' ticket visibility rules, ensured automatic redirection after raising tickets, and updated full role authorization module controls.",
            releaseNotes: [
                "CSM Reporting Hierarchy Integration: Customer Service now uses the exact reporting hierarchy configured in the CRM / Org Chart.",
                "My Complaints View: Displays only the logged-in user's own tickets (tab=my).",
                "My Team Complaints View: Displays tickets of all direct and indirect reportees in the reporting hierarchy (tab=team).",
                "All Complaints View: Admin & Manager users can access organization-wide ticket visibility (tab=all).",
                "Ticket Ownership Preservation: Assignee/owner (createdBy, assignedEngineerId) is strictly preserved without altering ownership based on hierarchy filters.",
                "Raise Ticket Navigation Redirect: Creating standard or manual tickets automatically displays a success message, saves the record, and redirects the user directly back to the Ticket Register screen (/csm/tickets).",
                "Sidebar Menu Integration: Customer Service menu updated with My Complaints and My Team Complaints sub-items under Ticket Register.",
                "Authorization Module Sync: Updated Admin Authorization (/admin/authorization) permissions matrix to include all module keys across Customer Service, Org Chart, Flowchart Builder, and Payroll Masters."
            ],
            detailedChanges: [
                { date: "2026-08-04", module: "Customer Service", submodule: "Reporting Hierarchy", changes: "Traversed EmployeeProfile and User hierarchy trees to resolve direct and indirect reportees for ticket filtering." },
                { date: "2026-08-04", module: "Customer Service", submodule: "Ticket Register", changes: "Added My Complaints, My Team Complaints, and All Complaints sub-navigation tabs and filters." },
                { date: "2026-08-04", module: "Customer Service", submodule: "Raise Ticket Form", changes: "Enforced automatic redirection to Ticket Register list view after successfully saving standard or manual tickets." },
                { date: "2026-08-04", module: "Admin & System", submodule: "Authorization & Updates", changes: "Updated Authorization permission keys across all modules and published v4.4.0 System Update release notes." }
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

seedV440Update();
