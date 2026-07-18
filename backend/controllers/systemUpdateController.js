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
        let updates = await SystemUpdate.find({ isActive: true })
            .sort({ deployedAt: -1 })
            .lean();
        
        if (!updates || updates.length === 0 || !updates.some(u => u.detailedChanges && u.detailedChanges.length > 0)) {
            // Seed a initial update record with granular changes matching user mockup
            const defaultUpdate = new SystemUpdate({
                version: 'v2.4.0',
                title: 'Daily CRM Enhancements & Reports Update',
                message: 'Latest daily module and submodule improvements across CRM.',
                releaseNotes: [
                    'Updated sales target alignment under Reports',
                    'Added new custom report creation in Reports module',
                    'Redesigned reports dashboard layout for enhanced visibility'
                ],
                detailedChanges: [
                    { date: '17.07.2026', module: 'Reports', submodule: 'Sales target', changes: 'Alignment modified' },
                    { date: '18.07.2026', module: 'Reports', submodule: 'added new report', changes: 'Added new report' },
                    { date: '19.07.2026', module: 'Reports', submodule: 'design', changes: 'redesign' },
                    { date: '19.07.2026', module: 'Dashboard', submodule: 'Theme Management', changes: 'Added dark/light mode toggle' },
                    { date: '19.07.2026', module: 'Dashboard', submodule: 'Global Search', changes: 'Enquiry submodule hierarchy search' },
                    { date: '19.07.2026', module: 'CRM Core', submodule: 'Real-Time Synchronization', changes: 'Socket.io live data synchronization' }
                ],
                deployedBy: 'System Admin'
            });
            await defaultUpdate.save();
            updates = [defaultUpdate.toObject()];
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
