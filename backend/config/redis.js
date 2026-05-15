const { createClient } = require('redis');

let client;
let connectPromise;

const getRedisUrl = () => process.env.REDIS_URL;

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
            reconnectStrategy: (retries) => {
                if (retries > 5) {
                    return new Error('Redis reconnect attempts exhausted');
                }
                return Math.min(retries * 50, 1000);
            },
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

    if (!connectPromise) {
        connectPromise = redis.connect().catch((error) => {
            connectPromise = null;
            console.error('Redis connection failed:', error.message);
            throw error;
        });
    }

    return connectPromise;
};

const getRedis = async () => {
    try {
        return await connectRedis();
    } catch {
        return null;
    }
};

module.exports = {
    connectRedis,
    getRedis,
};
