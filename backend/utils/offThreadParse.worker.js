// Worker side of utils/offThreadParse.js: runs the requested parser on the file it is sent.
const { parentPort } = require('worker_threads');

parentPort.on('message', ({ id, modulePath, exportName, buffer, options }) => {
    try {
        const parse = require(modulePath)[exportName];
        if (typeof parse !== 'function') throw new Error(`${exportName} is not a parser in ${modulePath}`);
        // The buffer arrives as a plain Uint8Array: wrap it without copying.
        const file = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        parentPort.postMessage({ id, result: parse(file, options) });
    } catch (error) {
        parentPort.postMessage({
            id,
            error: { ...error, name: error?.name || 'Error', message: error?.message || String(error) }
        });
    }
});
