const path = require('path');
const { Worker } = require('worker_threads');

/*
 * Runs a workbook parser in a worker thread.
 *
 * Reading an upload is synchronous CPU work - about 170 ms for 2,000 rows and 630 ms for 10,000 -
 * and on the main thread every other request waits that long. A parser is any exported function
 * (buffer, options) => plain data (it must not need the database); the result comes back by
 * structured clone. One worker is kept while files arrive and parses them one at a time; it stops
 * after a minute without work.
 *
 * An error thrown by the parser is rethrown here as an Error with the same name, message and own
 * properties (code, hint, status...), so callers can check error.code.
 */

const WORKER_FILE = path.join(__dirname, 'offThreadParse.worker.js');
const IDLE_MS = 60 * 1000;

let worker = null;
let idleTimer = null;
let nextId = 0;
const pending = new Map();

const rejectAll = (error) => {
    pending.forEach(({ reject }) => reject(error));
    pending.clear();
};

const stopWhenIdle = () => {
    clearTimeout(idleTimer);
    if (pending.size || !worker) return;
    idleTimer = setTimeout(() => {
        if (pending.size || !worker) return;
        worker.terminate();
        worker = null;
    }, IDLE_MS);
    idleTimer.unref();
};

const getWorker = () => {
    if (worker) return worker;
    const thread = new Worker(WORKER_FILE);
    thread.unref();
    thread.on('message', ({ id, result, error }) => {
        const task = pending.get(id);
        if (!task) return;
        pending.delete(id);
        if (error) task.reject(Object.assign(new Error(error.message), error));
        else task.resolve(result);
        stopWhenIdle();
    });
    thread.on('error', (error) => {
        if (worker === thread) worker = null;
        rejectAll(error);
    });
    thread.on('exit', (code) => {
        if (worker === thread) worker = null;
        if (pending.size) rejectAll(new Error(`The file reader stopped unexpectedly (code ${code}).`));
    });
    worker = thread;
    return thread;
};

/** parseOffThread(require.resolve('./parser'), 'parseWorkbook', file.buffer, { fileName }) */
const parseOffThread = (modulePath, exportName, buffer, options = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    clearTimeout(idleTimer);
    try {
        getWorker().postMessage({ id, modulePath, exportName, buffer, options });
    } catch (error) {
        pending.delete(id);
        reject(error);
    }
});

module.exports = { parseOffThread };
