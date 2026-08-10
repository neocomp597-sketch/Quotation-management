const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ApiKey = require('../models/ApiKey');
const ApiRequestLog = require('../models/ApiRequestLog');
const { protect } = require('../middlewares/authMiddleware');

// GET /api/developer/keys - List company API keys
router.get('/keys', protect, async (req, res) => {
    try {
        const companyId = req.user.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Company ID required' });
        }

        const keys = await ApiKey.find({ companyId })
            .sort({ createdAt: -1 })
            .lean();

        const formatted = keys.map(k => ({
            id: k._id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            displayKey: `${k.keyPrefix}••••••••••••••••`,
            environment: k.environment || 'production',
            permissions: k.permissions || [],
            status: k.status || 'active',
            createdAt: k.createdAt,
            lastUsedAt: k.lastUsedAt,
            expiresAt: k.expiresAt,
            revokedAt: k.revokedAt
        }));

        return res.json({ data: formatted });
    } catch (error) {
        console.error('[DeveloperRoutes] Error fetching API keys:', error);
        return res.status(500).json({ message: 'Failed to retrieve API keys' });
    }
});

// POST /api/developer/keys - Generate a new API Key
router.post('/keys', protect, async (req, res) => {
    try {
        const companyId = req.user.companyId;
        if (!companyId) {
            return res.status(400).json({ message: 'Company ID required' });
        }

        const { name, permissions, environment } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'API key name is required' });
        }

        const validScopes = [
            'customers.read', 'customers.write',
            'contacts.read', 'contacts.write',
            'leads.read', 'leads.write',
            'deals.read', 'deals.write'
        ];

        const selectedPermissions = Array.isArray(permissions) 
            ? permissions.filter(p => validScopes.includes(p))
            : ['customers.read', 'contacts.read', 'leads.read', 'deals.read'];

        // Generate cryptographically secure random secret
        const secretHex = crypto.randomBytes(32).toString('hex');
        const prefix = `arcrm_live_${secretHex.substring(0, 8)}`;
        const fullKey = `arcrm_live_${secretHex}`;
        const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

        const apiKey = new ApiKey({
            userId: req.user._id,
            companyId: companyId, // Derived strictly from logged-in user JWT
            name: name.trim(),
            keyPrefix: prefix,
            keyHash: keyHash,
            environment: environment || 'production',
            permissions: selectedPermissions,
            status: 'active'
        });

        await apiKey.save();

        // Return key secret ONLY ONCE
        return res.status(201).json({
            message: 'API Key generated successfully. Please copy it now as it will not be shown again.',
            data: {
                id: apiKey._id,
                name: apiKey.name,
                key: fullKey,
                keyPrefix: prefix,
                environment: apiKey.environment,
                permissions: apiKey.permissions,
                createdAt: apiKey.createdAt
            }
        });
    } catch (error) {
        console.error('[DeveloperRoutes] Error creating API key:', error);
        return res.status(500).json({ message: 'Failed to create API key' });
    }
});

// POST /api/developer/keys/:id/revoke - Soft revoke an API Key
router.post('/keys/:id/revoke', protect, async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const keyId = req.params.id;

        const updatedKey = await ApiKey.findOneAndUpdate(
            { _id: keyId, companyId: companyId },
            { 
                $set: { 
                    status: 'revoked',
                    revokedAt: new Date()
                } 
            },
            { new: true }
        );

        if (!updatedKey) {
            return res.status(404).json({ message: 'API key not found' });
        }

        return res.json({
            message: 'API key revoked successfully',
            data: {
                id: updatedKey._id,
                status: updatedKey.status,
                revokedAt: updatedKey.revokedAt
            }
        });
    } catch (error) {
        console.error('[DeveloperRoutes] Error revoking API key:', error);
        return res.status(500).json({ message: 'Failed to revoke API key' });
    }
});

// GET /api/developer/logs - Fetch API request logs for company
router.get('/logs', protect, async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId };

        const [logs, total] = await Promise.all([
            ApiRequestLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('apiKeyId', 'name keyPrefix')
                .lean(),
            ApiRequestLog.countDocuments(filter)
        ]);

        const formatted = logs.map(l => ({
            id: l._id,
            requestId: l.requestId,
            keyName: l.apiKeyId ? l.apiKeyId.name : 'Revoked Key',
            keyPrefix: l.apiKeyId ? l.apiKeyId.keyPrefix : '••••••••',
            endpoint: l.endpoint,
            method: l.method,
            statusCode: l.statusCode,
            responseTimeMs: l.responseTimeMs,
            createdAt: l.createdAt
        }));

        return res.json({
            data: formatted,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error('[DeveloperRoutes] Error fetching API logs:', error);
        return res.status(500).json({ message: 'Failed to retrieve API logs' });
    }
});

// GET /api/developer/openapi.json - Load and serve OpenAPI specification
router.get('/openapi.json', protect, (req, res) => {
    try {
        let jsYaml;
        try { jsYaml = require('js-yaml'); } catch (e) { jsYaml = null; }

        const yamlPath = path.join(__dirname, '../docs/openapi.yaml');
        const jsonPath = path.join(__dirname, '../docs/openapi.json');

        if (fs.existsSync(jsonPath)) {
            const rawJson = fs.readFileSync(jsonPath, 'utf8');
            return res.json(JSON.parse(rawJson));
        }

        if (fs.existsSync(yamlPath) && jsYaml) {
            const fileContents = fs.readFileSync(yamlPath, 'utf8');
            const doc = jsYaml.load(fileContents);
            return res.json(doc);
        }

        // Default openapi json spec object fallback
        return res.json({
            openapi: "3.0.3",
            info: {
                title: "ARCRM Public API",
                description: "Public REST API for ARCRM integrations",
                version: "1.0.0"
            },
            servers: [{ url: "https://arcrm.co.in/api/v1" }]
        });
    } catch (error) {
        console.error('[DeveloperRoutes] Error parsing OpenAPI spec:', error);
        return res.status(500).json({ message: 'Failed to load OpenAPI spec' });
    }
});

module.exports = router;
