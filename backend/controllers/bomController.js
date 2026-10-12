const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const BOMMaster = require('../models/BOMMaster');
const BOMItem = require('../models/BOMItem');
const Ticket = require('../models/Ticket');
const Product = require('../models/Product');
const Asset = require('../models/Asset');
const { canViewTicketDetails } = require('./ticketController');
const { isSuperAdminRole } = require('../middlewares/authMiddleware');
const {
    prepareBOM, searchMaterials, findProductsByCode, findAssetBySerial, masterDescription, MGR_FIELDS,
    findBOMForProduct, PRODUCT_TAKEN_MESSAGE,
    toKey, cleanText, escapeRegex
} = require('../services/bomService');
const {
    importBOMWorkbook, buildTemplateBuffer, importBOMComponents, buildComponentTemplateBuffer
} = require('../services/bomImportService');
const {
    childSeq, inTransaction, writeLines, saveLines, createBOMWithLines, moveLine, renumberLines,
    assertNoCircularCodes
} = require('../services/bomLineService');

const MGR_POPULATE = 'code description';

const getPagination = (query) => {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
};

const formatMgr = (mgr) => (mgr ? { _id: mgr._id, code: mgr.code, description: mgr.description } : null);

const loadBOM = async (master) => {
    if (!master) return null;

    const items = await BOMItem.find({ bomMasterId: master._id })
        .sort({ lineNo: 1 })
        .populate('mgr1', MGR_POPULATE)
        .populate('mgr2', MGR_POPULATE)
        .populate('mgr3', MGR_POPULATE)
        .populate('mgr4', MGR_POPULATE)
        .populate('mgr5', MGR_POPULATE)
        .lean();

    // Descriptions and MGR1-MGR5 are read from Product Master every time, so a product
    // maintained after the BOM was saved shows up without re-entering the BOM. What was
    // stored with the BOM is the fallback for codes that are still not in the master.
    const byCode = await findProductsByCode(
        [master.fgItemCode, ...items.map((item) => item.itemCode)],
        { withMgrs: true }
    );

    const mgrsOf = (source) => Object.fromEntries(MGR_FIELDS.map((field) => [field, formatMgr(source?.[field])]));

    // Invoice and customer of the finished good, from the serial registered in Invoice
    // Bulk Upload. Looked up by serial when the BOM was saved before the serial existed.
    const asset = await Asset.findOne(
        master.assetId
            ? { _id: master.assetId }
            : { serialNumber: { $in: [...new Set([master.fgSerialNumber, toKey(master.fgSerialNumber)])] } }
    ).select('invoiceNumber invoiceDate customerCode customerNameStr customerId').lean();

    let fgProduct = byCode.get(toKey(master.fgItemCode)) || null;
    if (!fgProduct && master.fgProductId) {
        fgProduct = await Product.findById(master.fgProductId)
            .select(`productCode productName description ${MGR_FIELDS.join(' ')}`)
            .populate(MGR_FIELDS.map((path) => ({ path, select: MGR_POPULATE })))
            .lean();
    }

    return {
        ...master,
        fgItemDescription: masterDescription(fgProduct) || master.fgItemDescription,
        fgMgr: mgrsOf(fgProduct),
        invoice: {
            invoiceNumber: asset?.invoiceNumber || '',
            invoiceDate: asset?.invoiceDate || null,
            customerCode: asset?.customerCode || '',
            customerName: asset?.customerNameStr || ''
        },
        items: items.map((item) => {
            const product = byCode.get(toKey(item.itemCode));
            return {
                ...item,
                inProductMaster: Boolean(product),
                itemDescription: product
                    ? masterDescription(product)
                    : (item.enteredDescription || item.itemDescription),
                uom: item.uom || cleanText(product?.uom),
                ...mgrsOf(product || item)
            };
        })
    };
};

/**
 * BOM shown on a complaint: the BOM entered for that serial number, otherwise the item-level
 * BOM (imported from the BOM relationship sheet) of the product the serial was sold as.
 */
