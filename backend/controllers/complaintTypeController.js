const mongoose = require('mongoose');
const ComplaintType = require('../models/ComplaintType');

// CSM Config > Complaint Types: each Type of Complaint and, added one at a time, its Details of
// Complaint, for the ticket forms. Each detail is changed on its own, so two people working on the
// same type do not overwrite each other.

const MAX_TEXT_LENGTH = 200;
const MAX_DETAILS_PER_TYPE = 500;

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const keyOf = (value) => clean(value).toLowerCase();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sameText = (value) => new RegExp(`^${escapeRegex(value)}$`, 'i');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const cleanName = (value) => {
    const name = clean(value);
    if (!name) throw httpError(400, 'Type of Complaint is required.');
    if (name.length > MAX_TEXT_LENGTH) throw httpError(400, `Type of Complaint can be at most ${MAX_TEXT_LENGTH} characters.`);
    return name;
};

const cleanDetail = (value) => {
    const detail = clean(value);
    if (!detail) throw httpError(400, 'Enter the Details of Complaint.');
    if (detail.length > MAX_TEXT_LENGTH) throw httpError(400, `Details of Complaint can be at most ${MAX_TEXT_LENGTH} characters.`);
    return detail;
};

const statusOf = (value) => (value === 'Inactive' ? 'Inactive' : 'Active');

const typeFilter = (req) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw httpError(404, 'Complaint type not found.');
    return { _id: req.params.id, companyId: req.user?.companyId };
};

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
        const name = cleanName(req.body?.name);
        if (await ComplaintType.exists({ companyId, nameKey: keyOf(name) })) throw httpError(409, 'This Type of Complaint already exists.');
        const type = await ComplaintType.create({
            companyId, name, nameKey: keyOf(name), details: [], status: statusOf(req.body?.status), sortOrder: await nextSortOrder(companyId)
        });
        return res.status(201).json(type);
    } catch (error) {
        return fail(res, error, 'Failed to add the complaint type');
    }
};

/** The type's name and status; its details are changed one at a time below. */
exports.update = async (req, res) => {
    try {
        const filter = typeFilter(req);
        const name = cleanName(req.body?.name);
        if (await ComplaintType.exists({ companyId: filter.companyId, nameKey: keyOf(name), _id: { $ne: filter._id } })) {
            throw httpError(409, 'This Type of Complaint already exists.');
        }
        const type = await ComplaintType.findOneAndUpdate(
            filter,
            { $set: { name, nameKey: keyOf(name), status: statusOf(req.body?.status) } },
            { new: true }
        );
        if (!type) throw httpError(404, 'Complaint type not found.');
        return res.json(type);
    } catch (error) {
        return fail(res, error, 'Failed to save the complaint type');
    }
};

exports.remove = async (req, res) => {
    try {
        const type = await ComplaintType.findOneAndDelete(typeFilter(req));
        if (!type) throw httpError(404, 'Complaint type not found.');
        return res.json({ message: 'Complaint type deleted' });
    } catch (error) {
        return fail(res, error, 'Failed to delete the complaint type');
    }
};

// Why a change to a type's details did not apply.
const detailRefusal = async (filter, duplicate) => {
    const type = await ComplaintType.findOne(filter).select('details').lean();
    if (!type) return httpError(404, 'Complaint type not found.');
    if (duplicate && (type.details || []).some((value) => keyOf(value) === keyOf(duplicate))) {
        return httpError(409, 'This detail is already listed under this type.');
    }
    if ((type.details || []).length >= MAX_DETAILS_PER_TYPE) return httpError(400, `A Type of Complaint can have at most ${MAX_DETAILS_PER_TYPE} details.`);
    return httpError(404, 'This detail is no longer listed. Reload the page.');
};

exports.addDetail = async (req, res) => {
    try {
        const filter = typeFilter(req);
        const detail = cleanDetail(req.body?.detail);
        const type = await ComplaintType.findOneAndUpdate(
            { ...filter, details: { $not: sameText(detail) }, [`details.${MAX_DETAILS_PER_TYPE - 1}`]: { $exists: false } },
            { $push: { details: detail } },
            { new: true }
        );
        if (!type) throw await detailRefusal(filter, detail);
        return res.status(201).json(type);
    } catch (error) {
        return fail(res, error, 'Failed to add the detail');
    }
};

exports.updateDetail = async (req, res) => {
    try {
        const filter = typeFilter(req);
        const from = clean(req.body?.from);
        const to = cleanDetail(req.body?.to);
        const conditions = [{ details: from }];
        // Changing only capital letters is allowed; becoming another listed detail is not.
        if (keyOf(from) !== keyOf(to)) conditions.push({ details: { $not: sameText(to) } });
        const type = await ComplaintType.findOneAndUpdate(
            { ...filter, $and: conditions },
            { $set: { 'details.$[entry]': to } },
            { new: true, arrayFilters: [{ entry: from }] }
        );
        if (!type) throw await detailRefusal(filter, keyOf(from) !== keyOf(to) ? to : null);
        return res.json(type);
    } catch (error) {
        return fail(res, error, 'Failed to save the detail');
    }
};

exports.removeDetail = async (req, res) => {
    try {
        const filter = typeFilter(req);
        const detail = clean(req.query?.detail);
        const type = await ComplaintType.findOneAndUpdate({ ...filter, details: detail }, { $pull: { details: detail } }, { new: true });
        if (!type) throw await detailRefusal(filter, null);
        return res.json(type);
    } catch (error) {
        return fail(res, error, 'Failed to delete the detail');
    }
};
