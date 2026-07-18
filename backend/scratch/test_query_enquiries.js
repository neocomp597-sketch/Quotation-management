const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Enquiry = require('../models/Enquiry');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { runWithTenant } = require('../middlewares/tenantContext');

async function test() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        // Let's find some companyId to use or try with undefined
        const firstUser = await User.findOne({ companyId: { $ne: null } }).lean();
        const companyId = firstUser ? firstUser.companyId : null;
        console.log('Using companyId:', companyId);

        await runWithTenant(companyId, async () => {
            console.log('Running Enquiry.find()...');
            const enquiries = await Enquiry.find()
                .select('enquiryNo customerId status probability items createdBy lastActivityDate createdAt updatedAt')
                .populate('customerId', 'customerName companyName gstin')
                .populate('createdBy', 'name email')
                .populate('items.vendors', 'name')
                .populate('items.vendorQuotes.vendorId', 'name')
                .populate('items.finalVendor', 'name')
                .sort({ createdAt: -1 })
                .lean();
            console.log('Query successful, found enquiries:', enquiries.length);
        });

    } catch (err) {
        console.error('Error during Enquiry query:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

test();
