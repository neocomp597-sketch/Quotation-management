const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Enquiry = require('../models/Enquiry');
const User = require('../models/User');
const Customer = require('../models/Customer');

async function inspect() {
    try {
        console.log('Connecting to MONGO_URI...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        // Let's try to query all Enquiries without bypass tenant first, wait, no, bypassTenant is not an option by default in mongoose unless passed.
        // Let's check with bypassTenant: true in find options, or just standard find.
        console.log('Querying all enquiries...');
        const enquiries = await Enquiry.find({}, null, { bypassTenant: true }).lean();
        console.log(`Found ${enquiries.length} enquiries in DB.`);

        for (const enq of enquiries) {
            console.log(`Enquiry Details:`, {
                id: enq._id,
                enquiryNo: enq.enquiryNo,
                companyId: enq.companyId,
                customerId: enq.customerId,
                status: enq.status,
                lossReason: enq.lossReason,
                itemsCount: enq.items ? enq.items.length : 0
            });
        }
    } catch (err) {
        console.error('Error during inspection:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

inspect();
