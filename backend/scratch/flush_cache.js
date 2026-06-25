const { getRedis } = require('../config/redis');
const { clearMemoryCache } = require('../utils/apiCache');
const { invalidateProductCaches } = require('../utils/cacheInvalidation');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
    console.log("Starting cache flush...");
    
    // Clear local memory cache
    clearMemoryCache('products:*', 'dashboard:quotations:*');
    console.log("Memory cache cleared.");

    // Clear Redis cache
    try {
        const redis = await getRedis();
        if (redis) {
            console.log("Connected to Redis. Invalidating product cache keys...");
            await invalidateProductCaches();
            // Also delete the specific global key 'products:all'
            await redis.del('products:all');
            console.log("Redis cache keys matching products:* and products:all deleted successfully.");
        } else {
            console.log("Redis is not running/configured. Only local memory cache was cleared.");
        }
    } catch (err) {
        console.error("Failed to clear Redis:", err);
    }
    
    process.exit(0);
}

run();
