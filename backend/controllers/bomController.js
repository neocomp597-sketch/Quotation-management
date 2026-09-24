const mongoose = require('mongoose');
const BOM = require('../models/BOM');
const { COMPONENT_TYPES, STATUSES, APPROVAL_STAGES, ATTACHMENT_CATEGORIES } = require('../models/BOM');
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const Asset = require('../models/Asset');
const Ticket = require('../models/Ticket');
const Counter = require('../models/Counter');
const { canViewTicketDetails } = require('./ticketController');
const uploadToSupabase = require('../utils/uploadToSupabase');
const { hasPermission, isAdminUser } = require('../middlewares/permissionMiddleware');
const {
    EDITABLE_STATUSES,
    OPEN_STATUSES,
    STAGE_PERMISSIONS,
    buildFamilyKey,
    findProductsByCode,
    searchMaterials,
    normalizeContent,
    validateBOM,
    nextStage,
    toKey,
    cleanText
} = require('../services/bomService');

const BOM_TYPES = ['Manufacturing', 'Engineering', 'Sales', 'Service', 'Kit'];
const BOM_USAGES = ['Production', 'Engineering', 'Maintenance', 'Sales', 'Costing'];
const DEFAULT_UOMS = ['EA', 'NOS', 'SET', 'KG', 'G', 'M', 'MM', 'LTR', 'ML', 'SQM', 'PAIR', 'BOX', 'ROLL'];
const LIST_FIELDS = 'bomNumber fgItemCode fgDescription plantName alternativeBom revision revisionNo status currentStage baseQty baseUom effectiveFrom effectiveTo cost.total preparedByName updatedAt';

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const formatRevision = (revisionNo) => `REV-${String(revisionNo).padStart(2, '0')}`;
const userName = (req) => req.user?.name || req.user?.email || '';

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, extra });

const sendError = (res, error, fallback) => {
    if (error.name === 'VersionError') {
        return res.status(409).json({ message: 'This BOM was changed by someone else. Reload it and try again.' });
    }
    if (error.code === 11000) {
        return res.status(409).json({ message: 'A BOM with the same number or revision already exists. Reload and try again.' });
    }
    return res.status(error.status || 500).json({ message: error.status ? error.message : fallback, ...(error.extra || {}), ...(error.status ? {} : { error: error.message }) });
};

