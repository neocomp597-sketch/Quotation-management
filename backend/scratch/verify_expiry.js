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
        await Quotation.deleteMany({ quotationNo: 'MOCK-EXP-001' });
        await Notification.deleteMany({ title: 'Quotation Expired & Rejected' });
        await AuditLog.deleteMany({ action: 'AUTO_EXPIRED' });

        // 1. Create a mock quotation that is pending approval and older than 30 days
        const thirtyOneDaysAgo = new Date();
        thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const mockQuote = new Quotation({
            quotationNo: 'MOCK-EXP-001',
            quotationNumber: 'MOCK-EXP-001',
            companyId,
            customerName: 'Test Customer Corp',
            quotationDate: thirtyOneDaysAgo,
            validTill: yesterday,
            status: 'pending_approval',
            createdBy: userId,
            items: [{
                quantity: 1,
                rate: 1000,
                taxableAmount: 1000,
                gstAmount: 180,
                lineTotal: 1180
            }],
            subtotal: 1000,
            totalDiscount: 0,
            grandTotal: 1180
        });

        // Set bypassTenant to bypass validation if required, but since we have companyId it should be fine
        await mockQuote.save();
        console.log('Saved mock expired quotation.');

        // 2. Run autoExpireQuotations scheduler function
        console.log('Running autoExpireQuotations...');
        await autoExpireQuotations();

        // 3. Verify status transitioned to 'rejected'
        const updatedQuote = await Quotation.findOne({ quotationNo: 'MOCK-EXP-001' });
        if (!updatedQuote) {
            throw new Error('Mock quotation was deleted or not found!');
        }
        console.log(`Updated quotation status: ${updatedQuote.status}`);
        if (updatedQuote.status !== 'rejected') {
            throw new Error(`Expected status to be 'rejected', but got '${updatedQuote.status}'`);
        }
        console.log('SUCCESS: Quotation status updated to rejected.');

        // 4. Verify Notification was created
        const notifications = await Notification.find({ relatedId: updatedQuote._id });
        console.log(`Found ${notifications.length} notifications generated.`);
        if (notifications.length === 0) {
            throw new Error('Expected notifications to be created for the company users, but found none.');
        }
        console.log('SUCCESS: Notifications created successfully.');

        // 5. Verify AuditLog was written
        const logs = await AuditLog.find({ entityId: updatedQuote._id });
        console.log(`Found ${logs.length} audit logs generated.`);
        if (logs.length === 0) {
            throw new Error('Expected audit log entry to be created, but found none.');
        }
        console.log(`Audit log action: ${logs[0].action}, reason: ${logs[0].reason}`);
        if (logs[0].action !== 'AUTO_EXPIRED') {
            throw new Error(`Expected log action to be 'AUTO_EXPIRED', but got '${logs[0].action}'`);
        }
        console.log('SUCCESS: Audit log created successfully.');

        // Clean up test data
        await Quotation.deleteOne({ _id: updatedQuote._id });
        await Notification.deleteMany({ relatedId: updatedQuote._id });
        await AuditLog.deleteMany({ entityId: updatedQuote._id });
        console.log('Cleaned up test data.');

        console.log('All tests passed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Test verification failed:', error);
        process.exit(1);
    }
}

run();
