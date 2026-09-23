/**
 * Deletes every support ticket (and its service visits) for one company.
 * Used to clear the Support Tickets Register before a demo.
 *
 * Usage:   node scripts/cleanupDemoTickets.js            (dry run - only reports)
 *          node scripts/cleanupDemoTickets.js --confirm  (actually deletes)
 *
 * A JSON backup is always written next to this script before anything is removed.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const COMPANY_ID = process.env.DEMO_COMPANY_ID || '6a8bf304ac99b5d51a116954'; // Stelmec
const CONFIRM = process.argv.includes('--confirm');
const BACKUP_DIR = path.join(__dirname, 'backups');

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const Ticket = require('../models/Ticket');
    const ServiceVisit = require('../models/ServiceVisit');
    const opts = { bypassTenant: true };

    const tickets = await Ticket.find({ companyId: COMPANY_ID }).setOptions(opts).lean();
    const ticketIds = tickets.map(t => t._id);
    const visits = await ServiceVisit.find({ ticketId: { $in: ticketIds } }).setOptions(opts).lean();

    console.log(`company ${COMPANY_ID}`);
    console.log(`  tickets: ${tickets.length}${tickets.length ? ' -> ' + tickets.map(t => t.ticketNo).join(', ') : ''}`);
    console.log(`  service visits: ${visits.length}`);

    const otherCompanies = await Ticket.countDocuments({ companyId: { $ne: COMPANY_ID } }).setOptions(opts);
    console.log(`  tickets belonging to OTHER companies (will not be touched): ${otherCompanies}`);

    if (!tickets.length) {
        console.log('\nNothing to delete.');
        process.exit(0);
    }

    if (!CONFIRM) {
        console.log('\nDry run. Re-run with --confirm to delete.');
        process.exit(0);
    }

    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const file = path.join(BACKUP_DIR, `tickets-${COMPANY_ID}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ tickets, visits }, null, 1));
    console.log(`\nbackup written: ${file}`);

    const visitResult = await ServiceVisit.deleteMany({ ticketId: { $in: ticketIds } }).setOptions(opts);
    const ticketResult = await Ticket.deleteMany({ companyId: COMPANY_ID }).setOptions(opts);
    console.log(`deleted -> tickets: ${ticketResult.deletedCount} | service visits: ${visitResult.deletedCount}`);

    console.log(`remaining for this company: ${await Ticket.countDocuments({ companyId: COMPANY_ID }).setOptions(opts)}`);
    console.log(`remaining for other companies: ${await Ticket.countDocuments({ companyId: { $ne: COMPANY_ID } }).setOptions(opts)}`);
    process.exit(0);
})().catch(err => {
    console.error('failed:', err.message);
    process.exit(1);
});
