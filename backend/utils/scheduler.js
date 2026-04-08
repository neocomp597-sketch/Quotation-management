const cron = require('node-cron');
const Enquiry = require('../models/Enquiry');
const Notification = require('../models/Notification');

const checkFollowUps = async () => {
    try {
        console.log('[Scheduler] Checking for due follow-ups...');
        
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Find active enquiries that have a follow-up date
        const activeEnquiries = await Enquiry.find({
            status: { $nin: ['Lost', 'PO Received', 'Finalized', 'Won'] },
            followUpDate: { $ne: null }
        });

        for (const enquiry of activeEnquiries) {
            const followUpDate = new Date(enquiry.followUpDate);
            let type = null;
            let message = '';

            if (followUpDate < todayStart) {
                type = 'Overdue';
                message = `Follow-up for Enquiry ${enquiry.enquiryNo} is overdue! Was due on ${followUpDate.toLocaleDateString()}`;
            } else if (followUpDate >= todayStart && followUpDate <= todayEnd) {
                type = 'Reminder';
                message = `Follow-up for Enquiry ${enquiry.enquiryNo} is today!`;
            }

            if (type && enquiry.createdBy) {
                // Check if a notification already exists for this enquiry and date to avoid duplicates
                const existingNotif = await Notification.findOne({
                    userId: enquiry.createdBy,
                    relatedId: enquiry._id,
                    type: type,
                    // Check if it was created recently (within last 24 hrs)
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                });

                if (!existingNotif) {
                    await Notification.create({
                        userId: enquiry.createdBy,
                        title: `Follow-up ${type}`,
                        message: message,
                        type: type,
                        relatedId: enquiry._id,
                        dueDate: followUpDate
                    });
                    console.log(`[Scheduler] Generated ${type} notification for ${enquiry.enquiryNo}`);
                }
            }
        }
    } catch (err) {
        console.error('[Scheduler Error]', err);
    }
};

// Run every hour to check for due follow-ups. In real-world, maybe '0 9 * * *' (9 AM daily)
// The user asked for "proper working cron".
exports.startScheduler = () => {
    // Run immediately on boot for development checking
    checkFollowUps();
    
    // Schedule proper cron script. We can run it every hour '0 * * * *'
    // or every minute '* * * * *' for testing/development if needed.
    // Let's set it to every 15 minutes to be responsive but not overly aggressive
    cron.schedule('*/15 * * * *', () => {
        console.log('[Cron] Running scheduled follow-up check');
        checkFollowUps();
    });
};