const findBOMBySerial = async (serialNumber) => {
    const key = toKey(serialNumber);
    if (!key) return null;
    let master = await BOMMaster.findOne({ fgSerialKey: key, status: 'Active' }).lean();
    if (!master) {
        const asset = await findAssetBySerial(serialNumber);
        const productCode = toKey(asset?.productCode);
        if (productCode) {
            master = await BOMMaster.findOne({ fgSerialKey: productCode, status: 'Active' }).lean();
        }
    }
    return loadBOM(master);
};

/**
 * Product -> Assembly -> F.G. Item hierarchy, read from the BOM lines themselves: a BOM is an
 * assembly when its parent item code is a component of another BOM, and a product when it is
 * not a component anywhere. Codes are compared upper-cased, as fgSerialKey is.
 */
const MAX_HIERARCHY_DEPTH = 8;

// Every item code used as a component. aggregate() is tenant-scoped; distinct() is not.
const componentCodes = async () => {
    const rows = await BOMItem.aggregate([{ $group: { _id: '$itemCode' } }]);
    const codes = new Set();
    rows.forEach(({ _id }) => {
        if (!_id) return;
        codes.add(_id);
        codes.add(toKey(_id));
    });
    return [...codes];
};

// BOMs that list this item code as one of their components.
const findParentBOMs = async (itemCode) => {
    const key = toKey(itemCode);
    if (!key) return [];
    const lines = await BOMItem.find({ itemCode: { $in: [...new Set([cleanText(itemCode), key])] } })
        .select('bomMasterId')
        .lean();
    if (!lines.length) return [];
    return BOMMaster.find({ _id: { $in: [...new Set(lines.map((line) => String(line.bomMasterId)))] } })
        .select('fgItemCode fgItemDescription fgSerialNumber status')
        .sort({ status: 1, fgItemCode: 1 })
        .lean();
};

// Line number of an item code inside a parent BOM (its place in the report's sequence).
const lineOf = async (parentId, itemCode) => {
    const line = await BOMItem.findOne({ bomMasterId: parentId, itemCode: { $in: [...new Set([cleanText(itemCode), toKey(itemCode)])] } })
        .sort({ lineNo: 1 })
        .select('lineNo')
        .lean();
    return line?.lineNo || null;
};

/**
 * Adds the breadcrumb (ancestors, root first), the level and the sequence numbers. Sequence
 * numbers follow the BOM Costing Report: a product's lines are 1, 2, 3...; the lines of the
 * assembly at line 2 are 2.1, 2.2...; below that 2.6.1 and so on. `parentId` is the BOM the
 * page was opened from, so an assembly used in two places is numbered along the path taken.
 */
const addHierarchy = async (bom, { parentId = null } = {}) => {
    if (!bom) return bom;

    // A component with an item-level BOM of its own opens that BOM.
    const keys = [...new Set((bom.items || []).map((item) => toKey(item.itemCode)).filter(Boolean))];
    const subBoms = keys.length
        ? await BOMMaster.find({ fgSerialKey: { $in: keys } }).select('fgSerialKey componentCount').lean()
        : [];
    const subByKey = new Map(subBoms.map((sub) => [sub.fgSerialKey, sub]));

    // Walk up through the first parent of each level for the breadcrumb, root first.
    const ancestors = [];
    const positions = [];
    const seen = new Set([String(bom._id)]);
    let code = bom.fgItemCode;
    for (let depth = 0; depth < MAX_HIERARCHY_DEPTH; depth++) {
        const parents = await findParentBOMs(code);
        const parent = (depth === 0 && parentId && parents.find((p) => String(p._id) === String(parentId))) || parents[0];
        if (!parent || seen.has(String(parent._id))) break;
        seen.add(String(parent._id));
        ancestors.unshift({ _id: parent._id, fgItemCode: parent.fgItemCode, fgItemDescription: parent.fgItemDescription });
        positions.unshift(await lineOf(parent._id, code));
        code = parent.fgItemCode;
    }
    // Numbered only when every step of the path is known.
    const seqPrefix = positions.every(Boolean) ? positions.join('.') : '';

    return {
        ...bom,
        level: ancestors.length ? 'Assembly' : 'Product',
        ancestors,
        seqPrefix,
        items: (bom.items || []).map((item) => {
            const sub = subByKey.get(toKey(item.itemCode));
            return {
                ...item,
                // Same rule as the PDF and Excel export (bomLineService.childSeq).
                seqNo: childSeq(seqPrefix, item.lineNo),
                subBomId: sub?._id || null,
                subBomComponents: sub?.componentCount || 0
            };
        })
    };
};

