const crypto = require('crypto');
const ApiKey = require('../models/ApiKey');
const ApiRequestLog = require('../models/ApiRequestLog');
const { sendError } = require('../utils/apiResponse');

// Throttling map to avoid MongoDB write amplification on every request
// key: apiKeyId, value: timestamp of last DB update
const lastUsedCache = new Map();
const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

const generateRequestId = () => {
    const timeHex = Date.now().toString(36);
    const randomHex = crypto.randomBytes(6).toString('hex');
    return `req_${timeHex}${randomHex}`;
};

const apiKeyAuth = async (req, res, next) => {
    const requestId = generateRequestId();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const startTime = Date.now();

    try {
        const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || '';
        let rawKey = '';

        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            rawKey = authHeader.substring(7).trim();
        } else if (typeof authHeader === 'string' && authHeader.startsWith('arcrm_')) {
            rawKey = authHeader.trim();
        }

        if (!rawKey) {
            return sendError(res, 'missing_api_key', 'API authentication is required. Please provide a Bearer API key.', 401);
        }

        // Hash raw secret key using SHA-256
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        // Find API key record
        const apiKey = await ApiKey.findOne({ keyHash });

        if (!apiKey || apiKey.status === 'revoked') {
            return sendError(res, 'invalid_api_key', 'The API key is invalid or has been revoked', 401);
        }

        if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
            return sendError(res, 'invalid_api_key', 'The API key has expired', 401);
        }

        // Attach tenant client metadata
        req.apiClient = {
            userId: apiKey.userId,
            companyId: apiKey.companyId,
            permissions: apiKey.permissions || [],
            apiKeyId: apiKey._id,
            environment: apiKey.environment || 'production'
        };

        // Throttled lastUsedAt update
        const keyIdStr = apiKey._id.toString();
        const lastUpdated = lastUsedCache.get(keyIdStr) || 0;
        if (Date.now() - lastUpdated > THROTTLE_MS) {
            lastUsedCache.set(keyIdStr, Date.now());
            ApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date() } }).catch(err => {
                console.warn(`[ApiKeyAuth] Failed to update lastUsedAt for key ${keyIdStr}:`, err.message);
            });
        }

        // Log request on response completion
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            ApiRequestLog.create({
                apiKeyId: apiKey._id,
                companyId: apiKey.companyId,
                requestId: requestId,
                endpoint: req.originalUrl || req.url,
                method: req.method,
                statusCode: res.statusCode,
                responseTimeMs: duration,
                ipAddress: req.ip || req.connection.remoteAddress || '',
                userAgent: req.headers['user-agent'] || ''
            }).catch(err => {
                console.warn('[ApiKeyAuth] Failed to log API request:', err.message);
            });
        });

        next();
    } catch (error) {
        console.error('[ApiKeyAuth] Authentication middleware error:', error);
        return sendError(res, 'internal_error', 'An error occurred during API authentication', 500);
    }
};

module.exports = apiKeyAuth;
