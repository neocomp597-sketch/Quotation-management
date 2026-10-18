const mongoose = require('mongoose');
const TypeTest = require('../models/TypeTest');
const { formatDate } = require('../utils/dateFormat');
const { normalizeLeadDays, buildReminders, startOfDay, DAY_MS } = require('../utils/typeTestReminders');

const POPULATE = [
    { path: 'productId', select: 'productName productCode brand status' },
    { path: 'ownerId', select: 'name email' },
    { path: 'backupOwnerId', select: 'name email' }
];

const CERT_FIELDS = ['certificateNo', 'documentUrl', 'issueDate', 'testCompletionDate', 'validUntil'];
const DUPLICATE_MESSAGE = 'This test is already recorded for this product / model.';

const activity = (req, action, note = '') => ({
    userId: req.user?.id,
    userName: req.user?.name || 'System',
    action,
    note
});

const toDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

const sameDay = (a, b) => (a ? startOfDay(a).getTime() : null) === (b ? startOfDay(b).getTime() : null);
const optionalId = (value) => (value && mongoose.Types.ObjectId.isValid(value) ? value : null);
const text = (value) => String(value ?? '').trim();

const daysToExpiry = (record) => {
    const validUntil = record.currentCertificate?.validUntil;
    if (!validUntil) return null;
    return Math.ceil((startOfDay(validUntil) - startOfDay(new Date())) / DAY_MS);
};

// Status as it should read today, even before the scheduler has caught up.
const displayStatus = (r, days) => {
    if (!r.isActive) return 'Inactive';
    if (['Not Started', 'In Progress', 'Renewal In Progress'].includes(r.status)) return r.status;
    if (days !== null && days < 0) return 'Expired';
    if (days !== null) return 'Valid';
    return r.status;
};

const renewalState = (r, days) => {
    if (!r.isActive) return 'Inactive';
    if (['In Progress', 'Submitted'].includes(r.renewalStatus)) return r.renewalStatus;
    if (days !== null && days < 0) return 'Overdue';
    if (r.renewalStatus === 'Renewed') return 'Renewed';
    if (days !== null && days <= 90) return 'Upcoming';
    return r.renewalStatus || 'Not Due';
};

const withComputed = (record) => {
    const obj = record.toObject ? record.toObject() : record;
    const days = daysToExpiry(obj);
    const pending = (obj.reminders || [])
        .filter(r => !r.sentAt)
        .sort((a, b) => new Date(a.remindOn) - new Date(b.remindOn))[0];
    return {
        ...obj,
        daysToExpiry: days,
        nextReminder: pending ? { leadDays: pending.leadDays, remindOn: pending.remindOn } : null,
        displayStatus: displayStatus(obj, days),
        renewalState: renewalState(obj, days)
    };
};

const loadRecord = (id) => TypeTest.findById(id).populate(POPULATE);

const sendRecord = async (res, id, status = 200) => {
    const record = await TypeTest.findById(id).populate(POPULATE).lean();
    res.status(status).json(withComputed(record));
};

const certificateFromBody = (req) => {
    const body = req.body || {};
    return {
        certificateNo: text(body.certificateNo),
        documentUrl: text(body.documentUrl),
        testingAgency: text(body.testingAgency),
        issueDate: toDate(body.issueDate),
        testCompletionDate: toDate(body.testCompletionDate),
        validUntil: toDate(body.validUntil),
        remarks: text(body.certificateRemarks || body.remarks),
        uploadedBy: req.user?.id,
        uploadedAt: new Date()
    };
};

const validateCertificate = (cert) => {
    if (!cert.certificateNo) return 'Certificate number is required.';
    if (!cert.validUntil) return 'Valid until date is required.';
    const from = cert.issueDate || cert.testCompletionDate;
    if (from && cert.validUntil <= from) return 'Valid until date must be after the issue / completion date.';
    return null;
};

const statusForValidity = (validUntil) => (startOfDay(validUntil) < startOfDay(new Date()) ? 'Expired' : 'Valid');

