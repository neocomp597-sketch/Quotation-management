const ComplaintType = require('../models/ComplaintType');

// CSM Config > Complaint Types: Type of Complaint and its Details of Complaint for the ticket forms.

const MAX_TEXT_LENGTH = 200;
const MAX_DETAILS_PER_TYPE = 500;
const MAX_UPLOAD_ROWS = 10000;

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const keyOf = (value) => clean(value).toLowerCase();

const uniqueDetails = (values) => {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).map(clean).filter((detail) => {
        const key = detail.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

const checkLengths = (name, details) => {
    if (!name) throw httpError(400, 'Type of Complaint is required.');
    if (name.length > MAX_TEXT_LENGTH) throw httpError(400, `Type of Complaint can be at most ${MAX_TEXT_LENGTH} characters.`);
    if (details.length > MAX_DETAILS_PER_TYPE) throw httpError(400, `A Type of Complaint can have at most ${MAX_DETAILS_PER_TYPE} details.`);
    const long = details.find((detail) => detail.length > MAX_TEXT_LENGTH);
    if (long) throw httpError(400, `Details of Complaint can be at most ${MAX_TEXT_LENGTH} characters: "${long.slice(0, 40)}..."`);
};

const statusOf = (value) => (value === 'Inactive' ? 'Inactive' : 'Active');

const nextSortOrder = async (companyId) => {
    const last = await ComplaintType.findOne({ companyId }).sort({ sortOrder: -1 }).select('sortOrder').lean();
    return (last?.sortOrder || 0) + 1;
};

const fail = (res, error, fallback) => {
    if (error.code === 11000) return res.status(409).json({ message: 'This Type of Complaint already exists.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error(`${fallback}:`, error);
    return res.status(500).json({ message: fallback });
};

exports.getAll = async (req, res) => {
    try {
        const types = await ComplaintType.find({ companyId: req.user?.companyId })
            .select('name details status sortOrder')
            .sort({ sortOrder: 1, createdAt: 1 })
            .lean();
        return res.json(types);
    } catch (error) {
        return fail(res, error, 'Failed to load complaint types');
    }
};

exports.create = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const name = clean(req.body?.name);
        const details = uniqueDetails(req.body?.details);
        checkLengths(name, details);
        if (await ComplaintType.exists({ companyId, nameKey: keyOf(name) })) throw httpError(409, 'This Type of Complaint already exists.');
        const type = await ComplaintType.create({
            companyId, name, nameKey: keyOf(name), details, status: statusOf(req.body?.status), sortOrder: await nextSortOrder(companyId)
        });
        return res.status(201).json(type);
    } catch (error) {
        return fail(res, error, 'Failed to add the complaint type');
    }
};

exports.update = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const type = await ComplaintType.findOne({ _id: req.params.id, companyId });
        if (!type) throw httpError(404, 'Complaint type not found.');
        const name = clean(req.body?.name);
        const details = uniqueDetails(req.body?.details);
        checkLengths(name, details);
        if (await ComplaintType.exists({ companyId, nameKey: keyOf(name), _id: { $ne: type._id } })) {
            throw httpError(409, 'This Type of Complaint already exists.');
        }
        Object.assign(type, { name, nameKey: keyOf(name), details, status: statusOf(req.body?.status) });
        await type.save();
        return res.json(type);
    } catch (error) {
        return fail(res, error, 'Failed to save the complaint type');
    }
};

exports.remove = async (req, res) => {
    try {
        const type = await ComplaintType.findOneAndDelete({ _id: req.params.id, companyId: req.user?.companyId });
        if (!type) throw httpError(404, 'Complaint type not found.');
        return res.json({ message: 'Complaint type deleted' });
    } catch (error) {
        return fail(res, error, 'Failed to delete the complaint type');
    }
};

/**
 * The Excel upload: rows of { type, detail }, read in the browser. New types and new details are
 * added in the order of the file; nothing is changed or removed, so uploading again is safe.
 */
exports.bulkAdd = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        if (!rows.length) throw httpError(400, 'The file has no complaint types.');
        if (rows.length > MAX_UPLOAD_ROWS) throw httpError(400, `The file can have at most ${MAX_UPLOAD_ROWS} rows.`);

        const wanted = new Map();
        rows.forEach((row) => {
            const name = clean(row?.type);
            if (!name) return;
            const entry = wanted.get(keyOf(name)) || { name, details: [] };
            entry.details.push(row?.detail);
            wanted.set(keyOf(name), entry);
        });
        if (!wanted.size) throw httpError(400, 'The file has no complaint types.');
        wanted.forEach((entry) => {
            entry.details = uniqueDetails(entry.details);
            checkLengths(entry.name, entry.details);
        });

        const existing = await ComplaintType.find({ companyId, nameKey: { $in: [...wanted.keys()] } });
        const byKey = new Map(existing.map((type) => [type.nameKey, type]));
        let sortOrder = await nextSortOrder(companyId);
        const result = { typesAdded: 0, typesUpdated: 0, detailsAdded: 0 };

        for (const [key, entry] of wanted) {
            const type = byKey.get(key);
            if (!type) {
                await ComplaintType.create({ companyId, name: entry.name, nameKey: key, details: entry.details, sortOrder });
                sortOrder += 1;
                result.typesAdded += 1;
                result.detailsAdded += entry.details.length;
            } else {
                const merged = uniqueDetails([...type.details, ...entry.details]);
                const added = merged.length - type.details.length;
                if (added) {
                    checkLengths(type.name, merged);
                    type.details = merged;
                    await type.save();
                    result.typesUpdated += 1;
                    result.detailsAdded += added;
                }
            }
        }
        return res.json(result);
    } catch (error) {
        return fail(res, error, 'Failed to upload the complaint types');
    }
};
