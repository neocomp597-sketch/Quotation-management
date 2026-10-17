const mongoose = require('mongoose');
const TypeTest = require('../models/TypeTest');
const { formatDate } = require('../utils/dateFormat');
const { normalizeLeadDays, buildReminders, startOfDay, DAY_MS } = require('../utils/typeTestReminders');

const POPULATE = [
    { path: 'productId', select: 'productName productCode brand status' },
    { path: 'ownerId', select: 'name email' },
    { path: 'backupOwnerId', select: 'name email' }
];

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

const optionalId = (value) => (value && mongoose.Types.ObjectId.isValid(value) ? value : null);

const daysToExpiry = (record) => {
    const validUntil = record.currentCertificate?.validUntil;
    if (!validUntil) return null;
    return Math.ceil((startOfDay(validUntil) - startOfDay(new Date())) / DAY_MS);
};

const withComputed = (record) => {
    const obj = record.toObject ? record.toObject() : record;
    const nextReminder = (obj.reminders || [])
        .filter(r => !r.sentAt)
        .sort((a, b) => new Date(a.remindOn) - new Date(b.remindOn))[0];
    return { ...obj, daysToExpiry: daysToExpiry(obj), nextReminderOn: nextReminder?.remindOn || null };
};

const loadRecord = (id) => TypeTest.findById(id).populate(POPULATE);

const sendRecord = async (res, id, status = 200) => {
    const record = await TypeTest.findById(id).populate(POPULATE).lean();
    res.status(status).json(withComputed(record));
};

const certificateFromBody = (req) => {
    const body = req.body || {};
    return {
        certificateNo: String(body.certificateNo || '').trim(),
        documentUrl: String(body.documentUrl || '').trim(),
        testingAgency: String(body.testingAgency || '').trim(),
        testCompletionDate: toDate(body.testCompletionDate),
        validUntil: toDate(body.validUntil),
        remarks: String(body.certificateRemarks || body.remarks || '').trim(),
        uploadedBy: req.user?.id,
        uploadedAt: new Date()
    };
};

const validateCertificate = (cert) => {
    if (!cert.certificateNo) return 'Certificate number is required.';
    if (!cert.testCompletionDate) return 'Test completion date is required.';
    if (!cert.validUntil) return 'Valid until date is required.';
    if (cert.validUntil <= cert.testCompletionDate) return 'Valid until date must be after the test completion date.';
    return null;
};

/**
 * Makes `cert` the current certificate. Any previous certificate is closed and kept in the
 * history, reminders are recalculated from the new validity date, and the record goes back
 * to Valid with the renewal cycle reset.
 */
const applyCertificate = (record, cert, req, closeReason) => {
    if (record.currentCertificate?.certificateNo || record.currentCertificate?.validUntil) {
        const old = record.currentCertificate.toObject ? record.currentCertificate.toObject() : record.currentCertificate;
        record.certificateHistory.push({ ...old, closedAt: new Date(), closedBy: req.user?.id, closeReason });
        record.activities.push(activity(req, `Old certificate ${old.certificateNo || ''} closed`.replace(/\s+/g, ' '), closeReason));
    }

    record.currentCertificate = cert;
    if (cert.testingAgency) record.testingAgency = cert.testingAgency;
    record.reminders = buildReminders(cert.validUntil, record.reminderLeadDays);
    record.expiryNotifiedAt = null;

    const expired = startOfDay(cert.validUntil) < startOfDay(new Date());
    record.status = expired ? 'Expired' : 'Valid';
    record.renewalStatus = expired ? 'Due' : 'Not Due';
    record.nextAction = '';
    record.nextActionDate = null;
    record.activities.push(activity(
        req,
        `Certificate ${cert.certificateNo} recorded (tested ${formatDate(cert.testCompletionDate)}, valid until ${formatDate(cert.validUntil)})`,
        cert.remarks
    ));
};

