const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const Ticket = require('../models/Ticket');

async function test() {
    try {
        await connectDB();
        const tickets = await Ticket.find({}).sort({ createdAt: -1 }).limit(10).lean();
        console.log('--- LATEST TICKETS ---');
        tickets.forEach(t => {
            console.log(`TicketNo: ${t.ticketNo}, isManual: ${t.isManual}, manualInvoiceNo: "${t.manualInvoiceNo}", manualProductName: "${t.manualProductName}", created: ${t.createdAt}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}
test();
