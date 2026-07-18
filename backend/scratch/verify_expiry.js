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
        await Quotation.deleteMany({ quotationNo: { $in: ['MOCK-EXP-001', 'MOCK-EXP-003'] } });
        await Notification.deleteMany({ title: 'Quotation Expired & Rejected' });
        await AuditLog.deleteMany({ action: 'AUTO_EXPIRED' });

        const thirtyOneDaysAgo = new Date();
        thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // 1. Create a mock quotation that is pending approval and older than 30 days
        const mockQuote1 = new Quotation({
            quotationNo: 'MOCK-EXP-001',
            quotationNumber: 'MOCK-EXP-001',
            companyId,
            customerName: 'Test Customer Corp 1',
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

        // 2. Create a mock quotation that is final and validity is in the past
        const mockQuote2 = new Quotation({
            quotationNo: 'MOCK-EXP-003',
            quotationNumber: 'MOCK-EXP-003',
            companyId,
            customerName: 'Test Customer Corp 3',
            quotationDate: new Date(),
            validTill: yesterday,
            status: 'final',
            createdBy: userId,
            items: [{
                quantity: 1,
                rate: 2000,
                taxableAmount: 2000,
                gstAmount: 360,
                lineTotal: 2360
            }],
            subtotal: 2000,
            totalDiscount: 0,
            grandTotal: 2360
        });

        await mockQuote1.save();
        await mockQuote2.save();
        console.log('Saved mock expired quotations (one pending_approval, one final).');

        // Run autoExpireQuotations scheduler function
        console.log('Running autoExpireQuotations...');
        await autoExpireQuotations();

        // 3. Verify MOCK-EXP-001 transitioned to 'rejected'
        const updatedQuote1 = await Quotation.findOne({ quotationNo: 'MOCK-EXP-001' });
        if (!updatedQuote1) {
            throw new Error('Mock quotation MOCK-EXP-001 was deleted or not found!');
        }
        console.log(`MOCK-EXP-001 updated status: ${updatedQuote1.status}`);
        if (updatedQuote1.status !== 'rejected') {
            throw new Error(`Expected MOCK-EXP-001 status to be 'rejected', but got '${updatedQuote1.status}'`);
        }

        // Verify MOCK-EXP-003 transitioned to 'rejected'
        const updatedQuote2 = await Quotation.findOne({ quotationNo: 'MOCK-EXP-003' });
        if (!updatedQuote2) {
            throw new Error('Mock quotation MOCK-EXP-003 was deleted or not found!');
        }
        console.log(`MOCK-EXP-003 updated status: ${updatedQuote2.status}`);
        if (updatedQuote2.status !== 'rejected') {
            throw new Error(`Expected MOCK-EXP-003 status to be 'rejected', but got '${updatedQuote2.status}'`);
        }
        console.log('SUCCESS: Both quotations status updated to rejected.');

        // 4. Verify Notifications were created
        const notifications1 = await Notification.find({ relatedId: updatedQuote1._id });
        console.log(`Found ${notifications1.length} notifications for MOCK-EXP-001.`);
        if (notifications1.length === 0) {
            throw new Error('Expected notifications to be created for MOCK-EXP-001, but found none.');
        }

        const notifications2 = await Notification.find({ relatedId: updatedQuote2._id });
        console.log(`Found ${notifications2.length} notifications for MOCK-EXP-003.`);
        if (notifications2.length === 0) {
            throw new Error('Expected notifications to be created for MOCK-EXP-003, but found none.');
        }
        console.log('SUCCESS: Notifications created successfully.');

        // 5. Verify AuditLogs were written with correct reasons
        const logs1 = await AuditLog.find({ entityId: updatedQuote1._id });
        if (logs1.length === 0) {
            throw new Error('Expected audit log entry for MOCK-EXP-001, but found none.');
        }
        console.log(`MOCK-EXP-001 log action: ${logs1[0].action}, reason: ${logs1[0].reason}`);
        if (logs1[0].reason !== 'Quotation validity period expired (30 days reached without approval)') {
            throw new Error(`Unexpected audit log reason for MOCK-EXP-001: ${logs1[0].reason}`);
        }

        const logs2 = await AuditLog.find({ entityId: updatedQuote2._id });
        if (logs2.length === 0) {
            throw new Error('Expected audit log entry for MOCK-EXP-003, but found none.');
        }
        console.log(`MOCK-EXP-003 log action: ${logs2[0].action}, reason: ${logs2[0].reason}`);
        if (logs2[0].reason !== 'Quotation validity period expired') {
            throw new Error(`Unexpected audit log reason for MOCK-EXP-003: ${logs2[0].reason}`);
        }
        console.log('SUCCESS: Audit logs created successfully.');

        // Clean up test data
        await Quotation.deleteMany({ _id: { $in: [updatedQuote1._id, updatedQuote2._id] } });
        await Notification.deleteMany({ relatedId: { $in: [updatedQuote1._id, updatedQuote2._id] } });
        await AuditLog.deleteMany({ entityId: { $in: [updatedQuote1._id, updatedQuote2._id] } });
        console.log('Cleaned up test data.');

        console.log('All tests passed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Test verification failed:', error);
        process.exit(1);
    }
}

run();