// Create a type test record for a product / model
exports.createTypeTest = async (req, res) => {
    try {
        const body = req.body || {};
        if (!body.productId) return res.status(400).json({ message: 'Product is required.' });

        const modelName = String(body.modelName || '').trim();
        const exists = await TypeTest.findOne({ productId: body.productId, modelName });
        if (exists) {
            return res.status(400).json({ message: 'A type test record already exists for this product / model.' });
        }

        const record = new TypeTest({
            productId: body.productId,
            modelName,
            testName: String(body.testName || '').trim() || 'Type Test',
            testStandard: body.testStandard,
            testingAgency: body.testingAgency,
            status: body.status && body.status !== 'Valid' ? body.status : 'Not Started',
            ownerId: optionalId(body.ownerId) || req.user?.id,
            backupOwnerId: optionalId(body.backupOwnerId),
            reminderLeadDays: normalizeLeadDays(body.reminderLeadDays),
            nextAction: body.nextAction,
            nextActionDate: toDate(body.nextActionDate),
            remarks: body.remarks,
            createdBy: req.user?.id,
            activities: [activity(req, 'Type test record created')]
        });

        // A certificate can be recorded straight away when the product was already tested.
        if (body.certificateNo || body.validUntil) {
            const cert = certificateFromBody(req);
            const error = validateCertificate(cert);
            if (error) return res.status(400).json({ message: error });
            applyCertificate(record, cert, req);
        }

        await record.save();
        await sendRecord(res, record._id, 201);
    } catch (err) {
        console.error('[TypeTest Create Error]', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'A type test record already exists for this product / model.' });
        }
        res.status(400).json({ message: err.message });
    }
};

// List type test records
exports.getTypeTests = async (req, res) => {
    try {
        const { search, status, renewalStatus, ownerId, productId, active, expiringWithin } = req.query;
        const query = {};

        if (status) query.status = status;
        if (renewalStatus) query.renewalStatus = renewalStatus;
        if (productId) query.productId = productId;
        if (ownerId) query.$or = [{ ownerId }, { backupOwnerId: ownerId }];
        if (active === 'true') query.isActive = true;
        if (active === 'false') query.isActive = false;

        if (expiringWithin) {
            const days = Number(expiringWithin);
            if (Number.isFinite(days) && days > 0) {
                const today = startOfDay(new Date());
                query['currentCertificate.validUntil'] = { $gte: today, $lte: new Date(today.getTime() + days * DAY_MS) };
            }
        }

        let records = await TypeTest.find(query)
            .populate(POPULATE)
            .sort({ isActive: -1, 'currentCertificate.validUntil': 1, createdAt: -1 })
            .lean();

        if (search) {
            const needle = String(search).trim().toLowerCase();
            records = records.filter(r => [
                r.productId?.productName, r.productId?.productCode, r.modelName, r.testName,
                r.testStandard, r.testingAgency, r.currentCertificate?.certificateNo
            ].some(v => String(v || '').toLowerCase().includes(needle)));
        }

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
            .populate('certificateHistory.uploadedBy', 'name')
            .populate('certificateHistory.closedBy', 'name')
            .populate('currentCertificate.uploadedBy', 'name')
            .lean();
        if (!record) return res.status(404).json({ message: 'Type test record not found' });
        res.json(withComputed(record));
    } catch (err) {
        console.error('[TypeTest Fetch ID Error]', err);
        res.status(500).json({ message: err.message });
    }
};

// Update general details: owners, lead times, status, next action
exports.updateTypeTest = async (req, res) => {
    try {
        const record = await loadRecord(req.params.id);
        if (!record) return res.status(404).json({ message: 'Type test record not found' });
        const body = req.body || {};
        const logs = [];

        ['modelName', 'testName', 'testStandard', 'testingAgency', 'nextAction', 'remarks'].forEach(field => {
            if (body[field] !== undefined) record[field] = String(body[field] || '').trim();
        });
        if (body.productId) record.productId = body.productId;
        if (body.nextActionDate !== undefined) record.nextActionDate = toDate(body.nextActionDate);

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
                logs.push(`Renewal lead times set to ${leadDays.join(' / ')} days`);
            }
        }

        if (body.status && body.status !== record.status) {
            if (!TypeTest.TYPE_TEST_STATUSES.includes(body.status)) {
                return res.status(400).json({ message: `Invalid status "${body.status}"` });
            }
            if (body.status === 'Valid' && !record.currentCertificate?.validUntil) {
                return res.status(400).json({ message: 'Record a certificate before marking the type test as Valid.' });
            }
            logs.push(`Status changed from "${record.status}" to "${body.status}"`);
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
        if (err.code === 11000) {
            return res.status(400).json({ message: 'A type test record already exists for this product / model.' });
        }
        res.status(400).json({ message: err.message });
    }
};

// Step 1 / 4: record a completed test with its certificate. Closes the previous certificate.
exports.recordCertificate = async (req, res) => {
    try {
        const record = await loadRecord(req.params.id);
        if (!record) return res.status(404).json({ message: 'Type test record not found' });

        const cert = certificateFromBody(req);
        const error = validateCertificate(cert);
        if (error) return res.status(400).json({ message: error });

        const isRenewal = Boolean(record.currentCertificate?.validUntil);
        applyCertificate(record, cert, req, isRenewal ? `Superseded by certificate ${cert.certificateNo}` : '');
        if (isRenewal) record.renewalStatus = 'Completed';

        await record.save();
        await sendRecord(res, record._id);
    } catch (err) {
        console.error('[TypeTest Certificate Error]', err);
        res.status(400).json({ message: err.message });
    }
};

