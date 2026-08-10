const { getRedisClient } = require('../config/redis');
const { sendError } = require('../utils/apiResponse');

// In-memory sliding window fallback for dev mode
const memoryStore = new Map();

const apiRateLimiter = (limitWindowMs = 60000, maxRequests = 100) => {
    return async (req, res, next) => {
        try {
            const keyId = req.apiClient?.apiKeyId?.toString() || req.ip || 'anonymous';
            const redis = getRedisClient();
            const now = Date.now();
            const windowKey = `ratelimit:apikey:${keyId}`;

            let currentCount = 0;
            let ttlMs = limitWindowMs;

            if (redis && typeof redis.incr === 'function') {
                try {
                    currentCount = await redis.incr(windowKey);
                    if (currentCount === 1) {
                        await redis.pexpire(windowKey, limitWindowMs);
                    }
                    const pttl = await redis.pttl(windowKey);
                    if (pttl > 0) ttlMs = pttl;
                } catch (redisErr) {
                    console.warn('[RateLimiter] Redis error, using memory fallback:', redisErr.message);
                    currentCount = updateMemoryStore(keyId, limitWindowMs, maxRequests);
                }
            } else {
                currentCount = updateMemoryStore(keyId, limitWindowMs, maxRequests);
            }

            const remaining = Math.max(0, maxRequests - currentCount);
            const resetTimeSec = Math.ceil((now + ttlMs) / 1000);

            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', resetTimeSec);

            if (currentCount > maxRequests) {
                return sendError(
                    res,
                    'rate_limit_exceeded',
                    `API rate limit exceeded. Allowed: ${maxRequests} requests per minute.`,
                    429
                );
            }

            next();
        } catch (error) {
            console.error('[RateLimiter] Error in rate limiter middleware:', error);
            next(); // Allow request through if rate limiting fails
        }
    };
};

function updateMemoryStore(key, windowMs) {
    const now = Date.now();
    let record = memoryStore.get(key);

    if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + windowMs };
        memoryStore.set(key, record);
        return 1;
    }

    record.count += 1;
    memoryStore.set(key, record);
    return record.count;
}

module.exports = apiRateLimiter;