const loadBOMById = async (id, options = {}) => {
    const master = await BOMMaster.findById(id)
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .lean();
    return addHierarchy(await loadBOM(master), options);
};

const serialTakenMessage = (serial) => `A BOM already exists for ${serial}. Open it from the list to change it.`;

/** For the BOM form: the BOM a product already has, so a second one is not started. */
exports.checkProduct = async (req, res) => {
    try {
        const excludeId = mongoose.Types.ObjectId.isValid(req.query.excludeId) ? req.query.excludeId : null;
        const bom = await findBOMForProduct(req.query.code, { excludeId });
        return res.json({ exists: Boolean(bom), bom, message: bom ? PRODUCT_TAKEN_MESSAGE : '' });
    } catch (error) {
        return res.status(500).json({ message: 'Could not check the product', error: error.message });
    }
};

exports.searchMaterials = async (req, res) => {
    try {
        return res.json(await searchMaterials(req.query.q, Math.min(50, Number(req.query.limit) || 20)));
    } catch (error) {
        return res.status(500).json({ message: 'Material search failed', error: error.message });
    }
};

exports.listBOMs = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const query = {};
        const search = cleanText(req.query.search);
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            query.$or = [{ fgSerialNumber: pattern }, { fgItemCode: pattern }, { fgItemDescription: pattern }];
        }
        if (req.query.status) {
            query.status = req.query.status;
        }
        // The dashboard lists products only; assemblies are reached through their product.
        if (req.query.level === 'product') {
            query.fgItemCode = { $nin: await componentCodes() };
        }

        const [boms, total] = await Promise.all([
            BOMMaster.find(query)
                .select('fgItemCode fgItemDescription fgSerialNumber componentCount status createdAt updatedAt createdBy')
                .populate('createdBy', 'name')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            BOMMaster.countDocuments(query)
        ]);

        return res.json({
            data: boms,
            pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load BOMs', error: error.message });
    }
};

exports.getBOMById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        const parentId = mongoose.Types.ObjectId.isValid(req.query.parent) ? req.query.parent : null;
        const bom = await loadBOMById(req.params.id, { parentId });
        if (!bom) {
            return res.status(404).json({ message: 'BOM not found' });
        }
        return res.json(bom);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load BOM', error: error.message });
    }
};

exports.createBOM = async (req, res) => {
    try {
        const { errors, master, items } = await prepareBOM(req.body);
        if (errors.length) {
            return res.status(400).json({ message: 'Please correct the following.', errors });
        }
        const taken = await findBOMForProduct(master.fgItemCode);
        if (taken) {
            return res.status(409).json({ message: PRODUCT_TAKEN_MESSAGE, bomId: taken._id });
        }
        if (await BOMMaster.exists({ fgSerialKey: master.fgSerialKey })) {
            return res.status(409).json({ message: serialTakenMessage(master.fgSerialNumber) });
        }
        await assertNoCircularCodes(master.fgItemCode, items.map((item) => item.itemCode));

        // The BOM and its lines are written together; lines are numbered 1, 2, 3...
        const { master: created } = await createBOMWithLines({
            ...master,
            status: 'Active',
            statusHistory: [statusEntry('Active', 'BOM created', req)],
            createdBy: req.user?.id,
            updatedBy: req.user?.id
        }, items);
        return res.status(201).json(await loadBOMById(created._id));
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ message: error.message, errors: error.errors });
        }
        if (error.code === 11000) {
            return res.status(409).json({ message: serialTakenMessage(cleanText(req.body.fgSerialNumber)) });
        }
        return res.status(500).json({ message: 'Failed to save BOM', error: error.message });
    }
};

