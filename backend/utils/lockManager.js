const RequestLock = require('../models/RequestLock');

const acquireLock = async (lockKey) => {
    try {
        await RequestLock.create({ lockKey });
        return true;
    } catch (err) {
        if (err.code === 11000) {
            return false; // Lock already exists (duplicate key error)
        }
        throw err;
    }
};

const releaseLock = async (lockKey) => {
    try {
        await RequestLock.deleteOne({ lockKey });
    } catch (err) {
        console.error('[LockManager] Failed to release lock:', err);
    }
};

module.exports = {
    acquireLock,
    releaseLock
};
