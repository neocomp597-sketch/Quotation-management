const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const SystemUpdate = require('../models/SystemUpdate');

async function cleanNames() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tally-quotations');
        console.log('Connected to MongoDB.');

        const updates = await SystemUpdate.find({});
        let updatedCount = 0;

        for (const doc of updates) {
            let changed = false;

            if (doc.releaseNotes && Array.isArray(doc.releaseNotes)) {
                const cleanedNotes = doc.releaseNotes.map(note => {
                    const cleaned = note.replace(/\s*\(Rajshri\s*->\s*Rohit\s*->\s*Ashok\s*->\s*Hamza\)/gi, '');
                    if (cleaned !== note) changed = true;
                    return cleaned;
                });
                if (changed) doc.releaseNotes = cleanedNotes;
            }

            if (doc.message) {
                const cleanedMsg = doc.message.replace(/\s*\(Rajshri\s*->\s*Rohit\s*->\s*Ashok\s*->\s*Hamza\)/gi, '');
                if (cleanedMsg !== doc.message) {
                    doc.message = cleanedMsg;
                    changed = true;
                }
            }

            if (doc.title) {
                const cleanedTitle = doc.title.replace(/\s*\(Rajshri\s*->\s*Rohit\s*->\s*Ashok\s*->\s*Hamza\)/gi, '');
                if (cleanedTitle !== doc.title) {
                    doc.title = cleanedTitle;
                    changed = true;
                }
            }

            if (doc.detailedChanges && Array.isArray(doc.detailedChanges)) {
                doc.detailedChanges.forEach(item => {
                    if (item.changes) {
                        const cleaned = item.changes.replace(/\s*\(Rajshri\s*->\s*Rohit\s*->\s*Ashok\s*->\s*Hamza\)/gi, '');
                        if (cleaned !== item.changes) {
                            item.changes = cleaned;
                            changed = true;
                        }
                    }
                });
            }

            if (changed) {
                await doc.save();
                updatedCount++;
                console.log(`Updated SystemUpdate [${doc.version}]`);
            }
        }

        console.log(`Cleaned names in ${updatedCount} SystemUpdate records.`);
        process.exit(0);
    } catch (err) {
        console.error('Error cleaning system update names:', err);
        process.exit(1);
    }
}

cleanNames();
