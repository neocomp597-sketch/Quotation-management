const { startImportProgress } = require('../utils/importProgress');

/*
 * Bounded concurrency for the Excel imports (routes/importRoutes.js).
 *
 *  - Imports of one module for one company run one after the other. A second upload of the same
 *    file (another tab, a retry while the first is still saving) waits and then sees the records
 *    the first one saved, instead of both creating them.
 *  - At most IMPORT_MAX_CONCURRENT imports run at once in this process (default 2); the rest
 *    wait in arrival order, so imports cannot use up the database pool and slow everyone else.
 *  - An import that has waited IMPORT_QUEUE_TIMEOUT_MS (default 10 minutes) gets a 503, and so
 *    does one that arrives while IMPORT_MAX_QUEUED (default 10) are already waiting: a waiting
 *    upload keeps its file and rows in memory.
 */

const readPositiveInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_CONCURRENT = readPositiveInt(process.env.IMPORT_MAX_CONCURRENT, 2);
const QUEUE_TIMEOUT_MS = readPositiveInt(process.env.IMPORT_QUEUE_TIMEOUT_MS, 10 * 60 * 1000);
const MAX_QUEUED = readPositiveInt(process.env.IMPORT_MAX_QUEUED, 10);

let running = 0;
const runningKeys = new Set();
const waiting = [];

const canStart = (key) => running < MAX_CONCURRENT && !runningKeys.has(key);

const begin = (key) => {
    running++;
    runningKeys.add(key);
    let released = false;
    return () => {
        if (released) return;
        released = true;
        running--;
        runningKeys.delete(key);
        startWaiting();
    };
};

const startWaiting = () => {
    for (let i = 0; i < waiting.length; i++) {
        const entry = waiting[i];
        if (!canStart(entry.key)) continue;
        waiting.splice(i, 1);
        i--;
        clearTimeout(entry.timer);
        entry.resolve(begin(entry.key));
    }
};

const acquire = (key) => {
    if (canStart(key)) return Promise.resolve(begin(key));
    if (waiting.length >= MAX_QUEUED) return Promise.reject(new Error('IMPORT_QUEUE_FULL'));
    return new Promise((resolve, reject) => {
        const entry = { key, resolve };
        entry.timer = setTimeout(() => {
            const index = waiting.indexOf(entry);
            if (index !== -1) waiting.splice(index, 1);
            reject(new Error('IMPORT_QUEUE_TIMEOUT'));
        }, QUEUE_TIMEOUT_MS);
        waiting.push(entry);
    });
};

/** "/products", "/price-book-items/:id" -> "products", "price-book-items" */
const moduleOf = (req) => String(req.path || '').split('/').filter(Boolean)[0] || 'import';

const limitImportConcurrency = async (req, res, next) => {
    const module = moduleOf(req);
    const key = `${req.user?.companyId || ''}:${module}`;
    const progress = startImportProgress(req, module);

    let release;
    try {
        release = await acquire(key);
    } catch (error) {
        progress?.finish('The server is busy with other imports.');
        return res.status(503).json({
            message: 'The server is busy with other imports. Try again in a few minutes.',
            errors: ['Import queue is full.']
        });
    }

    if (req.aborted || res.destroyed) {
        release();
        progress?.finish('The upload was cancelled.');
        return undefined;
    }

    // The importer's own summary ("Import completed. Created: ...") becomes the final message.
    let summary = '';
    const json = res.json.bind(res);
    res.json = (body) => {
        summary = body?.message || '';
        return json(body);
    };
    const done = () => {
        release();
        progress?.finish(summary || (res.statusCode < 400 ? 'Finished' : 'Failed'));
    };
    res.once('finish', done);
    res.once('close', done);
    progress?.update({ stage: 'processing' });
    return next();
};

const getImportQueueState = () => ({ running, waiting: waiting.length, maxConcurrent: MAX_CONCURRENT });

module.exports = { limitImportConcurrency, getImportQueueState };
