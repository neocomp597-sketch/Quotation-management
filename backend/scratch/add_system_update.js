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
                {
                    date: '01.08.2026',
                    module: 'State Master',
                    submodule: 'Field Sequence & Layout',
                    changes: 'Rearranged field order to Country -> Country Dial Code -> State / UT -> Short Code -> GST Code -> City Name with balanced 2-column grid layout.'
                },
                {
                    date: '01.08.2026',
                    module: 'State Master',
                    submodule: 'Dependent City Dropdown',
                    changes: 'Implemented state-wise dependent City dropdown with auto-reset on State change and disabled state validation.'
                },
                {
                    date: '01.08.2026',
                    module: 'State Master',
                    submodule: 'Auto-Fill Logic',
                    changes: 'Added auto-fill for Country Dial Code (+91, +1, etc.), State Short Code (MH, GJ, etc.) and GST Code (27, 24, etc.).'
                },
                {
                    date: '01.08.2026',
                    module: 'Employee Master',
                    submodule: 'Family Information',
                    changes: 'Added Aadhaar Number field in Family Information with numeric-only input and 12-digit validation.'
                },
                {
                    date: '01.08.2026',
                    module: 'Employee Master',
                    submodule: 'Accordion Panel',
                    changes: 'Converted Family Information section into a collapsible/expandable accordion panel with independent per-entry toggle.'
                },
                {
                    date: '01.08.2026',
                    module: 'Employee Master',
                    submodule: 'Backend Schema',
                    changes: 'Updated Mongoose FamilyMemberSchema in EmployeeProfile model to persist family member Aadhaar numbers.'
                }
            ],
            deployedBy: 'GitHub main (569278f)',
            deployedAt: new Date()
        };

        let existing = await SystemUpdate.findOne({ version: 'v2.5.0' });
        if (existing) {
            Object.assign(existing, newUpdate);
            await existing.save();
            console.log("Updated existing v2.5.0 system update document in MongoDB!");
        } else {
            const doc = new SystemUpdate(newUpdate);
            await doc.save();
            console.log("Created new v2.5.0 system update document in MongoDB!");
        }

        process.exit(0);
    } catch (e) {
        console.error("Error updating system updates:", e);
        process.exit(1);
    }
}

run();
