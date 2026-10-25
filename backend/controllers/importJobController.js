const mongoose = require('mongoose');
const ImportJob = require('../models/ImportJob');
const { getImportModule } = require('../services/importEngine/modules');
const engine = require('../services/importEngine/engine');
const { getEffectivePermissions } = require('../middlewares/permissionMiddleware');
const { hasPermission } = require('../config/authorization');
const { isSuperAdminRole } = require('../middlewares/authMiddleware');

// Bulk import jobs (services/importEngine). Importing adds records to the module's screen, so
// every endpoint needs the module's permission (Create on its screen unless the module says
// otherwise), like the single-step imports in importRoutes / config/apiPermissions.js.
// A job is visible to the person who uploaded it and to admins of the company.

const isAdminUser = (user) => ['admin', 'Admin'].includes(user?.role) || isSuperAdminRole(user?.role);

const modulePermissions = (module) => module.permissions || [[module.permissionKey, 'create']];

const canImport = async (req, module) => {
    if (isSuperAdminRole(req.user?.role)) return true;
    const permissions = await getEffectivePermissions(req);
    return modulePermissions(module).some(([key, action]) => hasPermission(permissions, key, action));
};

const denyImport = (res, module) => {
    const [key, action] = modulePermissions(module)[0];
    return res.status(403).json({
        code: 'PERMISSION_DENIED',
        message: `You do not have permission to import ${module.recordLabelPlural}.`,
        permission: { key, action }
    });
};

/** Screen settings arrive as JSON text (multipart form fields and query strings). */
const readParams = (value) => {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const sendError = (res, error, fallback) => {
    if (error instanceof engine.ImportFileError || error instanceof engine.ImportJobError) {
        return res.status(error.status).json({ code: error.code, message: error.message, hint: error.hint });
    }
    console.error(fallback, error);
    return res.status(500).json({ message: fallback, error: error.message });
};

const resolveModule = async (req, res, key) => {
    const module = getImportModule(String(key || ''));
    if (!module) {
        res.status(404).json({ code: 'UNKNOWN_MODULE', message: 'This screen does not support the new import yet.' });
        return null;
    }
    if (!(await canImport(req, module))) {
        denyImport(res, module);
        return null;
    }
    return module;
};

/** The job of the URL, if this user may work on it. A job of someone else answers 404. */
const loadJob = async (req, res) => {
    const notFound = () => res.status(404).json({ code: 'JOB_NOT_FOUND', message: 'This import was not found. It may have expired - upload the file again.' });
    if (!mongoose.isValidObjectId(req.params.jobId)) return notFound() && null;

    const job = await ImportJob.findById(req.params.jobId).lean();
    if (!job) return notFound() && null;
    if (String(job.createdBy?.userId) !== String(req.user.id) && !isAdminUser(req.user)) return notFound() && null;

    const module = getImportModule(job.module);
    if (!module) return notFound() && null;
    if (!(await canImport(req, module))) {
        denyImport(res, module);
        return null;
    }
    return { job: await engine.reconcileIfStale(job, module), module };
};

const getModule = async (req, res) => {
    try {
        const module = await resolveModule(req, res, req.params.module);
        if (!module) return;
        res.json(engine.describeModule(module));
    } catch (error) {
        sendError(res, error, 'Could not load the import settings');
    }
};

/**
 * The user's latest imports of a module, to pick up one that still has rows to fix. Imports
 * with screen settings are listed for the same settings only (this price book, this FY).
 */
const listJobs = async (req, res) => {
    try {
        const module = await resolveModule(req, res, req.query.module);
        if (!module) return;
        let params;
        try {
            params = await engine.resolveParams(module, readParams(req.query.params), req.user);
        } catch {
            return res.json([]);
        }
        const jobs = await ImportJob.find({ module: module.key, 'createdBy.userId': req.user.id, paramsKey: engine.paramsKeyOf(params, module) })
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(req.query.limit) || 5, 20))
            .select('module mode params status file counts progress runs createdAt updatedAt createdBy heartbeatAt lockedAt')
            .lean();
        res.json(jobs.map((job) => {
            const { headers, mapping, module: moduleInfo, ...summary } = engine.serializeJob(job, module);
            return summary;
        }));
    } catch (error) {
        sendError(res, error, 'Could not load recent imports');
    }
};

