const { createWorker, getQueue } = require('../config/bullmq');
const { invalidateCache } = require('../utils/cacheInvalidation');

const QUEUE_NAME = 'cache-invalidation';
const JOB_INVALIDATE = 'invalidate-cache';
const STARTUP_TIMEOUT_MS = Number(process.env.BULLMQ_STARTUP_TIMEOUT_MS || 5000);

let started = false;

const getCacheInvalidationQueue = () => getQueue(QUEUE_NAME, {
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
    },
});

const enqueueCacheInvalidation = async (...patterns) => {
    const filteredPatterns = patterns.filter(Boolean);
    if (!filteredPatterns.length) return true;

    const queue = getCacheInvalidationQueue();
    if (!queue) return false;

    await Promise.race([
        queue.add(JOB_INVALIDATE, { patterns: filteredPatterns }),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Cache invalidation enqueue timed out')), STARTUP_TIMEOUT_MS);
        }),
    ]);
    return true;
};

const invalidateViaQueueOrNow = async (...patterns) => {
    // Perform invalidation directly and synchronously to bypass the fragile background queue
    await invalidateCache(...patterns);
};

const startCacheInvalidationWorker = async () => {
    if (started) return;
    started = true;

    const worker = createWorker(QUEUE_NAME, async (job) => {
        if (job.name !== JOB_INVALIDATE) {
            throw new Error(`Unsupported cache invalidation job: ${job.name}`);
        }

        await invalidateCache(...(job.data?.patterns || []));
    });

    if (!worker) return;

    try {
        await Promise.race([
            worker.waitUntilReady(),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Cache invalidation worker startup timed out')), STARTUP_TIMEOUT_MS);
            }),
        ]);
        console.log('[CacheInvalidationQueue] Worker ready');
    } catch (error) {
        console.error('[CacheInvalidationQueue] Worker not ready:', error.message);
        await worker.close().catch(() => {});
    }
};

module.exports = {
    enqueueCacheInvalidation,
    invalidateViaQueueOrNow,
    startCacheInvalidationWorker,
};
