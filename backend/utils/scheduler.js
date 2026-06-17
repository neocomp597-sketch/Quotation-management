const cron = require('node-cron');
const Enquiry = require('../models/Enquiry');
const Notification = require('../models/Notification');
const Meeting = require('../models/Meeting');
const { closeBullMq, createWorker, getQueue, getQueueEvents } = require('../config/bullmq');

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
                        dueDate: followUpDate,
                        companyId: enquiry.companyId
                    });
                    console.log(`[Scheduler] Generated ${type} notification for ${enquiry.enquiryNo}`);
                }
            }
        }
    } catch (err) {
        console.error('[Scheduler Error]', err);
    }
};

const checkMeetingReminders = async () => {
    try {
        console.log('[Scheduler] Checking for meeting reminders...');
        const now = new Date();
        const oneDayLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const thirtyMinLimit = new Date(now.getTime() + 30 * 60 * 1000);

        // 1-day reminders
        const meetingsForOneDay = await Meeting.find({
            isDeleted: { $ne: true },
            status: { $in: ['Scheduled', 'Confirmed', 'In Progress'] },
            startDateTime: { $gte: now, $lte: oneDayLimit },
            'remindersSent.oneDay': false
        });

        for (const meeting of meetingsForOneDay) {
            meeting.remindersSent.oneDay = true;
            await meeting.save();
            const notifyUserIds = Array.from(new Set([meeting.organizerId, ...meeting.participants].map(id => id.toString())));
            for (const userId of notifyUserIds) {
                await Notification.create({
                    userId,
                    title: 'Meeting Reminder (1 Day)',
                    message: `Reminder: Meeting "${meeting.title}" starts in less than 24 hours (on ${new Date(meeting.startDateTime).toLocaleString()}).`,
                    type: 'MEETING_REMINDER_1_DAY',
                    dueDate: meeting.startDateTime,
                    companyId: meeting.companyId
                });
            }
            console.log(`[Scheduler] Sent 1-day reminder for meeting: ${meeting.title}`);
        }

        // 30-min reminders
        const meetingsForThirtyMin = await Meeting.find({
            isDeleted: { $ne: true },
            status: { $in: ['Scheduled', 'Confirmed', 'In Progress'] },
            startDateTime: { $gte: now, $lte: thirtyMinLimit },
            'remindersSent.thirtyMin': false
        });

        for (const meeting of meetingsForThirtyMin) {
            meeting.remindersSent.thirtyMin = true;
            await meeting.save();
            const notifyUserIds = Array.from(new Set([meeting.organizerId, ...meeting.participants].map(id => id.toString())));
            for (const userId of notifyUserIds) {
                await Notification.create({
                    userId,
                    title: 'Meeting Reminder (30 Mins)',
                    message: `Reminder: Meeting "${meeting.title}" starts in less than 30 minutes!`,
                    type: 'MEETING_REMINDER_30_MIN',
                    dueDate: meeting.startDateTime,
                    companyId: meeting.companyId
                });
            }
            console.log(`[Scheduler] Sent 30-min reminder for meeting: ${meeting.title}`);
        }
    } catch (err) {
        console.error('[Scheduler Meeting Reminders Error]', err);
    }
};

const autoCompleteMeetings = async () => {
    try {
        console.log('[Scheduler] Checking for meetings to auto-complete...');
        const now = new Date();
        const pastMeetings = await Meeting.find({
            isDeleted: { $ne: true },
            status: { $in: ['Scheduled', 'Confirmed', 'In Progress'] },
            endDateTime: { $lt: now }
        });

        for (const meeting of pastMeetings) {
            meeting.status = 'Completed';
            meeting.statusHistory.push({
                status: 'Completed',
                changedBy: meeting.organizerId,
                changedAt: now
            });
            await meeting.save();
            console.log(`[Scheduler] Automatically completed past meeting: ${meeting.title}`);
        }
    } catch (err) {
        console.error('[Scheduler Meeting Auto-Complete Error]', err);
    }
};

const runScheduledTasks = async () => {
    await checkFollowUps();
    await checkMeetingReminders();
    await autoCompleteMeetings();
};

const FOLLOW_UP_QUEUE = 'follow-up-notifications';
const FOLLOW_UP_JOB = 'check-follow-ups';
const FOLLOW_UP_CRON = process.env.FOLLOW_UP_CRON || '*/15 * * * *';
const BULLMQ_STARTUP_TIMEOUT_MS = Number(process.env.BULLMQ_STARTUP_TIMEOUT_MS || 5000);

let fallbackTask;
let schedulerStarted = false;

const enqueueFollowUpCheck = async (queue, trigger) => {
    await queue.add(
        FOLLOW_UP_JOB,
        { trigger, queuedAt: new Date().toISOString() },
        {
            jobId: trigger === 'repeat' ? 'follow-ups:repeat' : undefined,
            repeat: trigger === 'repeat' ? { pattern: FOLLOW_UP_CRON } : undefined,
        },
    );
};

const startBullMqScheduler = async () => {
    const queue = getQueue(FOLLOW_UP_QUEUE);
    if (!queue) return false;

    const worker = createWorker(FOLLOW_UP_QUEUE, async (job) => {
        if (job.name !== FOLLOW_UP_JOB) {
            throw new Error(`Unsupported scheduler job: ${job.name}`);
        }
        await runScheduledTasks();
    });
    const events = getQueueEvents(FOLLOW_UP_QUEUE);

    await Promise.race([
        Promise.all([
            queue.waitUntilReady(),
            worker.waitUntilReady(),
            events ? events.waitUntilReady() : Promise.resolve(),
        ]),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('BullMQ startup timed out')), BULLMQ_STARTUP_TIMEOUT_MS);
        }),
    ]);

    await enqueueFollowUpCheck(queue, 'startup');
    await enqueueFollowUpCheck(queue, 'repeat');
    console.log(`[Scheduler] BullMQ follow-up queue ready (${FOLLOW_UP_CRON})`);
    return true;
};

const startFallbackScheduler = () => {
    console.warn('[Scheduler] BullMQ unavailable; using in-process cron fallback.');
    runScheduledTasks();

    fallbackTask = cron.schedule(FOLLOW_UP_CRON, () => {
        console.log('[Cron] Running scheduled follow-up check');
        runScheduledTasks();
    });
};

exports.startScheduler = async (options = {}) => {
    if (process.env.DISABLE_SCHEDULER === 'true' || schedulerStarted) return;
    schedulerStarted = true;

    if (options.preferFallback) {
        startFallbackScheduler();
        return;
    }

    try {
        const bullMqStarted = await startBullMqScheduler();
        if (bullMqStarted) return;
    } catch (error) {
        console.error('[Scheduler] Failed to start BullMQ scheduler:', error.message);
        await closeBullMq();
    }

    startFallbackScheduler();
};

exports.stopScheduler = () => {
    if (fallbackTask) {
        fallbackTask.stop();
        fallbackTask = null;
    }
    schedulerStarted = false;
};

exports.checkFollowUps = checkFollowUps;
exports.checkMeetingReminders = checkMeetingReminders;
exports.autoCompleteMeetings = autoCompleteMeetings;
exports.runScheduledTasks = runScheduledTasks;