exports.updateBOM = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        const existing = await BOMMaster.findById(req.params.id).select('_id fgItemCode').lean();
        if (!existing) {
            return res.status(404).json({ message: 'BOM not found' });
        }

        const { errors, master, items } = await prepareBOM(req.body);
        if (errors.length) {
            return res.status(400).json({ message: 'Please correct the following.', errors });
        }
        // Moving a BOM to another product is refused when that product already has one.
        if (toKey(master.fgItemCode) !== toKey(existing.fgItemCode)) {
            const taken = await findBOMForProduct(master.fgItemCode, { excludeId: existing._id });
            if (taken) return res.status(409).json({ message: PRODUCT_TAKEN_MESSAGE, bomId: taken._id });
        }
        if (await BOMMaster.exists({ fgSerialKey: master.fgSerialKey, _id: { $ne: existing._id } })) {
            return res.status(409).json({ message: serialTakenMessage(master.fgSerialNumber) });
        }
        await assertNoCircularCodes(master.fgItemCode, items.map((item) => item.itemCode));

        // Saved lines keep their numbers, new rows get the next ones, removed rows are deleted;
        // nothing is renumbered. All in one transaction, so a failure changes nothing.
        const { componentCount, ...masterFields } = master;
        await saveLines(existing._id, items, { mode: 'sync', masterSet: { ...masterFields, updatedBy: req.user?.id } });
        return res.json(await loadBOMById(existing._id));
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ message: error.message, errors: error.errors });
        }
        if (error.code === 11000) {
            return res.status(409).json({ message: serialTakenMessage(cleanText(req.body.fgSerialNumber)) });
        }
        return res.status(500).json({ message: 'Failed to save BOM', error: error.message });
    }
};

const statusEntry = (status, reason, req) => ({
    status,
    reason: cleanText(reason),
    changedBy: req.user?.id || null,
    changedByName: req.user?.name || '',
    changedAt: new Date()
});

/**
 * Activate or deactivate a BOM. Nothing is removed: an inactive BOM stays in the register
 * with its components and stops being offered to the complaint screens, and every switch is
 * written to the BOM's status log with the user who made it.
 */
exports.setBOMStatus = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        const status = cleanText(req.body.status);
        if (!['Active', 'Inactive'].includes(status)) {
            return res.status(400).json({ message: 'Status must be Active or Inactive.' });
        }
        const master = await BOMMaster.findById(req.params.id).select('_id status').lean();
        if (!master) {
            return res.status(404).json({ message: 'BOM not found' });
        }
        if (master.status === status) {
            return res.json(await loadBOMById(master._id));
        }

        const reason = req.body.reason || (status === 'Active' ? 'Activated' : 'Deactivated');
        await BOMMaster.updateOne(
            { _id: master._id },
            {
                $set: { status, updatedBy: req.user?.id },
                $push: { statusHistory: statusEntry(status, reason, req) }
            }
        );
        return res.json(await loadBOMById(master._id));
    } catch (error) {
        return res.status(500).json({ message: 'Failed to change the BOM status', error: error.message });
    }
};

// The screens deactivate a BOM instead; a permanent delete is left to administrators.
exports.deleteBOM = async (req, res) => {
    try {
        const role = req.user?.role || '';
        if (role !== 'admin' && !isSuperAdminRole(role)) {
            return res.status(403).json({
                message: 'BOMs are deactivated rather than deleted. Only an administrator can delete one permanently.'
            });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        const master = await BOMMaster.findById(req.params.id).select('_id').lean();
        if (!master) {
            return res.status(404).json({ message: 'BOM not found' });
        }
        await BOMItem.deleteMany({ bomMasterId: master._id });
        await BOMMaster.deleteOne({ _id: master._id });
        return res.json({ message: 'BOM deleted' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete BOM', error: error.message });
    }
};

// Read-only lookup used by complaint booking. Responds with `bom: null` when the serial has no BOM.
exports.getBOMBySerial = async (req, res) => {
    try {
        return res.json({ bom: await findBOMBySerial(req.params.serialNumber) });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load BOM', error: error.message });
    }
};

// Read-only BOM for an existing complaint, resolved through the complaint's FG serial number.
exports.getBOMForTicket = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) {
            return res.status(400).json({ message: 'Invalid ticket ID' });
        }
        // The tenant plugin applies company and branch scoping; canViewTicketDetails applies the same
        // "assigned to you" rule as the ticket screen.
        const ticket = await Ticket.findById(req.params.ticketId)
            .select('serialNumber assetId assignedEngineerId assignedEngineerIds')
            .populate('assetId', 'serialNumber')
            .lean();
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        if (!(await canViewTicketDetails(req.user, ticket))) {
            return res.status(403).json({ message: 'Access denied: You can only view complaints assigned to you.' });
        }

        const serialNumber = ticket.serialNumber || ticket.assetId?.serialNumber || '';
        return res.json({ serialNumber, bom: await findBOMBySerial(serialNumber) });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load BOM', error: error.message });
    }
};

