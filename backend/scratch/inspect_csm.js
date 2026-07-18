const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const ServiceVisit = require('../models/ServiceVisit');
const Ticket = require('../models/Ticket');
const Engineer = require('../models/Engineer');
const User = require('../models/User');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const visits = await ServiceVisit.find().lean();
        console.log(`Found ${visits.length} ServiceVisits:`);
        for (const v of visits) {
            console.log(`Visit: ${v.visitNo}, Status: ${v.status}, engineerId: ${v.engineerId}, ticketId: ${v.ticketId}`);
        }

        const engineers = await Engineer.find().lean();
        console.log(`Found ${engineers.length} Engineers:`);
        for (const e of engineers) {
            console.log(`Engineer: ${e._id} - ${e.name} (${e.email})`);
        }

        const users = await User.find().lean();
        console.log(`Found ${users.length} Users:`);
        for (const u of users) {
            console.log(`User: ${u._id} - ${u.name} (${u.email})`);
        }

        const tickets = await Ticket.find().lean();
        console.log(`Found ${tickets.length} Tickets:`);
        for (const t of tickets) {
            console.log(`Ticket: ${t.ticketNo}, status: ${t.status}, assignedEngineerId: ${t.assignedEngineerId}`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