/**
 * Makes `cert` the current certificate. Any previous certificate is closed and kept in the
 * history, reminders are recalculated from the new validity date and the renewal cycle resets.
 */
const applyCertificate = (record, cert, req, closeReason) => {
    if (record.currentCertificate?.certificateNo || record.currentCertificate?.validUntil) {
        const old = record.currentCertificate.toObject ? record.currentCertificate.toObject() : record.currentCertificate;
        record.certificateHistory.push({ ...old, closedAt: new Date(), closedBy: req.user?.id, closeReason });
        record.activities.push(activity(req, `Old certificate ${old.certificateNo || ''} closed`.replace(/\s+/g, ' ').trim(), closeReason));
    }

    record.currentCertificate = cert;
    if (cert.testingAgency) record.testingAgency = cert.testingAgency;
    record.reminders = buildReminders(cert.validUntil, record.reminderLeadDays);
    record.expiryNotifiedAt = null;
    record.status = statusForValidity(cert.validUntil);
    record.renewalStatus = record.status === 'Expired' ? 'Overdue' : 'Not Due';
    record.activities.push(activity(
        req,
        `Certificate ${cert.certificateNo} recorded (valid until ${formatDate(cert.validUntil)})`,
        cert.remarks
    ));
};

const applyCommonFields = (record, body) => {
    ['modelName', 'testName', 'testStandard', 'testingAgency', 'nextAction', 'remarks'].forEach(field => {
        if (body[field] !== undefined) record[field] = text(body[field]);
    });
    if (record.testName === '') record.testName = 'Type Test';
    if (body.testResult !== undefined && TypeTest.TEST_RESULTS.includes(body.testResult)) record.testResult = body.testResult;
    if (body.testStartDate !== undefined) record.testStartDate = toDate(body.testStartDate);
    if (body.nextActionDate !== undefined) record.nextActionDate = toDate(body.nextActionDate);
};

const isDuplicateKey = (err) => err?.code === 11000;

// Create a type test record for a product / model
exports.createTypeTest = async (req, res) => {
    try {
        const body = req.body || {};
        if (!body.productId) return res.status(400).json({ message: 'Product is required.' });
        if (!optionalId(body.ownerId) && !req.user?.id) return res.status(400).json({ message: 'Renewal owner is required.' });

        const record = new TypeTest({
            productId: body.productId,
            ownerId: optionalId(body.ownerId) || req.user?.id,
            backupOwnerId: optionalId(body.backupOwnerId),
            reminderLeadDays: normalizeLeadDays(body.reminderLeadDays),
            createdBy: req.user?.id,
            activities: [activity(req, 'Type test record created')]
        });
        applyCommonFields(record, body);
        if (body.status && TypeTest.TYPE_TEST_STATUSES.includes(body.status) && !['Valid', 'Expired'].includes(body.status)) {
            record.status = body.status;
        }
        if (body.renewalStatus && TypeTest.RENEWAL_STATUSES.includes(body.renewalStatus)) {
            record.renewalStatus = body.renewalStatus;
        }

        const exists = await TypeTest.findOne({ productId: record.productId, modelName: record.modelName, testName: record.testName });
        if (exists) return res.status(400).json({ message: DUPLICATE_MESSAGE });

        // A certificate can be recorded straight away when the product was already tested.
        if (text(body.certificateNo) || body.validUntil) {
            const cert = certificateFromBody(req);
            const error = validateCertificate(cert);
            if (error) return res.status(400).json({ message: error });
            const keepRenewal = record.renewalStatus;
            const keepStatus = record.status;
            applyCertificate(record, cert, req);
            // An explicit in-progress choice on the form wins over the derived values.
            if (['In Progress', 'Submitted'].includes(keepRenewal)) record.renewalStatus = keepRenewal;
            if (keepStatus === 'Renewal In Progress') record.status = keepStatus;
        }

        await record.save();
        await sendRecord(res, record._id, 201);
    } catch (err) {
        console.error('[TypeTest Create Error]', err);
        if (isDuplicateKey(err)) return res.status(400).json({ message: DUPLICATE_MESSAGE });
        res.status(400).json({ message: err.message });
    }
};