/** Downloads the bulk-upload template (sample row + a guide sheet). */
exports.downloadTemplate = async (req, res) => {
    try {
        const buffer = buildTemplateBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=bom_import_template.xlsx');
        return res.send(buffer);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to build the BOM template', error: error.message });
    }
};

/** Bulk-uploads BOMs from an Excel/CSV workbook. One BOM per FG serial number. */
exports.uploadBOM = async (req, res) => {
    try {
        if (!req.file?.buffer?.length) {
            return res.status(400).json({ message: 'Choose an .xlsx, .xls or .csv file to upload.' });
        }
        const summary = await importBOMWorkbook(req.file.buffer, {
            fileName: req.file.originalname || '',
            userId: req.user?.id || null,
            userName: req.user?.name || ''
        });
        return res.status(summary.failed && !summary.created && !summary.updated ? 400 : 200).json(summary);
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Failed to import the BOM file' });
    }
};

/**
 * Create Assembly on a product's BOM Details: adds the assembly as a component of this BOM and
 * gives it an (empty) item-level BOM of its own, whose components are then entered or imported
 * on the assembly's page. An assembly code that already has a BOM is linked instead of recreated.
 */
exports.createAssembly = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        const parent = await BOMMaster.findById(req.params.id).lean();
        if (!parent) {
            return res.status(404).json({ message: 'BOM not found' });
        }

        const itemCode = cleanText(req.body.itemCode);
        const itemName = cleanText(req.body.itemName);
        const qty = req.body.qty === undefined || req.body.qty === '' ? 1 : req.body.qty;
        if (!itemCode) {
            return res.status(400).json({ message: 'Assembly code is required.' });
        }
        if (toKey(itemCode) === toKey(parent.fgItemCode)) {
            return res.status(400).json({ message: 'An assembly cannot have the same code as its product.' });
        }

        const parentItems = await BOMItem.find({ bomMasterId: parent._id }).sort({ lineNo: 1 }).lean();
        if (parentItems.some((item) => toKey(item.itemCode) === toKey(itemCode))) {
            return res.status(409).json({ message: `${itemCode} is already a component of ${parent.fgItemCode}.` });
        }

        // The assembly line is validated like a form row and added after the parent's lines,
        // with the next number; the parent's other lines are not touched.
        const { errors, items } = await prepareBOM({
            fgItemCode: parent.fgItemCode,
            fgSerialNumber: parent.fgSerialNumber,
            items: [{ itemCode, itemDescription: itemName, uom: cleanText(req.body.uom) || 'NOS', qty }]
        });
        if (errors.length) {
            return res.status(400).json({ message: errors.join(' '), errors });
        }
        const [added] = items;
        await assertNoCircularCodes(parent.fgItemCode, [added.itemCode]);

        const existingAssembly = await findBOMForProduct(added.itemCode);
        // The assembly's own BOM and the parent's new line are created together.
        const { assemblyId, line } = await inTransaction(async (session) => {
            let assemblyId = existingAssembly?._id;
            if (!assemblyId) {
                const [created] = await BOMMaster.create([{
                    fgItemCode: added.itemCode,
                    fgItemDescription: added.itemDescription,
                    fgProductId: added.productId,
                    fgSerialNumber: added.itemCode,
                    fgSerialKey: toKey(added.itemCode),
                    componentCount: 0,
                    status: 'Active',
                    statusHistory: [statusEntry('Active', `Assembly created under ${parent.fgItemCode}`, req)],
                    createdBy: req.user?.id,
                    updatedBy: req.user?.id
                }], { session });
                assemblyId = created._id;
            }
            const { lines } = await writeLines(parent._id, [added], { session, mode: 'append', masterSet: { updatedBy: req.user?.id } });
            return { assemblyId, line: lines[lines.length - 1] };
        });

        return res.status(201).json({ assemblyId, lineId: line?._id, lineNo: line?.lineNo, bom: await loadBOMById(parent._id) });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ message: error.message, errors: error.errors });
        }
        if (error.code === 11000) {
            return res.status(409).json({ message: 'A BOM already exists for that assembly code.' });
        }
        return res.status(500).json({ message: 'Failed to create the assembly', error: error.message });
    }
};

