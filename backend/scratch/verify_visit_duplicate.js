const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ServiceVisit = require('../models/ServiceVisit');
const Ticket = require('../models/Ticket');
const Engineer = require('../models/Engineer');
const User = require('../models/User');

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        // Find a ticket and an engineer for testing
        const ticket = await Ticket.findOne({}).lean();
        const engineer = await Engineer.findOne({}).lean();
        const user = await User.findOne({}).lean();

        if (!ticket || !engineer || !user) {
            console.error('Missing test data (Ticket, Engineer or User).');
            process.exit(1);
        }

        const companyId = ticket.companyId;
        const ticketId = ticket._id;
        const engineerId = engineer._id;
        const userId = user._id;

        console.log(`Testing with Ticket: ${ticket.ticketNo}, Engineer: ${engineer.name}, Company: ${companyId}`);

        // Clean up previous test visits
        await ServiceVisit.deleteMany({ visitNo: { $regex: /^TST-/ } });
        const customerTickets = await Ticket.find({ customerId: ticket.customerId, companyId });
        await ServiceVisit.deleteMany({ ticketId: { $in: customerTickets.map(t => t._id) }, status: { $in: ['Scheduled', 'In Transit', 'Started'] } });

        // Import the controller mock context or trigger the controller directly
        const { createVisit, rescheduleVisit } = require('../controllers/serviceVisitController');

        let createdVisitId;

        // 1. Mock request to create first visit
        const req1 = {
            body: {
                ticketId,
                engineerId,
                scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // tomorrow
            },
            user: { companyId, id: userId }
        };

        const res1 = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                this.data = data;
                return this;
            }
        };

        console.log('Scheduling first service visit...');
        await createVisit(req1, res1);

        if (res1.statusCode && res1.statusCode !== 201) {
            throw new Error(`Failed to create first visit: ${JSON.stringify(res1.data)}`);
        }

        const firstVisit = res1.data;
        createdVisitId = firstVisit._id;
        console.log(`SUCCESS: Scheduled visit ${firstVisit.visitNo} with ID ${createdVisitId}`);

        // 2. Attempt to schedule a second service visit for the same ticket/customer
        const req2 = {
            body: {
                ticketId,
                engineerId,
                scheduledDate: new Date(Date.now() + 48 * 60 * 60 * 1000) // day after tomorrow
            },
            user: { companyId, id: userId }
        };

        const res2 = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                this.data = data;
                return this;
            }
        };

        console.log('Attempting to schedule second duplicate service visit...');
        await createVisit(req2, res2);

        console.log(`Status Code returned: ${res2.statusCode}`);
        console.log(`Response payload:`, res2.data);

        if (res2.statusCode !== 400) {
            throw new Error(`Expected status code 400 for duplicate schedule, but got ${res2.statusCode}`);
        }

        const expectedMessage = 'A service visit is already scheduled for this customer. Please use the Reschedule option instead of creating a new service visit.';
        if (res2.data.message !== expectedMessage) {
            throw new Error(`Expected message "${expectedMessage}", but got "${res2.data.message}"`);
        }

        console.log('SUCCESS: Duplicate scheduling was blocked with correct error message.');

        // 3. Attempt to reschedule the created visit
        const newDate = new Date(Date.now() + 72 * 60 * 60 * 1000); // 3 days from now
        const req3 = {
            params: { id: createdVisitId },
            body: {
                scheduledDate: newDate,
                engineerId
            },
            user: { companyId, id: userId }
        };

        const res3 = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                this.data = data;
                return this;
            }
        };

        console.log('Attempting to reschedule the active service visit...');
        await rescheduleVisit(req3, res3);

        const updatedVisit = res3.data;
        console.log('Rescheduled visit response:', updatedVisit);

        if (new Date(updatedVisit.scheduledDate).getTime() !== newDate.getTime()) {
            throw new Error(`Expected scheduledDate to be ${newDate}, but got ${updatedVisit.scheduledDate}`);
        }

        console.log('SUCCESS: Service visit rescheduled successfully.');

        // Clean up test data
        await ServiceVisit.deleteOne({ _id: createdVisitId });
        console.log('Cleaned up test data.');

        console.log('All Service Visit duplicate check & reschedule tests passed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Test verification failed:', error);
        process.exit(1);
    }
}

run();
