const { Queue, QueueEvents, Worker } = require('bullmq');
const { getBullMqConnectionOptions, isRedisConfigured } = require('./redis');

const queues = new Map();
const queueEvents = new Map();
const workers = [];

const getQueuePrefix = () => process.env.BULLMQ_PREFIX || 'quotations';

const getDefaultJobOptions = () => ({
    attempts: Number(process.env.BULLMQ_JOB_ATTEMPTS || 3),
    backoff: {
        type: 'exponential',
        delay: Number(process.env.BULLMQ_BACKOFF_DELAY_MS || 5000),
    },
    removeOnComplete: Number(process.env.BULLMQ_REMOVE_ON_COMPLETE || 100),
    removeOnFail: Number(process.env.BULLMQ_REMOVE_ON_FAIL || 500),
});

const createQueueOptions = (options = {}) => {
    const connection = getBullMqConnectionOptions();
    if (!connection) return null;

    return {
        connection,
        prefix: getQueuePrefix(),
        defaultJobOptions: {
            ...getDefaultJobOptions(),
            ...(options.defaultJobOptions || {}),
        },
        ...options,
    };
};

const getQueue = (name, options = {}) => {
    if (!isRedisConfigured()) return null;
    if (queues.has(name)) return queues.get(name);

    const queueOptions = createQueueOptions(options);
    if (!queueOptions) return null;

    const queue = new Queue(name, queueOptions);
    queue.on('error', (error) => {
        console.error(`[BullMQ:${name}] queue error:`, error.message);
    });

    queues.set(name, queue);
    return queue;
};

const getQueueEvents = (name) => {
    if (!isRedisConfigured()) return null;
    if (queueEvents.has(name)) return queueEvents.get(name);

    const connection = getBullMqConnectionOptions();
    if (!connection) return null;

    const events = new QueueEvents(name, {
        connection,
        prefix: getQueuePrefix(),
    });
    events.on('failed', ({ jobId, failedReason }) => {
        console.error(`[BullMQ:${name}] job ${jobId} failed:`, failedReason);
    });
    events.on('error', (error) => {
        console.error(`[BullMQ:${name}] events error:`, error.message);
    });

    queueEvents.set(name, events);
    return events;
};

const createWorker = (name, processor, options = {}) => {
    if (!isRedisConfigured()) return null;

    const connection = getBullMqConnectionOptions();
    if (!connection) return null;

    const worker = new Worker(name, processor, {
        connection,
        prefix: getQueuePrefix(),
        concurrency: Number(process.env.BULLMQ_WORKER_CONCURRENCY || 1),
        ...options,
    });

    worker.on('completed', (job) => {
        console.log(`[BullMQ:${name}] completed job ${job.name} (${job.id})`);
    });
    worker.on('failed', (job, error) => {
        console.error(`[BullMQ:${name}] failed job ${job?.name || 'unknown'} (${job?.id || 'unknown'}):`, error.message);
    });

    // Rate-limit worker error logs to avoid flooding the console during Redis outages
    let lastWorkerErrorLog = 0;
    const WORKER_ERROR_LOG_INTERVAL_MS = 30000;
    worker.on('error', (error) => {
        const now = Date.now();
        if (now - lastWorkerErrorLog > WORKER_ERROR_LOG_INTERVAL_MS) {
            lastWorkerErrorLog = now;
            console.error(`[BullMQ:${name}] worker error:`, error.message);
        }
    });

    workers.push(worker);
    return worker;
};

const closeBullMq = async () => {
    await Promise.allSettled(workers.map((worker) => worker.close()));
    workers.length = 0;

    await Promise.allSettled([...queueEvents.values()].map((events) => events.close()));
    queueEvents.clear();

    await Promise.allSettled([...queues.values()].map((queue) => queue.close()));
    queues.clear();
};

module.exports = {
    closeBullMq,
    createWorker,
    getQueue,
    getQueueEvents,
};
