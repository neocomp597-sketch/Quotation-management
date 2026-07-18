const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Quotation = require('../models/Quotation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { autoExpireQuotations } = require('../utils/scheduler');

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        // Find an existing user to get a valid companyId and createdBy ID
        const testUser = await User.findOne({}).lean();
        if (!testUser) {
            console.error('No users found in database to run tests against.');
            process.exit(1);
        }
        const companyId = testUser.companyId;
        const userId = testUser._id;
        console.log(`Using companyId: ${companyId}, userId: ${userId} for testing.`);

        // Clean up any leftover test data
        await Quotation.deleteMany({ quotationNo: 'MOCK-EXP-002' });
        await Notification.deleteMany({ title: 'Quotation Status Set to Pending' });
        await AuditLog.deleteMany({ action: 'AUTO_PENDING' });

        // 1. Create a mock quotation that is draft and older than 15 days
        const sixteenDaysAgo = new Date();
        sixteenDaysAgo.setDate(sixteenDaysAgo.getDate() - 16);

        const mockQuote = new Quotation({
            quotationNo: 'MOCK-EXP-002',
            quotationNumber: 'MOCK-EXP-002',
            companyId,
            customerName: 'Test Customer Corp 2',
            quotationDate: sixteenDaysAgo,
            validTill: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days in the future
            status: 'draft',
            createdBy: userId,
            createdAt: sixteenDaysAgo, // set createdAt to 16 days ago
            items: [{
                quantity: 1,
                rate: 500,
                taxableAmount: 500,
                gstAmount: 90,
                lineTotal: 590
            }],
            subtotal: 500,
            totalDiscount: 0,
            grandTotal: 590
        });

        await mockQuote.save();
        console.log('Saved mock draft quotation.');

        // 2. Run scheduler autoExpireQuotations function (which now handles 15-day auto-pending)
        console.log('Running autoExpireQuotations...');
        await autoExpireQuotations();

        // 3. Verify status transitioned to 'pending_approval'
        const updatedQuote = await Quotation.findOne({ quotationNo: 'MOCK-EXP-002' });
        if (!updatedQuote) {
            throw new Error('Mock quotation was deleted or not found!');
        }
        console.log(`Updated quotation status: ${updatedQuote.status}`);
        if (updatedQuote.status !== 'pending_approval') {
            throw new Error(`Expected status to be 'pending_approval', but got '${updatedQuote.status}'`);
        }
        console.log('SUCCESS: Quotation status updated to pending_approval.');

        // 4. Verify Notification was created
        const notifications = await Notification.find({ relatedId: updatedQuote._id });
        console.log(`Found ${notifications.length} notifications generated.`);
        if (notifications.length === 0) {
            throw new Error('Expected notifications to be created, but found none.');
        }
        console.log(`Notification title: ${notifications[0].title}`);
        if (notifications[0].title !== 'Quotation Status Set to Pending') {
            throw new Error(`Expected title 'Quotation Status Set to Pending', but got '${notifications[0].title}'`);
        }
        console.log('SUCCESS: Notifications created successfully.');

        // 5. Verify AuditLog was written
        const logs = await AuditLog.find({ entityId: updatedQuote._id });
        console.log(`Found ${logs.length} audit logs generated.`);
        if (logs.length === 0) {
            throw new Error('Expected audit log entry to be created, but found none.');
        }
        console.log(`Audit log action: ${logs[0].action}, reason: ${logs[0].reason}`);
        if (logs[0].action !== 'AUTO_PENDING') {
            throw new Error(`Expected log action to be 'AUTO_PENDING', but got '${logs[0].action}'`);
        }
        console.log('SUCCESS: Audit log created successfully.');

        // Clean up test data
        await Quotation.deleteOne({ _id: updatedQuote._id });
        await Notification.deleteMany({ relatedId: updatedQuote._id });
        await AuditLog.deleteMany({ entityId: updatedQuote._id });
        console.log('Cleaned up test data.');

        console.log('All 15-day auto-pending tests passed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Test verification failed:', error);
        process.exit(1);
    }
}

run();
