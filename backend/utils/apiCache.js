const crypto = require('crypto');
const { getRedis } = require('../config/redis');

const memoryCache = new Map();
const MEMORY_CACHE_MAX_KEYS = Number(process.env.MEMORY_CACHE_MAX_KEYS || 1000);
const CACHE_REDIS_TIMEOUT_MS = Number(process.env.CACHE_REDIS_TIMEOUT_MS || 250);

const withTimeout = (promise, timeoutMs = CACHE_REDIS_TIMEOUT_MS) => Promise.race([
    promise,
    new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Cache operation timed out')), timeoutMs);
    }),
]);

const getMemoryCache = (key) => {
    const entry = memoryCache.get(key);
    if (!entry) return { hit: false, value: null };
    if (entry.expiresAt <= Date.now()) {
        memoryCache.delete(key);
        return { hit: false, value: null };
    }
    return { hit: true, value: entry.value };
};

const setMemoryCache = (key, value, ttlSeconds) => {
    if (memoryCache.size >= MEMORY_CACHE_MAX_KEYS) {
        const firstKey = memoryCache.keys().next().value;
        if (firstKey) memoryCache.delete(firstKey);
    }
    memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
};

const clearMemoryCache = (...patterns) => {
    const matchers = patterns.filter(Boolean).map((pattern) => {
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return (key) => key.startsWith(prefix);
        }
        return (key) => key === pattern;
    });

    if (!matchers.length) return;

    for (const key of memoryCache.keys()) {
        if (matchers.some((matches) => matches(key))) {
            memoryCache.delete(key);
        }
    }
};

const stableStringify = (value) => {
    if (typeof value === 'undefined') {
        return 'null';
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
};

const hashValue = (value) => crypto
    .createHash('sha1')
    .update(stableStringify(value))
    .digest('hex');

const getUserCacheScope = (req) => (
    req.user?.role === 'admin'
        ? 'admin'
        : `user:${req.user?.id || 'anonymous'}`
);

const makeCacheKey = (namespace, req, parts = {}) => (
    `${namespace}:${getUserCacheScope(req)}:${hashValue({
        query: req.query || {},
        parts,
    })}`
);

const getCachedJson = async (key) => {
    const memory = getMemoryCache(key);
    if (memory.hit) {
        return { hit: true, redis: null, value: memory.value };
    }

    const redis = await getRedis();
    if (!redis) return { hit: false, redis: null, value: null };

    let cached;
    try {
        cached = await withTimeout(redis.get(key));
    } catch {
        return { hit: false, redis, value: null };
    }
    if (cached === null) return { hit: false, redis, value: null };

    try {
        const value = JSON.parse(cached);
        setMemoryCache(key, value, Number(process.env.MEMORY_CACHE_REDIS_HIT_TTL_SECONDS || 30));
        return { hit: true, redis, value };
    } catch {
        await redis.del(key);
        return { hit: false, redis, value: null };
    }
};

const setCachedJson = async (redis, key, value, ttlSeconds) => {
    setMemoryCache(key, value, ttlSeconds);
    if (!redis) return;
    try {
        await withTimeout(redis.set(key, JSON.stringify(value), { EX: ttlSeconds }));
    } catch {
        // Keep the in-process cache warm even if remote Redis is slow.
    }
};

module.exports = {
    clearMemoryCache,
    getCachedJson,
    getUserCacheScope,
    makeCacheKey,
    setCachedJson,
};
