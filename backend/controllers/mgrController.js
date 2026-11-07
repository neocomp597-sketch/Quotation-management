const MGR = require('../models/MGR');
const { getCachedJson, makeCacheKey, setCachedJson } = require('../utils/apiCache');
const { invalidateViaQueueOrNow } = require('../queues/cacheInvalidationQueue');

const MGR_CACHE_TTL_SECONDS = Number(process.env.MGR_CACHE_TTL_SECONDS || 600);

// An MGR code as saved: no spaces at the ends and single spaces inside, so "M 365 " is "M 365".
const cleanCode = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const codeKey = (value) => cleanCode(value).toLowerCase();

/**
 * The saved value of `mgrType` whose code is `code` but for case and spaces, other than `exceptId`.
 * A look-alike ("M 365 " next to "M 365") is a different value to MGR Access and Product Master, so a
 * user given one does not see the products carrying the other: it is refused instead of saved.
 */
const findLookAlike = async (mgrType, code, exceptId = null) => {
    const key = codeKey(code);
    const sameType = await MGR.find({ mgrType, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).select('mgrType code').lean();
    return sameType.find((mgr) => codeKey(mgr.code) === key) || null;
};

const lookAlikeMessage = (mgr, code) => (cleanCode(mgr.code) === cleanCode(code)
    ? `${mgr.mgrType} "${cleanCode(mgr.code)}" already exists.`
    : `${mgr.mgrType} "${mgr.code}" already exists. "${cleanCode(code)}" differs from it only in capital letters or spaces: use the existing value.`);

/** The body's code and description cleaned; `res` answers 400 and null is returned when the code is taken. */
const prepareMgrBody = async (req, res, mgrType, exceptId = null) => {
    const body = { ...req.body };
    if (body.code !== undefined) body.code = cleanCode(body.code);
    if (body.description !== undefined) body.description = String(body.description ?? '').trim();
    if (body.code !== undefined && mgrType) {
        const lookAlike = await findLookAlike(mgrType, body.code, exceptId);
        if (lookAlike) {
            res.status(400).json({ message: lookAlikeMessage(lookAlike, body.code) });
            return null;
        }
    }
    return body;
};

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
                    .select('code description mgrType status problemList createdAt updatedAt')
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
            .select('code description mgrType status problemList createdAt updatedAt')
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
            .select('code description mgrType status problemList createdAt updatedAt')
            .lean();
        if (!mgr) return res.status(404).json({ message: 'MGR not found' });
        res.json(mgr);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Create a new MGR
exports.createMGR = async (req, res) => {
    try {
        const body = await prepareMgrBody(req, res, req.body?.mgrType);
        if (!body) return;
        const newMGR = await new MGR(body).save();
        await invalidateViaQueueOrNow('mgrs:*', 'planning:*', 'products:*');
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
        const saved = await MGR.findById(req.params.id).select('mgrType').lean();
        if (!saved) return res.status(404).json({ message: 'MGR not found' });
        const body = await prepareMgrBody(req, res, req.body?.mgrType || saved.mgrType, saved._id);
        if (!body) return;
        const updatedMGR = await MGR.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
        if (!updatedMGR) return res.status(404).json({ message: 'MGR not found' });
        await invalidateViaQueueOrNow('mgrs:*', 'planning:*', 'products:*');
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
        await invalidateViaQueueOrNow('mgrs:*', 'planning:*', 'products:*');
        res.json({ message: 'MGR deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get MGR Info Text
exports.getMGRInfoText = async (req, res) => {
    try {
        const CompanySettings = require('../models/CompanySettings');
        const companyId = req.query?.companyId || req.user?.companyId;
        const query = companyId ? { companyId } : {};
        let settings = await CompanySettings.findOne(query).lean();
        if (!settings) {
            settings = await CompanySettings.findOne().lean();
        }
        res.json({
            infoText: settings?.mgrInfoText || 'MGR (Master Group & Sub-Group Hierarchy) defines the 5-level classification matrix (MGR1 to MGR5) for all products, components, and inventory items across the organization.\n\n• MGR1: Product Category / Division\n• MGR2: Product Sub-Category\n• MGR3: Product Line / Group\n• MGR4: Model Series & Specifications\n• MGR5: Spares & Component Parts\n\nUse this screen to manage MGR codes, descriptions, and hierarchy levels.'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update MGR Info Text
exports.updateMGRInfoText = async (req, res) => {
    try {
        const CompanySettings = require('../models/CompanySettings');
        const { infoText } = req.body;
        if (typeof infoText !== 'string') {
            return res.status(400).json({ message: 'infoText string is required' });
        }
        const companyId = req.query?.companyId || req.user?.companyId;
        const query = companyId ? { companyId } : {};
        let settings = await CompanySettings.findOne(query);
        if (!settings) {
            settings = await CompanySettings.findOne();
        }
        if (!settings) {
            return res.status(404).json({ message: 'Company settings not found' });
        }
        settings.mgrInfoText = infoText;
        await settings.save();
        res.json({ message: 'MGR information text updated successfully', infoText: settings.mgrInfoText });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
