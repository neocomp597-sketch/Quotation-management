const { createClient } = require('redis');

let client;
let connectPromise;
let unavailableUntil = 0;

const getRedisUrl = () => process.env.REDIS_URL;
const isRedisConfigured = () => Boolean(getRedisUrl());
const getRetryCooldownMs = () => Number(process.env.REDIS_RETRY_COOLDOWN_MS || 10000);

const getRedisReconnectStrategy = (retries) => {
    const maxRetries = Number(process.env.REDIS_MAX_RETRIES || 10);
    if (retries > maxRetries) {
        return new Error('Redis reconnect attempts exhausted');
    }
    return Math.min(retries * 100, 3000);
};

const getBullMqConnectionOptions = () => {
    const url = getRedisUrl();
    if (!url) return null;

    const parsed = new URL(url);
    const db = parsed.pathname ? Number(parsed.pathname.replace('/', '') || 0) : 0;

    return {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        db,
        tls: parsed.protocol === 'rediss:' ? {} : undefined,
        connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5000),
        maxRetriesPerRequest: null,
        retryStrategy: getRedisReconnectStrategy,
    };
};

const getRedisClient = () => {
    if (client) return client;

    const url = getRedisUrl();
    if (!url) {
        return null;
    }

    client = createClient({
        url,
        socket: {
            connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5000),
            reconnectStrategy: getRedisReconnectStrategy,
        },
    });

    client.on('error', (error) => {
        console.error('Redis error:', error.message);
    });

    return client;
};

const connectRedis = async () => {
    const redis = getRedisClient();
    if (!redis) {
        throw new Error('REDIS_URL is not configured');
    }

    if (redis.isOpen) return redis;
    if (Date.now() < unavailableUntil) {
        throw new Error('Redis is in retry cooldown');
    }

    if (!connectPromise) {
        connectPromise = redis.connect().catch((error) => {
            connectPromise = null;
            unavailableUntil = Date.now() + getRetryCooldownMs();
            console.error('Redis connection failed:', error.message);
            throw error;
        });
    }

    const connectedRedis = await connectPromise;
    unavailableUntil = 0;
    return connectedRedis;
};

const getRedis = async () => {
    try {
        return await connectRedis();
    } catch {
        return null;
    }
};

const disconnectRedis = async () => {
    if (!client) return;

    try {
        if (client.isOpen) {
            await client.quit();
        }
    } catch (error) {
        console.error('Redis disconnect failed:', error.message);
        client.destroy();
    } finally {
        client = null;
        connectPromise = null;
    }
};

module.exports = {
    connectRedis,
    disconnectRedis,
    getBullMqConnectionOptions,
    getRedis,
    isRedisConfigured,
};