// List type test records
exports.getTypeTests = async (req, res) => {
    try {
        const { status, ownerId, productId, active } = req.query;
        const query = {};
        if (status) query.status = status;
        if (productId) query.productId = productId;
        if (ownerId) query.$or = [{ ownerId }, { backupOwnerId: ownerId }];
        if (active === 'true') query.isActive = true;
        if (active === 'false') query.isActive = false;

        const records = await TypeTest.find(query)
            .populate(POPULATE)
            .sort({ 'currentCertificate.validUntil': 1, createdAt: -1 })
            .lean();

        res.json(records.map(withComputed));
    } catch (err) {
        console.error('[TypeTest Fetch Error]', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getTypeTestById = async (req, res) => {
    try {
        const record = await TypeTest.findById(req.params.id)
            .populate(POPULATE)
            .populate('certificateHistory.closedBy', 'name')
            .lean();
        if (!record) return res.status(404).json({ message: 'Type test record not found' });
        res.json(withComputed(record));
    } catch (err) {
        console.error('[TypeTest Fetch ID Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// Edit a record. Certificate fields edited here correct the current certificate in place;
// a renewal (new certificate replacing the old one) goes through recordCertificate.
exports.updateTypeTest = async (req, res) => {
    try {
        const record = await loadRecord(req.params.id);
        if (!record) return res.status(404).json({ message: 'Type test record not found' });
        const body = req.body || {};
        const logs = [];

        if (body.productId) record.productId = body.productId;
        applyCommonFields(record, body);

        if (body.ownerId && String(body.ownerId) !== String(record.ownerId?._id || record.ownerId)) {
            record.ownerId = body.ownerId;
            logs.push('Owner changed');
        }
        if (body.backupOwnerId !== undefined) {
            const next = optionalId(body.backupOwnerId);
            if (String(next || '') !== String(record.backupOwnerId?._id || record.backupOwnerId || '')) {
                record.backupOwnerId = next;
                logs.push('Backup owner changed');
            }
        }

        if (body.reminderLeadDays !== undefined) {
            const leadDays = normalizeLeadDays(body.reminderLeadDays);
            if (leadDays.join(',') !== (record.reminderLeadDays || []).join(',')) {
                record.reminderLeadDays = leadDays;
                record.reminders = buildReminders(record.currentCertificate?.validUntil, leadDays, record.reminders);
                logs.push(`Reminder lead times set to ${leadDays.join(' / ')} days`);
            }
        }

        // Certificate details
        const certTouched = CERT_FIELDS.some(f => body[f] !== undefined);
        if (certTouched) {
            const incoming = certificateFromBody(req);
            const current = record.currentCertificate;
            if (!current?.validUntil) {
                if (incoming.certificateNo || incoming.validUntil) {
                    const error = validateCertificate(incoming);
                    if (error) return res.status(400).json({ message: error });
                    applyCertificate(record, incoming, req);
                }
            } else {
                const changed = incoming.certificateNo !== (current.certificateNo || '')
                    || incoming.documentUrl !== (current.documentUrl || '')
                    || !sameDay(incoming.issueDate, current.issueDate)
                    || !sameDay(incoming.testCompletionDate, current.testCompletionDate)
                    || !sameDay(incoming.validUntil, current.validUntil);
                if (changed) {
                    const error = validateCertificate(incoming);
                    if (error) return res.status(400).json({ message: error });
                    const validityChanged = !sameDay(incoming.validUntil, current.validUntil);
                    current.certificateNo = incoming.certificateNo;
                    current.documentUrl = incoming.documentUrl;
                    current.issueDate = incoming.issueDate;
                    current.testCompletionDate = incoming.testCompletionDate;
                    current.validUntil = incoming.validUntil;
                    if (validityChanged) {
                        record.reminders = buildReminders(incoming.validUntil, record.reminderLeadDays, record.reminders);
                        record.expiryNotifiedAt = null;
                        if (['Valid', 'Expired'].includes(record.status)) record.status = statusForValidity(incoming.validUntil);
                    }
                    logs.push('Certificate details corrected');
                }
            }
        }

        if (body.status && body.status !== record.status) {
            if (!TypeTest.TYPE_TEST_STATUSES.includes(body.status)) {
                return res.status(400).json({ message: `Invalid status "${body.status}"` });
            }
            if (body.status === 'Valid' && !record.currentCertificate?.validUntil) {
                return res.status(400).json({ message: 'Record a certificate before marking the test as Valid.' });
            }
            logs.push(`Test status changed from "${record.status}" to "${body.status}"`);
            record.status = body.status;
        }

        if (body.renewalStatus && body.renewalStatus !== record.renewalStatus) {
            if (!TypeTest.RENEWAL_STATUSES.includes(body.renewalStatus)) {
                return res.status(400).json({ message: `Invalid renewal status "${body.renewalStatus}"` });
            }
            logs.push(`Renewal status changed from "${record.renewalStatus}" to "${body.renewalStatus}"`);
            record.renewalStatus = body.renewalStatus;
        }

        record.activities.push(...(logs.length ? logs : ['Details updated']).map(a => activity(req, a)));
        await record.save();
        await sendRecord(res, record._id);
    } catch (err) {
        console.error('[TypeTest Update Error]', err);
        if (isDuplicateKey(err)) return res.status(400).json({ message: DUPLICATE_MESSAGE });
        res.status(400).json({ message: err.message });
    }
};

// Record a completed test / renewed certificate. Closes the previous certificate.
exports.recordCertificate = async (req, res) => {
    try {
        const record = await loadRecord(req.params.id);
        if (!record) return res.status(404).json({ message: 'Type test record not found' });

        const cert = certificateFromBody(req);
        const error = validateCertificate(cert);
        if (error) return res.status(400).json({ message: error });

        const isRenewal = Boolean(record.currentCertificate?.validUntil);
        applyCertificate(record, cert, req, isRenewal ? `Superseded by certificate ${cert.certificateNo}` : '');
        if (isRenewal && record.status === 'Valid') record.renewalStatus = 'Renewed';
        if (req.body?.testResult && TypeTest.TEST_RESULTS.includes(req.body.testResult)) record.testResult = req.body.testResult;

        await record.save();
        await sendRecord(res, record._id);
    } catch (err) {
        console.error('[TypeTest Certificate Error]', err);
        res.status(400).json({ message: err.message });
    }
};

// Owner starts the renewal (or the first test)
exports.startRenewal = async (req, res) => {
    try {
        const record = await loadRecord(req.params.id);
        if (!record) return res.status(404).json({ message: 'Type test record not found' });
        if (!record.isActive) return res.status(400).json({ message: 'Reactivate this record before starting a renewal.' });

        const body = req.body || {};
        const hasCert = Boolean(record.currentCertificate?.validUntil);
        record.status = hasCert ? 'Renewal In Progress' : 'In Progress';
        record.renewalStatus = 'In Progress';
        if (body.nextAction !== undefined) record.nextAction = text(body.nextAction);
        if (body.nextActionDate !== undefined) record.nextActionDate = toDate(body.nextActionDate);
        record.activities.push(activity(req, hasCert ? 'Renewal started' : 'Testing started', body.note));

        await record.save();
        await sendRecord(res, record._id);
    } catch (err) {
        console.error('[TypeTest Renewal Error]', err);
        res.status(400).json({ message: err.message });
    }
};

// Renewal progress: status, next action and notes
exports.recordProgress = async (req, res) => {
    try {
        const record = await loadRecord(req.params.id);
        if (!record) return res.status(404).json({ message: 'Type test record not found' });

        const body = req.body || {};
        const note = text(body.note);
        const parts = [];

        if (body.renewalStatus && body.renewalStatus !== record.renewalStatus) {
            if (!TypeTest.RENEWAL_STATUSES.includes(body.renewalStatus)) {
                return res.status(400).json({ message: `Invalid renewal status "${body.renewalStatus}"` });
            }
            if (body.renewalStatus === 'Renewed') {
                return res.status(400).json({ message: 'Enter the new certificate number and valid-until date to mark the renewal complete.' });
            }
            parts.push(`Renewal status: ${body.renewalStatus}`);
            record.renewalStatus = body.renewalStatus;
            if (['In Progress', 'Submitted'].includes(body.renewalStatus) && !['In Progress', 'Renewal In Progress'].includes(record.status)) {
                record.status = record.currentCertificate?.validUntil ? 'Renewal In Progress' : 'In Progress';
            }
        }
        if (body.nextAction !== undefined && text(body.nextAction) !== (record.nextAction || '')) {
            record.nextAction = text(body.nextAction);
            if (record.nextAction) parts.push(`Next action: ${record.nextAction}`);
        }
        if (body.nextActionDate !== undefined) record.nextActionDate = toDate(body.nextActionDate);
        if (body.documentUrl && record.currentCertificate) {
            record.currentCertificate.documentUrl = text(body.documentUrl);
            parts.push('Certificate document replaced');
        }

        if (!note && !parts.length && body.nextActionDate === undefined) {
            return res.status(400).json({ message: 'Nothing to update.' });
        }
        record.activities.push(activity(req, parts.length ? parts.join(' | ') : 'Progress update', note));
        await record.save();
        await sendRecord(res, record._id);
    } catch (err) {
        console.error('[TypeTest Progress Error]', err);
        res.status(400).json({ message: err.message });
    }
};

// Discontinued products stop generating reminders
exports.setActive = async (req, res) => {
    try {
        const record = await loadRecord(req.params.id);
        if (!record) return res.status(404).json({ message: 'Type test record not found' });

        const isActive = Boolean(req.body?.isActive);
        const reason = text(req.body?.reason);
        if (record.isActive === isActive) return sendRecord(res, record._id);

        record.isActive = isActive;
        if (isActive) {
            record.inactiveReason = '';
            record.inactiveAt = null;
            record.reminders = buildReminders(record.currentCertificate?.validUntil, record.reminderLeadDays, record.reminders);
            record.activities.push(activity(req, 'Record reactivated', reason));
        } else {
            record.inactiveReason = reason || 'Product discontinued';
            record.inactiveAt = new Date();
            record.activities.push(activity(req, 'Marked inactive - reminders stopped', record.inactiveReason));
        }

        await record.save();
        await sendRecord(res, record._id);
    } catch (err) {
        console.error('[TypeTest Active Error]', err);
        res.status(400).json({ message: err.message });
    }
};

exports.deleteTypeTest = async (req, res) => {
    try {
        const result = await TypeTest.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ message: 'Type test record not found' });
        res.json({ message: 'Type test record deleted successfully' });
    } catch (err) {
        console.error('[TypeTest Delete Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// Dashboard counts (inactive products excluded, as on the portal dashboard)
exports.getTypeTestSummary = async (req, res) => {
    try {
        const records = (await TypeTest.find({})
            .select('status isActive renewalStatus currentCertificate.validUntil')
            .lean()).map(withComputed);
        const active = records.filter(r => r.isActive);

        res.json({
            total: records.length,
            active: active.length,
            inactive: records.length - active.length,
            valid: active.filter(r => r.displayStatus === 'Valid').length,
            dueIn90: active.filter(r => r.daysToExpiry !== null && r.daysToExpiry <= 90).length,
            expired: active.filter(r => r.displayStatus === 'Expired').length,
            pipeline: TypeTest.TYPE_TEST_STATUSES.map(s => ({ status: s, count: active.filter(r => r.displayStatus === s).length }))
        });
    } catch (err) {
        console.error('[TypeTest Summary Error]', err);
        res.status(500).json({ message: err.message });
    }
};