/** Template for Import Components on BOM Details: Item Code, Item Name, UOM, Quantity. */
exports.downloadComponentTemplate = async (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=bom_components_template.xlsx');
        return res.send(buildComponentTemplateBuffer());
    } catch (error) {
        return res.status(500).json({ message: 'Failed to build the components template', error: error.message });
    }
};

/** Imports component lines from a workbook into one BOM, replacing or appending to its components. */
exports.importComponents = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        if (!req.file?.buffer?.length) {
            return res.status(400).json({ message: 'Choose an .xlsx, .xls or .csv file to upload.' });
        }
        const summary = await importBOMComponents(req.file.buffer, req.params.id, {
            mode: req.body?.mode === 'append' ? 'append' : 'replace',
            fileName: req.file.originalname || '',
            userId: req.user?.id || null
        });
        return res.json({ ...summary, bom: await loadBOMById(req.params.id) });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || 'Failed to import the components',
            warnings: error.warnings || []
        });
    }
};

/**
 * A component is a sub-BOM (sub-assembly) when it has a BOM of its own: first by its serial
 * number, then by the item-level BOM of its item code (the BOM imported for that Parent Item
 * Code), and failing that by its item code when exactly one BOM exists for that code. Nesting
 * is followed down the whole tree, and a BOM already expanded is never expanded twice.
 */
const MAX_SUB_BOM_DEPTH = 8;

// perPath (PDF): a sub-assembly used in several places is printed under each of them, like the
// BOM Costing Report, and `seen` is only the path above it (so a loop still stops). Without it
// (Excel export) every sub-BOM appears once, so the file can be uploaded again unchanged.
// Sequence numbers continue from the line the sub-assembly sits on: line 1.38 -> 1.38.1, 1.38.2.
const loadSubBOMs = async (bom, seen, depth = 1, { perPath = false, cache = new Map() } = {}) => {
    if (depth > MAX_SUB_BOM_DEPTH) return [];

    const items = bom.items || [];
    const serialKeys = [...new Set(items.map((item) => toKey(item.componentSerialNumber)).filter(Boolean))];
    const codes = [...new Set(items.map((item) => item.itemCode).filter(Boolean))];
    if (!serialKeys.length && !codes.length) return [];

    const candidates = await BOMMaster.find({
        status: 'Active',
        $or: [{ fgSerialKey: { $in: serialKeys } }, { fgItemCode: { $in: codes } }]
    }).lean();

    const bySerial = new Map();
    const itemLevel = new Map();
    const byItemCode = new Map();
    candidates.forEach((candidate) => {
        bySerial.set(candidate.fgSerialKey, candidate);
        const key = toKey(candidate.fgItemCode);
        if (candidate.fgSerialKey === key) itemLevel.set(key, candidate);
        // Only an unambiguous item code is used; several serials for one code is not a match.
        byItemCode.set(key, byItemCode.has(key) ? null : candidate);
    });

    const result = [];
    for (const item of items) {
        const code = toKey(item.itemCode);
        const match = bySerial.get(toKey(item.componentSerialNumber)) || itemLevel.get(code) || byItemCode.get(code);
        if (!match) continue;
        const matchId = String(match._id);
        if (seen.has(matchId)) continue;
        if (!perPath) seen.add(matchId);

        if (!cache.has(matchId)) cache.set(matchId, await loadBOM(match));
        const loaded = cache.get(matchId);
        const child = {
            ...loaded,
            items: (loaded.items || []).map((line) => ({
                ...line,
                seqNo: item.seqNo ? childSeq(item.seqNo, line.lineNo) : line.seqNo
            }))
        };
        result.push({
            level: depth,
            forItemCode: item.itemCode,
            forSeqNo: item.seqNo || '',
            forSerialNumber: item.componentSerialNumber || '',
            bom: child
        });
        const below = perPath ? new Set([...seen, matchId]) : seen;
        result.push(...await loadSubBOMs(child, below, depth + 1, { perPath, cache }));
    }
    return result;
};

