const User = require('../models/User');
const { createWorker, getQueue } = require('../config/bullmq');

const QUEUE_NAME = 'auth-session';
const JOB_PERSIST_LEGACY_SESSION = 'persist-legacy-refresh-session';
const STARTUP_TIMEOUT_MS = Number(process.env.BULLMQ_STARTUP_TIMEOUT_MS || 5000);

let started = false;

const getAuthSessionQueue = () => getQueue(QUEUE_NAME, {
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
    },
});

const enqueueLegacyRefreshSession = async ({ userId, tokenHash, expiresAt }) => {
    const queue = getAuthSessionQueue();
    if (!queue) return false;

    await Promise.race([
        queue.add(
            JOB_PERSIST_LEGACY_SESSION,
            { userId, tokenHash, expiresAt },
            { jobId: `legacy-refresh-${userId}` },
        ),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Auth session enqueue timed out')), STARTUP_TIMEOUT_MS);
        }),
    ]);
    return true;
};

const startAuthSessionWorker = async () => {
    if (started) return;
    started = true;

    const worker = createWorker(QUEUE_NAME, async (job) => {
        if (job.name !== JOB_PERSIST_LEGACY_SESSION) {
            throw new Error(`Unsupported auth session job: ${job.name}`);
        }

        const { userId, tokenHash, expiresAt } = job.data || {};
        if (!userId || !tokenHash || !expiresAt) {
            throw new Error('Invalid auth session job payload');
        }

        await User.findByIdAndUpdate(userId, {
            refreshTokenHash: tokenHash,
            refreshTokenExpiresAt: new Date(expiresAt),
        });
    });

    if (worker) {
        try {
            await Promise.race([
                worker.waitUntilReady(),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Auth session worker startup timed out')), STARTUP_TIMEOUT_MS);
                }),
            ]);
            console.log('[AuthSessionQueue] Worker ready');
        } catch (error) {
            console.error('[AuthSessionQueue] Worker not ready:', error.message);
            await worker.close().catch(() => {});
        }
    }
};

module.exports = {
    enqueueLegacyRefreshSession,
    startAuthSessionWorker,
};
