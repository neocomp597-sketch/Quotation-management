const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const SystemUpdate = require('../models/SystemUpdate');

async function seedNewUpdates() {
    try {
        console.log('Connecting to MongoDB at:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        const updatesToSeed = [
            {
                version: "v4.1.0-floating-notepad-settings",
                title: "Floating Notepad Widget & Company Settings Management",
                message: "We have introduced an app-wide Floating Notepad with sticky notes for rapid note taking, along with enhanced Company Settings for organization logo, address, and billing defaults.",
                releaseNotes: [
                    "Floating Notepad Widget: Quick-access floating note taker available on all pages with rich formatting, color coding, and quick toggle features.",
                    "Personal & Dashboard Notes: Organize notes into personal lists and pin critical notes directly to the main Executive Dashboard.",
                    "Company Branding & Settings: Updated Company Settings module to manage company logo, address, state, GSTIN, phone, and official domain defaults.",
                    "Header & Document Branding Sync: Automatically propagate company logo and business profile to application headers and printable document footers."
                ],
                detailedChanges: [
                    { date: "2026-07-25", module: "Dashboard", submodule: "Notepad Widget", changes: "Added Floating Notepad component with color tags, pin-to-dashboard, and persistent notes per user." },
                    { date: "2026-07-25", module: "Authentication", submodule: "Company Settings", changes: "Added Company logo upload, GSTIN/Tax ID configuration, and official address preferences in System Settings." }
                ],
                deployedBy: "Super Admin",
                deployedAt: new Date("2026-07-25T21:42:00Z"),
                isActive: true
            },
            {
                version: "v4.2.0-multi-branch-master",
                title: "Branch Master & Multi-Branch Enterprise Location Tagging",
                message: "We have launched the new Branch Master module under Master Management, allowing organizations to manage multiple branch locations, assign branch tags across system entities, and filter records by branch.",
                releaseNotes: [
                    "Branch Master Page: Added Branch Master CRUD interface with Branch Code (e.g. BR001), Name, Location, Address, Manager, and Status.",
                    "Multi-Branch Data Association: Tagged Users, Employees, Customers, Quotations, Enquiries, and CSM Support Tickets with branch references.",
                    "Branch Filtering & Access Control: Enabled location-wise filtering on Customer Directory, Quotation Register, Ticket Center, and Employee Master.",
                    "Branch Dropdown Integration: Integrated searchable PortalDropdown for Branch selection across all creation and edit modals."
                ],
                detailedChanges: [
                    { date: "2026-07-26", module: "Master Management", submodule: "Branch Master", changes: "Created Branch model, API controller, and Branch Master page with full CRUD and status controls." },
                    { date: "2026-07-26", module: "CRM Core", submodule: "Multi-Branch Tagging", changes: "Added branchId tagging to Users, Customers, Enquiries, Quotations, and CSM Support Tickets." }
                ],
                deployedBy: "Super Admin",
                deployedAt: new Date("2026-07-26T20:45:00Z"),
                isActive: true
            },
            {
                version: "v4.3.0-org-chart-hierarchy",
                title: "Interactive Organizational Hierarchy Chart & Employee ID Helper",
                message: "We have added an interactive visual Organization Chart (Org Chart), an automated unique Employee ID generator, and enhanced hierarchical reporting synchronization.",
                releaseNotes: [
                    "Interactive Org Chart: Dynamic hierarchy tree view visualizing leadership, department heads, managers, and reporting staff with search and expandable nodes.",
                    "Automated Employee ID Generator: Implemented employeeIdHelper utility to automatically format and issue unique sequential Employee IDs (e.g., EMP001, EMP002).",
                    "Employee ID Migration & Sanitation: Automatically fixed duplicate Employee ID entries across database records with clean sequential backfill.",
                    "Hierarchical Reporting Sync: Synchronized 'Reporting To' supervisor relationships between HR Employee Profiles and User authentication accounts."
                ],
                detailedChanges: [
                    { date: "2026-07-27", module: "Payroll & HR", submodule: "Org Chart", changes: "Built interactive OrgChart page with tree layout, supervisor search, and expandable team nodes." },
                    { date: "2026-07-27", module: "Employee Master", submodule: "Employee ID Helper", changes: "Integrated unique Employee ID auto-generation helper and resolved legacy duplicate ID conflicts." },
                    { date: "2026-07-27", module: "Payroll & HR", submodule: "Reporting To Sync", changes: "Linked EmployeeProfile reporting lines with User accounts for org chart and reporting visibility." }
                ],
                deployedBy: "Super Admin",
                deployedAt: new Date("2026-07-27T21:00:00Z"),
                isActive: true
            }
        ];

        for (const update of updatesToSeed) {
            const doc = await SystemUpdate.findOneAndUpdate(
                { version: update.version },
                update,
                { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
            );
            console.log(`✅ Seeded SystemUpdate [${doc.version}]: ${doc.title}`);
        }

        console.log('🎉 All newly added system updates successfully seeded!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to seed new system updates:', err);
        process.exit(1);
    }
}

seedNewUpdates();
