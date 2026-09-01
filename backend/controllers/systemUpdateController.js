const SystemUpdate = require('../models/SystemUpdate');
const User = require('../models/User');

/**
 * Creates a new system update announcement.
 * Allows authorization via SYSTEM_UPDATE_API_KEY or if the user is a SUPER_ADMIN.
 */
exports.createUpdate = async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;
        const systemApiKey = process.env.SYSTEM_UPDATE_API_KEY;

        let authorized = false;
        let deployedBy = 'GitHub CI/CD';

        // 1. Check if valid API Key is provided
        if (systemApiKey && apiKey === systemApiKey) {
            authorized = true;
            if (req.body.deployedBy) {
                deployedBy = req.body.deployedBy;
            }
        } 
        // 2. Check if logged-in user is a SUPER_ADMIN
        else if (req.user && (req.user.role === 'SUPER_ADMIN' || req.user.role === 'superadmin')) {
            authorized = true;
            deployedBy = req.user.name || req.user.email;
        }

        if (!authorized) {
            return res.status(401).json({ message: 'Unauthorized. Invalid API key or insufficient privileges.' });
        }

        const { version, title, message, releaseNotes } = req.body;

        if (!version || !title || !message) {
            return res.status(400).json({ message: 'Version, title, and message are required.' });
        }

        // Parse releaseNotes if it comes as a string (e.g. newline or comma separated)
        let parsedNotes = [];
        if (Array.isArray(releaseNotes)) {
            parsedNotes = releaseNotes;
        } else if (typeof releaseNotes === 'string') {
            parsedNotes = releaseNotes
                .split(/[\n,]/)
                .map(note => note.trim())
                .filter(note => note.length > 0);
        }

        // Clean up version name (e.g. remove v prefix if present or keep it uniform)
        let formattedVersion = version.trim();
        if (!formattedVersion.startsWith('v') && !formattedVersion.startsWith('V')) {
            formattedVersion = `v${formattedVersion}`;
        }

        // If version already exists, update it instead of crashing, or return error.
        // Let's overwrite or update to make it idempotent (great for CI/CD reruns!)
        let systemUpdate = await SystemUpdate.findOne({ version: formattedVersion });
        
        if (systemUpdate) {
            systemUpdate.title = title;
            systemUpdate.message = message;
            systemUpdate.releaseNotes = parsedNotes;
            systemUpdate.deployedBy = deployedBy;
            if (req.body.deployedAt) {
                systemUpdate.deployedAt = new Date(req.body.deployedAt);
            } else {
                systemUpdate.deployedAt = Date.now();
            }
            await systemUpdate.save();
        } else {
            systemUpdate = new SystemUpdate({
                version: formattedVersion,
                title,
                message,
                releaseNotes: parsedNotes,
                deployedBy,
                deployedAt: req.body.deployedAt ? new Date(req.body.deployedAt) : Date.now()
            });
            await systemUpdate.save();
        }

        res.status(201).json({
            message: 'System update announcement published successfully',
            data: systemUpdate
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Returns all active system updates, sorted by deployment date descending.
 */
exports.getAllUpdates = async (req, res) => {
    try {
        // Ensure v6.0.0 exists in DB
        let v600 = await SystemUpdate.findOne({ version: 'v6.0.0' });
        if (!v600) {
            v600 = new SystemUpdate({
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
            });
            await v600.save();
        }

        let updates = await SystemUpdate.find({ isActive: true })
            .sort({ deployedAt: -1 })
            .lean();
        
        if (!updates || updates.length === 0 || !updates.some(u => u.version === 'v2.5.0')) {
            // Seed / update v2.5.0 update record with granular changes matching GitHub commit 569278f
            let v250 = await SystemUpdate.findOne({ version: 'v2.5.0' });
            if (!v250) {
                v250 = new SystemUpdate({
                    version: 'v2.5.0',
                    title: 'State Master Dependent City Flow & Employee Family Aadhaar Accordion',
                    message: 'GitHub Commit 569278f (Ghotkoper): Rearranged State Master fields with dependent City dropdown & auto-fill logic. Added Aadhaar field & collapsible accordion panel to Employee Master Family Info.',
                    releaseNotes: [
                        'State Master field order reordered to Country -> Dial Code -> State -> Short Code -> GST Code -> City Name',
                        'State-wise dependent City dropdown with auto-reset on State change and disabled state before State selection',
                        'Auto-fill for Country Dial Code, State Short Code (MH, GJ, CA, etc.) and GST Code (27, 24, etc.)',
                        'Added Aadhaar Number field in Employee Master Family Information with numeric-only and 12-digit validation',
                        'Converted Family Information into a collapsible/expandable accordion panel with per-member independent toggle'
                    ],
                    detailedChanges: [
                        { date: '01.08.2026', module: 'State Master', submodule: 'Field Sequence & Layout', changes: 'Rearranged field order to Country -> Country Dial Code -> State / UT -> Short Code -> GST Code -> City Name with balanced 2-column grid layout.' },
                        { date: '01.08.2026', module: 'State Master', submodule: 'Dependent City Dropdown', changes: 'Implemented state-wise dependent City dropdown with auto-reset on State change and disabled state validation.' },
                        { date: '01.08.2026', module: 'State Master', submodule: 'Auto-Fill Logic', changes: 'Added auto-fill for Country Dial Code (+91, +1, etc.), State Short Code (MH, GJ, etc.) and GST Code (27, 24, etc.).' },
                        { date: '01.08.2026', module: 'Employee Master', submodule: 'Family Information', changes: 'Added Aadhaar Number field in Family Information with numeric-only input and 12-digit validation.' },
                        { date: '01.08.2026', module: 'Employee Master', submodule: 'Accordion Panel', changes: 'Converted Family Information section into a collapsible/expandable accordion panel with independent per-entry toggle.' },
                        { date: '01.08.2026', module: 'Employee Master', submodule: 'Backend Schema', changes: 'Updated Mongoose FamilyMemberSchema in EmployeeProfile model to persist family member Aadhaar numbers.' }
                    ],
                    deployedBy: 'GitHub main (569278f)'
                });
                await v250.save();
            }
            updates = await SystemUpdate.find({ isActive: true }).sort({ deployedAt: -1 }).lean();
        }
        res.json(updates);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Returns the most recent system update.
 */
exports.getLatestUpdate = async (req, res) => {
    try {
        const latest = await SystemUpdate.findOne({ isActive: true })
            .sort({ deployedAt: -1 })
            .lean();
            
        if (!latest) {
            return res.json(null);
        }
        res.json(latest);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