/** Everything the Export to PDF needs in one call: the BOM, its invoice and its sub-BOMs. */
exports.getBOMForPrint = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        const bom = await loadBOMById(req.params.id);
        if (!bom) return res.status(404).json({ message: 'BOM not found' });

        const subBoms = await loadSubBOMs(bom, new Set([String(bom._id)]), 1, { perPath: true });
        return res.json({ bom, subBoms });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to prepare the BOM for printing', error: error.message });
    }
};

const sendError = (res, error, fallback) => {
    if (error.status) return res.status(error.status).json({ message: error.message, errors: error.errors });
    if (error.code === 11000) {
        return res.status(409).json({ message: 'Another change to this BOM was saved at the same time. Reload the BOM and try again.' });
    }
    return res.status(500).json({ message: fallback, error: error.message });
};

/**
 * Add Component on BOM Details: one line added under this BOM. The backend gives it the next
 * number under the parent (1.3 with 1.3.1 and 1.3.2 -> 1.3.3); the number comes back with the BOM.
 */
exports.addComponent = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        const parent = await BOMMaster.findById(req.params.id).select('_id fgItemCode fgSerialNumber').lean();
        if (!parent) return res.status(404).json({ message: 'BOM not found' });

        const row = req.body || {};
        const { errors, items } = await prepareBOM({
            fgItemCode: parent.fgItemCode,
            fgSerialNumber: parent.fgSerialNumber,
            items: [{
                itemCode: row.itemCode,
                itemDescription: row.itemName ?? row.itemDescription,
                uom: row.uom,
                qty: row.qty === undefined || row.qty === '' ? 1 : row.qty,
                componentSerialNumber: row.componentSerialNumber,
                batchNumber: row.batchNumber,
                remarks: row.remarks,
                drawingNo: row.drawingNo,
                revisionNo: row.revisionNo
            }]
        });
        if (errors.length) return res.status(400).json({ message: errors.join(' '), errors });
        await assertNoCircularCodes(parent.fgItemCode, items.map((item) => item.itemCode));

        const { lines } = await saveLines(parent._id, items, { mode: 'append', masterSet: { updatedBy: req.user?.id } });
        const line = lines[lines.length - 1];
        const bom = await loadBOMById(parent._id, {
            parentId: mongoose.Types.ObjectId.isValid(req.query.parent) ? req.query.parent : null
        });
        const shown = bom.items.find((item) => String(item._id) === String(line._id));
        return res.status(201).json({ lineId: line._id, lineNo: line.lineNo, seqNo: shown?.seqNo || String(line.lineNo), bom });
    } catch (error) {
        return sendError(res, error, 'Failed to add the component');
    }
};

/**
 * Moves a component (and its sub-assembly below it) under another parent BOM. It takes the next
 * number there; its descendants' numbers follow from the new path. Done in one transaction.
 */