// Step 3: owner starts the renewal
exports.startRenewal = async (req, res) => {
    try {
        const record = await loadRecord(req.params.id);
        if (!record) return res.status(404).json({ message: 'Type test record not found' });
        if (!record.isActive) return res.status(400).json({ message: 'Reactivate this record before starting a renewal.' });

        const body = req.body || {};
        record.status = record.currentCertificate?.validUntil ? 'Renewal In Progress' : 'In Progress';
        record.renewalStatus = 'Initiated';
        if (body.nextAction !== undefined) record.nextAction = String(body.nextAction || '').trim();
        if (body.nextActionDate !== undefined) record.nextActionDate = toDate(body.nextActionDate);
        record.activities.push(activity(req, record.currentCertificate?.validUntil ? 'Renewal started' : 'Testing started', body.note));

        await record.save();
        await sendRecord(res, record._id);
    } catch (err) {
        console.error('[TypeTest Renewal Error]', err);
        res.status(400).json({ message: err.message });
    }
};

// Step 3: record renewal progress
exports.recordProgress = async (req, res) => {
    try {
        const record = await loadRecord(req.params.id);
        if (!record) return res.status(404).json({ message: 'Type test record not found' });

        const body = req.body || {};
        const note = String(body.note || '').trim();
        if (!note && !body.renewalStatus && body.nextAction === undefined) {
            return res.status(400).json({ message: 'Add a progress note, renewal status or next action.' });
        }

        const parts = [];
        if (body.renewalStatus && body.renewalStatus !== record.renewalStatus) {
            if (!TypeTest.RENEWAL_STATUSES.includes(body.renewalStatus)) {
                return res.status(400).json({ message: `Invalid renewal status "${body.renewalStatus}"` });
            }
            parts.push(`Renewal status: ${body.renewalStatus}`);
            record.renewalStatus = body.renewalStatus;
            if (['Initiated', 'Testing Scheduled', 'Testing In Progress', 'Awaiting Certificate'].includes(body.renewalStatus)
                && !['In Progress', 'Renewal In Progress'].includes(record.status)) {
                record.status = record.currentCertificate?.validUntil ? 'Renewal In Progress' : 'In Progress';
            }
        }
        if (body.nextAction !== undefined) {
            record.nextAction = String(body.nextAction || '').trim();
            if (record.nextAction) parts.push(`Next action: ${record.nextAction}`);
        }
        if (body.nextActionDate !== undefined) record.nextActionDate = toDate(body.nextActionDate);

        record.activities.push(activity(req, parts.length ? parts.join(' | ') : 'Progress update', note));
        await record.save();
        await sendRecord(res, record._id);
    } catch (err) {
        console.error('[TypeTest Progress Error]', err);
        res.status(400).json({ message: err.message });
    }
};

// Step 5: discontinued products stop generating reminders
exports.setActive = async (req, res) => {
    try {
        const record = await loadRecord(req.params.id);
        if (!record) return res.status(404).json({ message: 'Type test record not found' });

        const isActive = Boolean(req.body?.isActive);
        const reason = String(req.body?.reason || '').trim();
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

// KPI summary for the register header
exports.getTypeTestSummary = async (req, res) => {
    try {
        const records = await TypeTest.find({})
            .select('status isActive renewalStatus currentCertificate.validUntil')
            .lean();
        const today = startOfDay(new Date());
        const within = (r, days) => {
            const v = r.currentCertificate?.validUntil;
            if (!v) return false;
            const d = startOfDay(v);
            return d >= today && d <= new Date(today.getTime() + days * DAY_MS);
        };

        const active = records.filter(r => r.isActive);
        const byStatus = TypeTest.TYPE_TEST_STATUSES.reduce((acc, s) => {
            acc[s] = active.filter(r => r.status === s).length;
            return acc;
        }, {});

        res.json({
            total: records.length,
            active: active.length,
            inactive: records.length - active.length,
            byStatus,
            expiringIn30: active.filter(r => within(r, 30)).length,
            expiringIn90: active.filter(r => within(r, 90)).length,
            expiringIn180: active.filter(r => within(r, 180)).length,
            pastExpiry: active.filter(r => r.currentCertificate?.validUntil && startOfDay(r.currentCertificate.validUntil) < today).length
        });
    } catch (err) {
        console.error('[TypeTest Summary Error]', err);
        res.status(500).json({ message: err.message });
    }
};