const generateBomNumber = async (companyId) => {
    const year = new Date().getFullYear();
    const counter = await Counter.findOneAndUpdate(
        { type: 'bom', companyId, prefix: 'BOM', year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return `BOM/${year}/${String(counter.seq).padStart(4, '0')}`;
};

const addHistory = (bom, req, action, extra = {}) => {
    bom.history.push({
        action,
        by: req.user?.id,
        byName: userName(req),
        at: new Date(),
        ...extra
    });
};

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Applies the header and content from the form to a BOM document. FG description and
 * product category default from Product Master; plant name is copied from the branch.
 */
const applyFormData = async (bom, body, { allowFamilyChange }) => {
    if (allowFamilyChange) {
        bom.fgItemCode = cleanText(body.fgItemCode);
        bom.plantId = mongoose.Types.ObjectId.isValid(body.plantId) ? body.plantId : null;
        bom.alternativeBom = cleanText(body.alternativeBom);
    }

    const codes = [bom.fgItemCode, ...(body.components || []).map((component) => cleanText(component.componentCode))];
    const productsByCode = await findProductsByCode(codes);
    const fgProduct = productsByCode.get(toKey(bom.fgItemCode));
    if (fgProduct) bom.fgItemCode = fgProduct.code;

    if (allowFamilyChange) {
        const plant = bom.plantId ? await Branch.findById(bom.plantId).select('name').lean() : null;
        if (bom.plantId && !plant) throw httpError(400, 'Selected plant was not found');
        bom.plantName = plant?.name || '';
    }

    bom.fgProductId = fgProduct?.productId || null;
    bom.fgDescription = cleanText(body.fgDescription) || fgProduct?.description || '';
    bom.productCategory = cleanText(body.productCategory) || fgProduct?.materialGroup || '';
    bom.fgVersion = cleanText(body.fgVersion);
    bom.bomType = cleanText(body.bomType) || 'Manufacturing';
    bom.bomUsage = cleanText(body.bomUsage) || 'Production';
    bom.productionUnit = cleanText(body.productionUnit);
    const baseQty = Number(body.baseQty);
    bom.baseQty = Number.isFinite(baseQty) ? baseQty : null;
    bom.baseUom = cleanText(body.baseUom);
    bom.effectiveFrom = parseDate(body.effectiveFrom);
    bom.effectiveTo = parseDate(body.effectiveTo);
    bom.department = cleanText(body.department);
    bom.remarks = cleanText(body.remarks);
    if (body.revisionReason !== undefined) bom.revisionReason = cleanText(body.revisionReason);

    const { components, operations, cost } = normalizeContent(body, productsByCode);
    bom.components = components;
    bom.operations = operations;
    bom.cost = cost;
    bom.familyKey = buildFamilyKey(bom);

    return productsByCode;
};

const validateStored = async (bom) => {
    const productsByCode = await findProductsByCode([bom.fgItemCode, ...bom.components.map((component) => component.componentCode)]);
    return validateBOM(bom.toObject ? bom.toObject() : bom, productsByCode);
};

const isPreparer = (req, bom) => String(bom.preparedBy || '') === String(req.user?.id || '');

const getAllowedActions = async (req, bom, family) => {
    const [canCreate, canManage] = await Promise.all([
        hasPermission(req, 'bom_create'),
        hasPermission(req, STAGE_PERMISSIONS.Management)
    ]);
    const inReview = ['Submitted', 'Under Review'].includes(bom.status);
    const canActOnStage = inReview && bom.currentStage
        && await hasPermission(req, STAGE_PERMISSIONS[bom.currentStage])
        // The preparer may not approve their own BOM; admins are exempt so small teams are not blocked.
        && (isAdminUser(req.user) || !isPreparer(req, bom));
    const latestRevisionNo = Math.max(...family.map((item) => item.revisionNo));
    const familyHasOpenRevision = family.some((item) => OPEN_STATUSES.includes(item.status));
    const editable = EDITABLE_STATUSES.includes(bom.status);

    return {
        edit: canCreate && editable,
        submit: canCreate && editable,
        delete: canCreate && bom.status === 'Draft' && !bom.submittedAt && (isAdminUser(req.user) || isPreparer(req, bom)),
        approve: Boolean(canActOnStage),
        sendBack: Boolean(canActOnStage),
        reject: Boolean(canActOnStage),
        release: canManage && bom.status === 'Approved',
        obsolete: canManage && bom.status === 'Active',
        revise: canCreate && ['Active', 'Obsolete', 'Rejected'].includes(bom.status)
            && bom.revisionNo === latestRevisionNo && !familyHasOpenRevision,
        addAttachment: canCreate && (editable || inReview),
        removeAttachment: canCreate && editable
    };
};

const loadFamily = (familyKey) => BOM.find({ familyKey })
    .select('bomNumber revision revisionNo status effectiveFrom effectiveTo releasedAt updatedAt')
    .sort({ revisionNo: -1 })
    .lean();

const buildDetail = async (req, bom) => {
    const family = await loadFamily(bom.familyKey);
    const plain = bom.toObject ? bom.toObject() : bom;
    const [allowedActions, validation] = await Promise.all([
        getAllowedActions(req, plain, family),
        EDITABLE_STATUSES.includes(plain.status) ? validateStored(plain) : Promise.resolve(null)
    ]);
    return { ...plain, allowedActions, revisions: family, validation };
};

const findBomOr404 = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw httpError(400, 'Invalid BOM ID');
    const bom = await BOM.findById(id);
    if (!bom) throw httpError(404, 'BOM not found');
    return bom;
};

// ---------- Reference data ----------

exports.getOptions = async (req, res) => {
    try {
        const [plants, productUoms] = await Promise.all([
            Branch.find({ status: { $ne: 'Inactive' } }).select('name code').sort({ name: 1 }).lean(),
            Product.distinct('uom')
        ]);
        const uoms = [...new Set([...DEFAULT_UOMS, ...productUoms.map((uom) => cleanText(uom).toUpperCase()).filter(Boolean)])];
        return res.json({
            plants,
            uoms,
            componentTypes: COMPONENT_TYPES,
            statuses: STATUSES,
            approvalStages: APPROVAL_STAGES,
            attachmentCategories: ATTACHMENT_CATEGORIES,
            bomTypes: BOM_TYPES,
            bomUsages: BOM_USAGES
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load BOM options');
    }
};

exports.searchMaterials = async (req, res) => {
    try {
        return res.json(await searchMaterials(req.query.q, Math.min(50, Number(req.query.limit) || 20)));
    } catch (error) {
        return sendError(res, error, 'Material search failed');
    }
};

// Validates unsaved form data so the "Validate BOM" button works before saving.
exports.validateDraft = async (req, res) => {
    try {
        const bom = new BOM({ bomNumber: 'unsaved', familyKey: 'unsaved', revisionNo: 1, revision: 'REV-01' });
        const productsByCode = await applyFormData(bom, req.body, { allowFamilyChange: true });
        const { errors, warnings } = validateBOM(bom.toObject(), productsByCode);
        return res.json({ errors, warnings, cost: bom.cost, components: bom.toObject().components });
    } catch (error) {
        return sendError(res, error, 'Validation failed');
    }
};

// ---------- CRUD ----------

exports.listBOMs = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
        const query = {};
        const search = cleanText(req.query.search);
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            query.$or = [{ bomNumber: pattern }, { fgItemCode: pattern }, { fgDescription: pattern }];
        }
        if (req.query.status) {
            const statuses = String(req.query.status).split(',').map(cleanText).filter(Boolean);
            query.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
        }
        if (mongoose.Types.ObjectId.isValid(req.query.plantId)) query.plantId = req.query.plantId;
        if (req.query.pendingMine === 'true') {
            // Stages this user can act on.
            const stages = [];
            for (const stage of APPROVAL_STAGES) {
                if (await hasPermission(req, STAGE_PERMISSIONS[stage])) stages.push(stage);
            }
            query.status = { $in: ['Submitted', 'Under Review'] };
            query.currentStage = { $in: stages };
        }

        const [data, total] = await Promise.all([
            BOM.find(query).select(LIST_FIELDS).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            BOM.countDocuments(query)
        ]);
        return res.json({ data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
    } catch (error) {
        return sendError(res, error, 'Failed to load BOMs');
    }
};

exports.getBOM = async (req, res) => {
    try {
        const bom = await findBomOr404(req.params.id);
        return res.json(await buildDetail(req, bom));
    } catch (error) {
        return sendError(res, error, 'Failed to load BOM');
    }
};

exports.createBOM = async (req, res) => {
    try {
        if (!cleanText(req.body.fgItemCode) || !mongoose.Types.ObjectId.isValid(req.body.plantId)) {
            throw httpError(400, 'FG Material Code and Plant are needed to save a BOM.');
        }

        const bom = new BOM({
            revisionNo: 1,
            revision: formatRevision(1),
            status: 'Draft',
            preparedBy: req.user?.id,
            preparedByName: userName(req),
            updatedBy: req.user?.id
        });
        await applyFormData(bom, req.body, { allowFamilyChange: true });

        const existing = await BOM.findOne({ familyKey: bom.familyKey }).sort({ revisionNo: -1 }).select('bomNumber revision').lean();
        if (existing) {
            throw httpError(409, `A BOM already exists for ${bom.fgItemCode} at ${bom.plantName}${bom.alternativeBom ? ` (alternative ${bom.alternativeBom})` : ''}: ${existing.bomNumber} ${existing.revision}. Open it and create a revision instead.`, { existingId: existing._id });
        }

        bom.bomNumber = await generateBomNumber(req.user?.companyId);
        addHistory(bom, req, 'Created', { toStatus: 'Draft' });
        await bom.save();
        return res.status(201).json(await buildDetail(req, bom));
    } catch (error) {
        return sendError(res, error, 'Failed to create BOM');
    }
};

exports.updateBOM = async (req, res) => {
    try {
        const bom = await findBomOr404(req.params.id);
        if (!EDITABLE_STATUSES.includes(bom.status)) {
            throw httpError(400, `A BOM in status ${bom.status} cannot be edited.`);
        }
        if (req.body.__v !== undefined && Number(req.body.__v) !== bom.__v) {
            throw httpError(409, 'This BOM was changed by someone else. Reload it and try again.');
        }

        // FG, plant and alternative identify the BOM family, so they can only change on a first revision.
        const allowFamilyChange = bom.revisionNo === 1;
        const previousFamilyKey = bom.familyKey;
        await applyFormData(bom, req.body, { allowFamilyChange });
        if (!bom.fgItemCode || !bom.plantId) throw httpError(400, 'FG Material Code and Plant are needed to save a BOM.');

        if (bom.familyKey !== previousFamilyKey) {
            const clash = await BOM.findOne({ familyKey: bom.familyKey, _id: { $ne: bom._id } }).select('bomNumber revision').lean();
            if (clash) throw httpError(409, `${clash.bomNumber} ${clash.revision} already covers this FG, plant and alternative.`);
        }

        bom.updatedBy = req.user?.id;
        addHistory(bom, req, 'Edited', { fromStatus: bom.status, toStatus: bom.status });
        await bom.save();
        return res.json(await buildDetail(req, bom));
    } catch (error) {
        return sendError(res, error, 'Failed to save BOM');
    }
};

exports.deleteBOM = async (req, res) => {
    try {
        const bom = await findBomOr404(req.params.id);
        if (bom.status !== 'Draft' || bom.submittedAt) {
            throw httpError(400, 'Only drafts that were never submitted can be deleted.');
        }
        if (!isAdminUser(req.user) && !isPreparer(req, bom)) {
            throw httpError(403, 'Only the person who prepared this draft can delete it.');
        }
        await BOM.deleteOne({ _id: bom._id });
        return res.json({ message: 'Draft deleted' });
    } catch (error) {
        return sendError(res, error, 'Failed to delete BOM');
    }
};

// ---------- Workflow ----------

exports.submitBOM = async (req, res) => {
    try {
        const bom = await findBomOr404(req.params.id);
        if (!EDITABLE_STATUSES.includes(bom.status)) throw httpError(400, `A BOM in status ${bom.status} cannot be submitted.`);

        const { errors, warnings } = await validateStored(bom);
        if (errors.length) {
            throw httpError(400, 'Please correct the following before submitting.', { errors, warnings });
        }

        const fromStatus = bom.status;
        bom.status = 'Submitted';
        bom.currentStage = APPROVAL_STAGES[0];
        bom.approvals = [];
        bom.submittedAt = new Date();
        bom.updatedBy = req.user?.id;
        addHistory(bom, req, 'Submitted for approval', { fromStatus, toStatus: bom.status, remarks: cleanText(req.body.remarks) });
        await bom.save();
        return res.json(await buildDetail(req, bom));
    } catch (error) {
        return sendError(res, error, 'Failed to submit BOM');
    }
};

const loadForStageAction = async (req) => {
    const bom = await findBomOr404(req.params.id);
    if (!['Submitted', 'Under Review'].includes(bom.status) || !bom.currentStage) {
        throw httpError(400, `This BOM is ${bom.status} and is not waiting for approval.`);
    }
    if (!(await hasPermission(req, STAGE_PERMISSIONS[bom.currentStage]))) {
        throw httpError(403, `You do not have ${bom.currentStage} approval rights.`);
    }
    if (!isAdminUser(req.user) && isPreparer(req, bom)) {
        throw httpError(403, 'You prepared this BOM, so someone else has to approve it.');
    }
    return bom;
};

exports.approveBOM = async (req, res) => {
    try {
        const bom = await loadForStageAction(req);
        const stage = bom.currentStage;
        const fromStatus = bom.status;
        const remarks = cleanText(req.body.remarks);

        bom.approvals.push({ stage, by: req.user?.id, byName: userName(req), at: new Date(), remarks });
        const upcoming = nextStage(stage);
        if (upcoming) {
            bom.currentStage = upcoming;
            bom.status = 'Under Review';
        } else {
            bom.currentStage = '';
            bom.status = 'Approved';
            bom.approvedAt = new Date();
        }
        bom.updatedBy = req.user?.id;
        addHistory(bom, req, `${stage} approval`, { stage, fromStatus, toStatus: bom.status, remarks });
        await bom.save();
        return res.json(await buildDetail(req, bom));
    } catch (error) {
        return sendError(res, error, 'Failed to approve BOM');
    }
};

const closeStage = (toStatus, action) => async (req, res) => {
    try {
        const remarks = cleanText(req.body.remarks);
        if (!remarks) throw httpError(400, 'Please enter the reason in remarks.');
        const bom = await loadForStageAction(req);
        const stage = bom.currentStage;
        const fromStatus = bom.status;

        bom.status = toStatus;
        bom.currentStage = '';
        bom.updatedBy = req.user?.id;
        addHistory(bom, req, action, { stage, fromStatus, toStatus, remarks });
        await bom.save();
        return res.json(await buildDetail(req, bom));
    } catch (error) {
        return sendError(res, error, 'Failed to update BOM');
    }
};

// Sent back: the preparer edits and resubmits. Rejected: closed; a new revision is needed.
exports.sendBackBOM = closeStage('Revision Required', 'Sent back for revision');
exports.rejectBOM = closeStage('Rejected', 'Rejected');

exports.releaseBOM = async (req, res) => {
    try {
        if (!(await hasPermission(req, STAGE_PERMISSIONS.Management))) {
            throw httpError(403, 'Only management approvers can release a BOM.');
        }
        const bom = await findBomOr404(req.params.id);
        if (bom.status !== 'Approved') throw httpError(400, 'Only an approved BOM can be released.');

        const now = new Date();
        const previousActive = await BOM.find({ familyKey: bom.familyKey, status: 'Active', _id: { $ne: bom._id } });
        for (const previous of previousActive) {
            previous.status = 'Obsolete';
            if (!previous.effectiveTo) previous.effectiveTo = now;
            addHistory(previous, req, `Superseded by ${bom.revision}`, { fromStatus: 'Active', toStatus: 'Obsolete' });
            await previous.save();
        }

        bom.status = 'Active';
        bom.releasedAt = now;
        bom.updatedBy = req.user?.id;
        addHistory(bom, req, 'Released', { fromStatus: 'Approved', toStatus: 'Active', remarks: cleanText(req.body.remarks) });
        await bom.save();
        return res.json(await buildDetail(req, bom));
    } catch (error) {
        return sendError(res, error, 'Failed to release BOM');
    }
};

exports.obsoleteBOM = async (req, res) => {
    try {
        if (!(await hasPermission(req, STAGE_PERMISSIONS.Management))) {
            throw httpError(403, 'Only management approvers can make a BOM obsolete.');
        }
        const remarks = cleanText(req.body.remarks);
        if (!remarks) throw httpError(400, 'Please enter the reason in remarks.');
        const bom = await findBomOr404(req.params.id);
        if (bom.status !== 'Active') throw httpError(400, 'Only an active BOM can be made obsolete.');

        bom.status = 'Obsolete';
        if (!bom.effectiveTo) bom.effectiveTo = new Date();
        bom.updatedBy = req.user?.id;
        addHistory(bom, req, 'Made obsolete', { fromStatus: 'Active', toStatus: 'Obsolete', remarks });
        await bom.save();
        return res.json(await buildDetail(req, bom));
    } catch (error) {
        return sendError(res, error, 'Failed to update BOM');
    }
};

// Copies a released/closed BOM into a new Draft revision of the same family.
exports.reviseBOM = async (req, res) => {
    try {
        const source = await findBomOr404(req.params.id);
        if (!['Active', 'Obsolete', 'Rejected'].includes(source.status)) {
            throw httpError(400, 'A revision can only be created from an Active, Obsolete or Rejected BOM.');
        }
        const family = await loadFamily(source.familyKey);
        const open = family.find((item) => OPEN_STATUSES.includes(item.status));
        if (open) throw httpError(409, `${open.revision} is still ${open.status}. Finish or delete it before starting another revision.`, { existingId: open._id });
        const latest = family[0];
        if (latest && latest.revisionNo !== source.revisionNo) {
            throw httpError(400, `Create the revision from the latest revision (${latest.revision}).`);
        }

        const revisionNo = source.revisionNo + 1;
        // eslint-disable-next-line no-unused-vars
        const { _id, __v, createdAt, updatedAt, ...plain } = source.toObject();
        // eslint-disable-next-line no-unused-vars
        const stripIds = (rows) => rows.map(({ _id: rowId, ...rest }) => rest);
        const draft = new BOM({
            ...plain,
            revisionNo,
            revision: formatRevision(revisionNo),
            previousRevisionId: source._id,
            revisionReason: cleanText(req.body.reason),
            status: 'Draft',
            currentStage: '',
            approvals: [],
            submittedAt: null,
            approvedAt: null,
            releasedAt: null,
            effectiveFrom: new Date(),
            effectiveTo: null,
            components: stripIds(plain.components),
            operations: stripIds(plain.operations),
            attachments: stripIds(plain.attachments),
            preparedBy: req.user?.id,
            preparedByName: userName(req),
            updatedBy: req.user?.id,
            history: []
        });
        addHistory(draft, req, `Revision created from ${source.revision}`, { toStatus: 'Draft', remarks: cleanText(req.body.reason) });
        await draft.save();
        return res.status(201).json(await buildDetail(req, draft));
    } catch (error) {
        return sendError(res, error, 'Failed to create revision');
    }
};

// ---------- Attachments ----------

exports.addAttachment = async (req, res) => {
    try {
        if (!req.file) throw httpError(400, 'Please choose a file');
        const bom = await findBomOr404(req.params.id);
        if (![...EDITABLE_STATUSES, 'Submitted', 'Under Review'].includes(bom.status)) {
            throw httpError(400, `Attachments cannot be added to a ${bom.status} BOM.`);
        }
        const category = ATTACHMENT_CATEGORIES.includes(req.body.category) ? req.body.category : 'Other';
        const url = await uploadToSupabase(req.file);
        bom.attachments.push({
            category,
            fileName: req.file.originalname,
            url,
            uploadedBy: req.user?.id,
            uploadedByName: userName(req),
            uploadedAt: new Date()
        });
        addHistory(bom, req, `Attached ${category}: ${req.file.originalname}`, { fromStatus: bom.status, toStatus: bom.status });
        await bom.save();
        return res.status(201).json(await buildDetail(req, bom));
    } catch (error) {
        return sendError(res, error, 'Failed to upload attachment');
    }
};

exports.removeAttachment = async (req, res) => {
    try {
        const bom = await findBomOr404(req.params.id);
        if (!EDITABLE_STATUSES.includes(bom.status)) throw httpError(400, `Attachments cannot be removed from a ${bom.status} BOM.`);
        const attachment = bom.attachments.id(req.params.attachmentId);
        if (!attachment) throw httpError(404, 'Attachment not found');
        const fileName = attachment.fileName;
        attachment.deleteOne();
        addHistory(bom, req, `Removed attachment ${fileName}`, { fromStatus: bom.status, toStatus: bom.status });
        await bom.save();
        return res.json(await buildDetail(req, bom));
    } catch (error) {
        return sendError(res, error, 'Failed to remove attachment');
    }
};

// ---------- Read-only BOM for complaints ----------

const isEffective = (bom, at = new Date()) => (!bom.effectiveFrom || bom.effectiveFrom <= at) && (!bom.effectiveTo || bom.effectiveTo >= at);

/**
 * Active BOM for an FG item. Prefers the complaint's own plant, then the main (non-alternative)
 * BOM, then the latest revision.
 */
const findActiveBOM = async (fgItemCode, preferredPlantId) => {
    const code = cleanText(fgItemCode);
    if (!code) return null;
    const candidates = (await BOM.find({
        fgItemCode: { $in: [...new Set([code, code.toUpperCase(), code.toLowerCase()])] },
        status: 'Active'
    }).select('-history -approvals').lean()).filter((bom) => isEffective(bom));

    const score = (bom) => [
        preferredPlantId && String(bom.plantId) === String(preferredPlantId) ? 1 : 0,
        bom.alternativeBom ? 0 : 1,
        bom.revisionNo
    ];
    candidates.sort((a, b) => {
        const [sa, sb] = [score(a), score(b)];
        for (let i = 0; i < sa.length; i += 1) if (sa[i] !== sb[i]) return sb[i] - sa[i];
        return 0;
    });
    return candidates[0] || null;
};

exports.getComplaintBOMForTicket = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) throw httpError(400, 'Invalid ticket ID');
        // Tenant plugin applies company and branch scoping; canViewTicketDetails applies the same
        // "assigned to you" rule as the ticket screen, so the BOM is only shown for viewable complaints.
        const ticket = await Ticket.findById(req.params.ticketId)
            .select('serialNumber productId assetId branchId assignedEngineerId assignedEngineerIds')
            .populate('productId', 'productCode')
            .populate('assetId', 'serialNumber productCode')
            .lean();
        if (!ticket) throw httpError(404, 'Ticket not found');
        if (!(await canViewTicketDetails(req.user, ticket))) {
            throw httpError(403, 'Access denied: You can only view complaints assigned to you.');
        }

        const fgItemCode = ticket.productId?.productCode || ticket.assetId?.productCode || '';
        return res.json({
            fgItemCode,
            serialNumber: ticket.serialNumber || ticket.assetId?.serialNumber || '',
            bom: await findActiveBOM(fgItemCode, ticket.branchId)
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load BOM');
    }
};

// Used while booking: resolve the FG from the serial number (or take the product code directly).
exports.getComplaintBOMLookup = async (req, res) => {
    try {
        let fgItemCode = cleanText(req.query.productCode);
        const serial = cleanText(req.query.serialNumber);
        if (!fgItemCode && serial) {
            const asset = await Asset.findOne({ serialNumber: { $in: [...new Set([serial, serial.toUpperCase(), serial.toLowerCase()])] } })
                .select('productCode productId')
                .populate('productId', 'productCode')
                .lean();
            fgItemCode = asset?.productId?.productCode || asset?.productCode || '';
        }
        const plantId = mongoose.Types.ObjectId.isValid(req.query.branchId) ? req.query.branchId : null;
        return res.json({ fgItemCode, serialNumber: serial, bom: await findActiveBOM(fgItemCode, plantId) });
    } catch (error) {
        return sendError(res, error, 'Failed to load BOM');
    }
};
