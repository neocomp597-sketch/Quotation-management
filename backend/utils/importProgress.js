/*
 * Live progress of the Excel imports running in this server process, so the import screen can
 * show rows processed / imported / skipped / failed while the upload request is still open.
 *
 * The screen polls GET /api/import/progress?module=products (the user's latest import of that
 * module) or, when it sent an X-Import-Id header with the upload, GET /api/import/progress/:id.
 * Entries are kept in memory: with several server instances a poll can land on another one,
 * and the screen then simply waits for the upload's response.
 */
const crypto = require('crypto');

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const KEEP_FINISHED_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 1000;

const entries = new Map();

const prune = () => {
    const now = Date.now();
    for (const [id, entry] of entries) {
        if (entry.finishedAt && now - entry.finishedAt > KEEP_FINISHED_MS) entries.delete(id);
    }
    // Oldest first: Map keeps insertion order.
    while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
};

const COUNT_FIELDS = ['total', 'processed', 'created', 'updated', 'skipped', 'failed'];

const publicEntry = (entry) => ({
    id: entry.id,
    module: entry.module,
    stage: entry.stage,
    ...Object.fromEntries(COUNT_FIELDS.map((field) => [field, entry[field]])),
    message: entry.message,
    startedAt: new Date(entry.startedAt).toISOString(),
    updatedAt: new Date(entry.updatedAt).toISOString()
});

/**
 * Opens the progress entry of this request (stage "queued") and returns its handle, also stored
 * as req.importProgress. The id is the X-Import-Id header when the screen sent a valid one.
 */
const startImportProgress = (req, module) => {
    if (!req.user) return null;
    const header = String(req.headers?.['x-import-id'] || '');
    const id = ID_PATTERN.test(header) ? header : crypto.randomUUID();
    prune();

    const now = Date.now();
    const entry = {
        id,
        module,
        userId: String(req.user.id || ''),
        companyId: String(req.user.companyId || ''),
        stage: 'queued',
        total: Number(req.importRowCount) || 0,
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        message: '',
        startedAt: now,
        updatedAt: now,
        finishedAt: null
    };
    entries.delete(id);
    entries.set(id, entry);

    const handle = {
        update(fields = {}) {
            COUNT_FIELDS.forEach((field) => {
                if (Number.isFinite(fields[field])) entry[field] = fields[field];
            });
            if (fields.stage) entry.stage = fields.stage;
            entry.updatedAt = Date.now();
        },
        finish(message = '') {
            if (entry.finishedAt) return;
            entry.stage = 'finished';
            entry.message = String(message || '').slice(0, 500);
            entry.updatedAt = Date.now();
            entry.finishedAt = entry.updatedAt;
        }
    };
    req.importProgress = handle;
    return handle;
};

/** Reports a batch: no-op when the request has no progress entry. */
const reportImportProgress = (req, fields) => {
    req?.importProgress?.update({ stage: 'processing', ...fields });
};

const belongsTo = (entry, user) => (
    Boolean(user) && entry.userId === String(user.id || '') && entry.companyId === String(user.companyId || '')
);

/** The entry, only for the user who started the import. */
const getImportProgress = (id, user) => {
    const entry = entries.get(String(id || ''));
    return entry && belongsTo(entry, user) ? publicEntry(entry) : null;
};

// An import saving rows comes before one waiting its turn, which comes before a finished one.
const STAGE_RANK = { processing: 2, queued: 1, finished: 0 };

/** The user's current import (of `module` when given): the latest one, preferring one that is saving rows. */
const getLatestImportProgress = (user, module) => {
    let latest = null;
    entries.forEach((entry) => {
        if (!belongsTo(entry, user) || (module && entry.module !== module)) return;
        const rank = STAGE_RANK[entry.stage] ?? 0;
        const latestRank = latest ? STAGE_RANK[latest.stage] ?? 0 : -1;
        if (rank > latestRank || (rank === latestRank && entry.startedAt >= latest.startedAt)) latest = entry;
    });
    return latest ? publicEntry(latest) : null;
};

module.exports = { startImportProgress, reportImportProgress, getImportProgress, getLatestImportProgress };
