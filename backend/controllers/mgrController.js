const MGR = require('../models/MGR');
const { getCachedJson, makeCacheKey, setCachedJson } = require('../utils/apiCache');
const { invalidateViaQueueOrNow } = require('../queues/cacheInvalidationQueue');

const MGR_CACHE_TTL_SECONDS = Number(process.env.MGR_CACHE_TTL_SECONDS || 600);

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
};

// Get all MGRs
exports.getAllMGRs = async (req, res) => {
    try {
        const { type } = req.query;
        let query = {};
        if (type) {
            query.mgrType = type;
        }

        const cacheKey = makeCacheKey('mgrs:list', req, { query });
        const { redis, value: cachedMgrs } = await getCachedJson(cacheKey);
        if (cachedMgrs) {
            return res.json(cachedMgrs);
        }

        if (req.query.page || req.query.limit) {
            const { page, limit, skip } = getPagination(req.query);
            const [mgrs, total] = await Promise.all([
                MGR.find(query)
                    .select('code description mgrType status createdAt updatedAt')
                    .sort({ mgrType: 1, createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                MGR.countDocuments(query)
            ]);

            const response = {
                data: mgrs,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit) || 1
                }
            };
            await setCachedJson(redis, cacheKey, response, MGR_CACHE_TTL_SECONDS);
            return res.json(response);
        }

        const mgrs = await MGR.find(query)
            .select('code description mgrType status createdAt updatedAt')
            .sort({ mgrType: 1, createdAt: -1 })
            .lean();
        await setCachedJson(redis, cacheKey, mgrs, MGR_CACHE_TTL_SECONDS);
        res.json(mgrs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get MGR by ID
exports.getMGRById = async (req, res) => {
    try {
        const mgr = await MGR.findById(req.params.id)
            .select('code description mgrType status createdAt updatedAt')
            .lean();
        if (!mgr) return res.status(404).json({ message: 'MGR not found' });
        res.json(mgr);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Create a new MGR
exports.createMGR = async (req, res) => {
    const mgr = new MGR(req.body);
    try {
        const newMGR = await mgr.save();
        await invalidateViaQueueOrNow('mgrs:*', 'planning:*');
        res.status(201).json(newMGR);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'MGR code already exists for this type' });
        }
        res.status(400).json({ message: err.message });
    }
};

// Update an existing MGR
exports.updateMGR = async (req, res) => {
    try {
        const updatedMGR = await MGR.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedMGR) return res.status(404).json({ message: 'MGR not found' });
        await invalidateViaQueueOrNow('mgrs:*', 'planning:*');
        res.json(updatedMGR);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'MGR code already exists for this type' });
        }
        res.status(400).json({ message: err.message });
    }
};

// Delete an MGR
exports.deleteMGR = async (req, res) => {
    try {
        const deletedMGR = await MGR.findByIdAndDelete(req.params.id);
        if (!deletedMGR) return res.status(404).json({ message: 'MGR not found' });
        await invalidateViaQueueOrNow('mgrs:*', 'planning:*');
        res.json({ message: 'MGR deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
