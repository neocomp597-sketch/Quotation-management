const TypeTest = require('../models/TypeTest');
const Notification = require('../models/Notification');
const { formatDate } = require('./dateFormat');
const { runWithTenant } = require('../middlewares/tenantContext');

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (value) => {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
};

const normalizeLeadDays = (leadDays) => {
    const source = Array.isArray(leadDays) ? leadDays : String(leadDays || '').split(',');
    const days = source
        .map(v => Math.round(Number(v)))
        .filter(v => Number.isFinite(v) && v > 0 && v <= 3650);
    const unique = [...new Set(days)].sort((a, b) => b - a);
    return unique.length ? unique : [...TypeTest.DEFAULT_LEAD_DAYS];
};

/**
 * Reminder dates for a certificate: validUntil minus each lead time.
 *
 * Reminders that already fired for the same date are kept as sent. When a certificate is
 * recorded late (e.g. only 60 days of validity left), every lead time that is already past
 * is marked as sent except the nearest one, so the owner gets one reminder now instead of
 * a burst of three.
 */
const buildReminders = (validUntil, leadDays, existing = []) => {
    if (!validUntil) return [];
    const expiry = startOfDay(validUntil);
    const today = startOfDay(new Date());
    const previous = new Map(existing.map(r => [`${r.leadDays}|${startOfDay(r.remindOn).getTime()}`, r]));

    const reminders = normalizeLeadDays(leadDays).map(days => {
        const remindOn = new Date(expiry.getTime() - days * DAY_MS);
        const prior = previous.get(`${days}|${remindOn.getTime()}`);
        return { leadDays: days, remindOn, sentAt: prior?.sentAt || null };
    });

    const pastUnsent = reminders.filter(r => !r.sentAt && r.remindOn <= today);
    // Sorted by lead days descending, so the last past reminder is the nearest to expiry.
    pastUnsent.slice(0, -1).forEach(r => { r.sentAt = new Date(); });

    return reminders;
};

const productLabel = (record) => {
    const p = record.productId || {};
    const name = p.productName || 'Product';
    const code = p.productCode ? ` (${p.productCode})` : '';
    const model = record.modelName ? ` - ${record.modelName}` : '';
    return `${name}${code}${model}`;
};

const notifyOwners = async (record, { title, message, type, dueDate }) => {
    const recipients = [...new Set([record.ownerId, record.backupOwnerId]
        .filter(Boolean)
        .map(id => String(id._id || id)))];

    for (const userId of recipients) {
        await Notification.create({
            userId,
            title,
            message,
            type,
            relatedId: record._id,
            dueDate,
            companyId: record.companyId
        });
    }
    return recipients.length;
};

/**
 * Sends due renewal reminders and flags expired certificates. Runs from the scheduler;
 * inactive (discontinued) records are skipped entirely.
 */
const checkTypeTestReminders = async () => {
    try {
        console.log('[Scheduler] Checking type test renewal reminders...');
        const now = new Date();
        const today = startOfDay(now);

        const records = await TypeTest.find({
            isActive: true,
            'currentCertificate.validUntil': { $ne: null },
            $or: [
                { reminders: { $elemMatch: { sentAt: null, remindOn: { $lte: now } } } },
                { 'currentCertificate.validUntil': { $lt: today }, expiryNotifiedAt: null }
            ]
        }).populate('productId', 'productName productCode');

        for (const record of records) {
            await runWithTenant(record.companyId, async () => {
                const cert = record.currentCertificate;
                const validUntil = startOfDay(cert.validUntil);
                const label = productLabel(record);
                const certNo = cert.certificateNo ? ` ${cert.certificateNo}` : '';

                if (validUntil < today) {
                    if (record.status === 'Valid') record.status = 'Expired';
                    if (!['In Progress', 'Submitted'].includes(record.renewalStatus)) record.renewalStatus = 'Overdue';
                    record.reminders.forEach(r => { if (!r.sentAt) r.sentAt = now; });
                    record.expiryNotifiedAt = now;
                    record.activities.push({ userName: 'System Scheduler', action: `Certificate${certNo} expired on ${formatDate(validUntil)}` });
                    await notifyOwners(record, {
                        title: 'Type Test Certificate Expired',
                        message: `Type test certificate${certNo} for ${label} expired on ${formatDate(validUntil)}. Renewal is overdue.`,
                        type: 'TypeTest',
                        dueDate: validUntil
                    });
                } else {
                    const due = record.reminders.filter(r => !r.sentAt && r.remindOn <= now);
                    if (!due.length) return;
                    const daysLeft = Math.ceil((validUntil - today) / DAY_MS);
                    due.forEach(r => { r.sentAt = now; });
                    if (['Not Due', 'Renewed'].includes(record.renewalStatus)) record.renewalStatus = 'Upcoming';
                    record.activities.push({ userName: 'System Scheduler', action: `Renewal reminder sent (${daysLeft} days to expiry)` });
                    await notifyOwners(record, {
                        title: `Type Test Renewal Due in ${daysLeft} Days`,
                        message: `Type test certificate${certNo} for ${label} is valid until ${formatDate(validUntil)}. Please start the renewal.`,
                        type: 'TypeTest',
                        dueDate: validUntil
                    });
                }
                record.markModified('reminders');
                await record.save();
            });
        }
    } catch (err) {
        console.error('[Scheduler Type Test Reminders Error]', err);
    }
};

module.exports = {
    normalizeLeadDays,
    buildReminders,
    checkTypeTestReminders,
    startOfDay,
    DAY_MS
};
