const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const SystemUpdate = require('../models/SystemUpdate');

async function run() {
    try {
        console.log("Connecting to MongoDB database...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully!");

        const newUpdate = {
            version: 'v6.0.0',
            title: 'Select Branch Blank Screen Fix, Dynamic Light/Dark Mode Teal Theme, Multi-Branch Employee Assignment & CSM Scoping',
            message: 'Release Updates (31 Aug 2026): Fixed blank screen issue on /select-branch route by embedding inside ProtectedRoute parent route layout. Redesigned SelectBranch page with dynamic light theme defaults and dark mode compatibility featuring a rich Teal & Emerald palette. Resolved multi-branch employee assignment persistence across backend controllers and frontend toggles. Enforced branch-scoped ticket analytics in CSM Dashboard.',
            releaseNotes: [
                'Branch Selection Routing: Resolved blank screen error on /select-branch route by properly embedding component within ProtectedRoute nested route hierarchy',
                'Select Branch Theme: Updated SelectBranch UI to light mode default with dark mode toggle support using rich Teal & Emerald visual accents',
                'Multi-Branch Assignment: Fixed assignedBranches array persistence in employee controllers and resolved frontend toggle state sync in Payroll & Employee Profile',
                'CSM Data Scoping: Integrated buildAccessScopeQuery in CSM Dashboard & Ticket Controllers for strict multi-tenant branch isolation',
                'Product HSN Persistence: Synchronized hsnCode field persistence between Product Master frontend and productController'
            ],
            detailedChanges: [
                {
                    date: '31.08.2026',
                    module: 'Authentication',
                    submodule: 'Select Active Branch Page',
                    changes: 'Fixed blank screen routing on /select-branch by properly embedding SelectBranch inside nested ProtectedRoute parent layout. Redesigned SelectBranch with dynamic light mode defaults and dark styling (dark: classes) using a rich Teal & Emerald palette. Added string ID vs object payload branch normalization for multi-branch assignment sessions.'
                },
                {
                    date: '31.08.2026',
                    module: 'Employee Master',
                    submodule: 'Multi-Branch Assignment Toggle',
                    changes: 'Fixed frontend/backend assignedBranches multi-selection toggle in EmployeeProfile and PayrollEmployees. Refactored authController and employeeController to guarantee array-based branch assignment persistence and multi-tenant context consistency.'
                },
                {
                    date: '31.08.2026',
                    module: 'CSM Support',
                    submodule: 'Branch-Scoped Ticket Analytics',
                    changes: 'Integrated buildAccessScopeQuery into CSM controllers (csmDashboardController, ticketController) enforcing strict user-to-branch data isolation, engineer ticket assignment scoping, and status tracking.'
                },
                {
                    date: '31.08.2026',
                    module: 'Master Management',
                    submodule: 'Product HSN Synchronization',
                    changes: 'Fixed data persistence gap between Products.jsx and productController.js to ensure hsnCode is reliably stored and rendered across Product Master table and form views.'
                }
            ],
            deployedBy: 'Super Admin',
            deployedAt: new Date()
        };

        let existing = await SystemUpdate.findOne({ version: 'v6.0.0' });
        if (existing) {
            Object.assign(existing, newUpdate);
            await existing.save();
            console.log("Updated existing v6.0.0 system update document in MongoDB!");
        } else {
            const doc = new SystemUpdate(newUpdate);
            await doc.save();
            console.log("Created new v6.0.0 system update document in MongoDB!");
        }

        process.exit(0);
    } catch (e) {
        console.error("Error updating system updates:", e);
        process.exit(1);
    }
}

run();
