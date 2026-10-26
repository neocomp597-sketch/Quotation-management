const { getRedis } = require('../config/redis');
const { clearMemoryCache } = require('./apiCache');

const invalidateCache = async (...patterns) => {
    clearMemoryCache(...patterns);

    try {
        const redis = await getRedis();
        if (!redis) return;

        for (const pattern of patterns.filter(Boolean)) {
            let cursor = '0';
            do {
                const scanResult = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
                cursor = String(scanResult.cursor || '0');
                const keys = scanResult.keys || [];
                if (keys.length) {
                    await redis.del(keys);
                }
            } while (cursor !== '0');
        }
    } catch (redisError) {
        console.warn("Redis cache invalidation failed:", redisError.message);
    }
};

const invalidateCustomerCaches = () => invalidateCache('customers:*', 'dashboard:quotations:*');
const invalidateProductCaches = () => invalidateCache('products:*', 'dashboard:quotations:*');
const invalidateQuotationCaches = () => invalidateCache('quotations:*', 'dashboard:quotations:*');
const invalidatePlanningCaches = () => invalidateCache('planning:*');
const invalidateStatusCaches = () => invalidateCache('statuses:*', 'planning:*');
// Assets/Invoice Bulk Upload caches. Called whenever Product Master MGR assignments
// change so the next page load always reflects the latest values.
const invalidateAssetCaches = (companyId) => {
    const patterns = ['assets:*', 'serials:*', 'invoice_bulk:*'];
    if (companyId) patterns.push(`assets:${companyId}:*`);
    return invalidateCache(...patterns);
};

module.exports = {
    invalidateCache,
    invalidateAssetCaches,
    invalidateCustomerCaches,
    invalidatePlanningCaches,
    invalidateProductCaches,
    invalidateQuotationCaches,
    invalidateStatusCaches,
};