const preview = async (req, res) => {
    try {
        const module = await resolveModule(req, res, req.query.module || req.body?.module);
        if (!module) return;
        if (!req.file) return res.status(400).json({ code: 'NO_FILE', message: 'Choose an Excel or CSV file to upload.' });

        const job = await engine.createPreview({
            module,
            file: req.file,
            mode: req.body?.mode,
            params: readParams(req.body?.params),
            user: req.user
        });
        const firstRows = await engine.listRows(job, module, { filter: 'all', page: 1, limit: 50 });
        res.status(201).json({ job: engine.serializeJob(job, module), rows: firstRows });
    } catch (error) {
        sendError(res, error, 'Could not read the file');
    }
};

const getJob = async (req, res) => {
    try {
        const found = await loadJob(req, res);
        if (!found) return;
        res.json({ job: engine.serializeJob(found.job, found.module) });
    } catch (error) {
        sendError(res, error, 'Could not load the import');
    }
};

const updateJob = async (req, res) => {
    try {
        const found = await loadJob(req, res);
        if (!found) return;
        const job = await engine.updateSettings(found.job, found.module, { mapping: req.body?.mapping, mode: req.body?.mode }, { user: req.user });
        res.json({ job: engine.serializeJob(job, found.module) });
    } catch (error) {
        sendError(res, error, 'Could not update the import');
    }
};

const getRows = async (req, res) => {
    try {
        const found = await loadJob(req, res);
        if (!found) return;
        res.json(await engine.listRows(found.job, found.module, {
            filter: req.query.status,
            page: req.query.page,
            limit: req.query.limit
        }));
    } catch (error) {
        sendError(res, error, 'Could not load the rows');
    }
};

const correctRows = async (req, res) => {
    try {
        const found = await loadJob(req, res);
        if (!found) return;
        const corrections = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 1000) : [];
        if (!corrections.length) return res.status(400).json({ code: 'NO_ROWS', message: 'No corrections were sent.' });

        const result = await engine.correctRows(found.job, found.module, corrections, { user: req.user });
        const rows = await engine.listRows(found.job, found.module, { filter: 'all', page: 1, limit: 200 });
        const editedRows = rows.rows.filter((row) => result.edited.includes(row.rowNumber));
        res.json({ job: engine.serializeJob(found.job, found.module), rows: editedRows, skipped: result.skipped });
    } catch (error) {
        sendError(res, error, 'Could not save the corrections');
    }
};

const uploadCorrections = async (req, res) => {
    try {
        const found = await loadJob(req, res);
        if (!found) return;
        if (!req.file) return res.status(400).json({ code: 'NO_FILE', message: 'Choose the corrected Excel file to upload.' });

        const result = await engine.applyCorrectionFile(found.job, found.module, req.file, { user: req.user });
        res.json({
            job: engine.serializeJob(found.job, found.module),
            received: result.received,
            applied: result.edited.length,
            skipped: result.skipped
        });
    } catch (error) {
        sendError(res, error, 'Could not read the corrected file');
    }
};

const execute = async (req, res) => {
    try {
        const found = await loadJob(req, res);
        if (!found) return;
        const result = await engine.executeJob(found.job._id, found.module, { user: req.user });
        res.json({ job: engine.serializeJob(result.job, found.module), run: result.run, warning: result.error });
    } catch (error) {
        sendError(res, error, 'The import could not be started');
    }
};

const exportRows = async (req, res) => {
    try {
        const found = await loadJob(req, res);
        if (!found) return;
        const statuses = String(req.query.status || 'attention,failed')
            .split(',')
            .map((status) => status.trim())
            .filter((status) => ['attention', 'failed', 'excluded'].includes(status));
        const buffer = await engine.exportRows(found.job, found.module, { statuses: statuses.length ? statuses : ['attention', 'failed'] });
        const baseName = String(found.job.file?.name || found.module.key).replace(/\.(xlsx|xls|csv)$/i, '').replace(/[^\w.-]+/g, '_');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${baseName}_rows_to_fix.xlsx`);
        res.send(buffer);
    } catch (error) {
        sendError(res, error, 'Could not create the file');
    }
};

module.exports = {
    getModule,
    listJobs,
    preview,
    getJob,
    updateJob,
    getRows,
    correctRows,
    uploadCorrections,
    execute,
    exportRows
};
