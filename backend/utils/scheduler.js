const cron = require('node-cron');
const Enquiry = require('../models/Enquiry');
const Notification = require('../models/Notification');
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
        await checkFollowUps();
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
    checkFollowUps();

    fallbackTask = cron.schedule(FOLLOW_UP_CRON, () => {
        console.log('[Cron] Running scheduled follow-up check');
        checkFollowUps();
    });
};

exports.startScheduler = async () => {
    if (process.env.DISABLE_SCHEDULER === 'true' || schedulerStarted) return;
    schedulerStarted = true;

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