exports.moveComponent = async (req, res) => {
    try {
        const { id, lineId } = req.params;
        const targetId = req.body?.targetBomId;
        if (![id, lineId, targetId].every((value) => mongoose.Types.ObjectId.isValid(value))) {
            return res.status(400).json({ message: 'Choose the BOM to move the component to.' });
        }
        const moved = await moveLine(id, lineId, targetId);
        const bom = await loadBOMById(id, {
            parentId: mongoose.Types.ObjectId.isValid(req.query.parent) ? req.query.parent : null
        });
        const target = await loadBOMById(targetId);
        const shown = target?.items.find((item) => String(item._id) === String(moved.lineId));
        return res.json({
            ...moved,
            seqNo: shown?.seqNo || String(moved.lineNo),
            targetItemCode: target?.fgItemCode || '',
            bom
        });
    } catch (error) {
        return sendError(res, error, 'Failed to move the component');
    }
};

/**
 * Renumber, only when the user asks for it: this BOM's lines become 1, 2, 3... in their current
 * order, closing gaps left by deleted lines.
 */
exports.renumberComponents = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        const summary = await renumberLines(req.params.id);
        await BOMMaster.updateOne({ _id: req.params.id }, { $set: { updatedBy: req.user?.id } });
        const bom = await loadBOMById(req.params.id, {
            parentId: mongoose.Types.ObjectId.isValid(req.query.parent) ? req.query.parent : null
        });
        return res.json({ ...summary, bom });
    } catch (error) {
        return sendError(res, error, 'Failed to renumber the components');
    }
};

const EXPORT_HEADERS = ['FG Serial Number', 'Item Code', 'Item Description', 'Qty', 'Batch Number', 'Component Serial Number'];

/**
 * Exports a BOM to Excel, one block per finished good: the BOM itself, then every sub-assembly
 * below it (each once). A block is a row with the FG Code and FG Name (Product Master name, else
 * the BOM's FG description), a header row, then the component lines in line order.
 */
exports.exportBOM = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        const bom = await loadBOMById(req.params.id);
        if (!bom) return res.status(404).json({ message: 'BOM not found' });

        const subBoms = await loadSubBOMs(bom, new Set([String(bom._id)]));
        const blocks = [bom, ...subBoms.map((sub) => sub.bom).filter(Boolean)];

        const productIds = blocks.map((entry) => entry.fgProductId?._id || entry.fgProductId).filter(Boolean);
        const products = await Product.find({
            $or: [{ _id: { $in: productIds } }, { productCode: { $in: blocks.map((entry) => entry.fgItemCode).filter(Boolean) } }]
        }).select('productCode productName').lean();
        const productById = new Map(products.map((p) => [String(p._id), p]));
        const productByCode = new Map(products.map((p) => [toKey(p.productCode), p]));
        const fgNameOf = (entry) => {
            const product = productById.get(String(entry.fgProductId?._id || entry.fgProductId)) || productByCode.get(toKey(entry.fgItemCode));
            return cleanText(product?.productName) || cleanText(entry.fgItemDescription);
        };

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('BOM');
        // Codes, serial and batch numbers are text so Excel keeps leading zeros and long digits.
        [18, 16, 70, 10, 18, 24].forEach((width, index) => {
            const column = sheet.getColumn(index + 1);
            column.width = width;
            if (index !== 3) column.numFmt = '@';
        });

        blocks.forEach((entry, index) => {
            if (index > 0) sheet.addRow([]);
            const fgRow = sheet.addRow(['FG Code:', entry.fgItemCode || '', 'FG Name:', fgNameOf(entry)]);
            fgRow.font = { bold: true };
            const headerRow = sheet.addRow(EXPORT_HEADERS);
            headerRow.font = { bold: true };
            headerRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; });
            (entry.items || []).forEach((item) => {
                sheet.addRow([
                    entry.fgSerialNumber || '',
                    item.itemCode || '',
                    item.itemDescription || '',
                    item.qty ?? '',
                    item.batchNumber || '',
                    item.componentSerialNumber || ''
                ]);
            });
        });

        const safeName = String(bom.fgSerialNumber || bom.fgItemCode || 'bom').replace(/[^A-Za-z0-9._-]+/g, '-');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=BOM_${safeName}.xlsx`);
        return res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
    } catch (error) {
        return res.status(500).json({ message: 'Failed to export BOM', error: error.message });
    }
};
