const mongoose = require('mongoose');
const XLSX = require('xlsx');
const BOMMaster = require('../models/BOMMaster');
const BOMItem = require('../models/BOMItem');
const Ticket = require('../models/Ticket');
const Product = require('../models/Product');
const Asset = require('../models/Asset');
const { canViewTicketDetails } = require('./ticketController');
const { isSuperAdminRole } = require('../middlewares/authMiddleware');
const {
    prepareBOM, searchMaterials, findProductsByCode, findAssetBySerial, masterDescription, MGR_FIELDS,
    toKey, cleanText, escapeRegex
} = require('../services/bomService');
const {
    importBOMWorkbook, buildTemplateBuffer, importBOMComponents, buildComponentTemplateBuffer
} = require('../services/bomImportService');

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

const addHierarchy = async (bom) => {
    if (!bom) return bom;

    // A component with an item-level BOM of its own opens that BOM.
    const keys = [...new Set((bom.items || []).map((item) => toKey(item.itemCode)).filter(Boolean))];
    const subBoms = keys.length
        ? await BOMMaster.find({ fgSerialKey: { $in: keys } }).select('fgSerialKey componentCount').lean()
        : [];
    const subByKey = new Map(subBoms.map((sub) => [sub.fgSerialKey, sub]));

    // Walk up through the first parent of each level for the breadcrumb, root first.
    const ancestors = [];
    const seen = new Set([String(bom._id)]);
    let code = bom.fgItemCode;
    for (let depth = 0; depth < MAX_HIERARCHY_DEPTH; depth++) {
        const [parent] = await findParentBOMs(code);
        if (!parent || seen.has(String(parent._id))) break;
        seen.add(String(parent._id));
        ancestors.unshift({ _id: parent._id, fgItemCode: parent.fgItemCode, fgItemDescription: parent.fgItemDescription });
        code = parent.fgItemCode;
    }

    return {
        ...bom,
        level: ancestors.length ? 'Assembly' : 'Product',
        ancestors,
        items: (bom.items || []).map((item) => {
            const sub = subByKey.get(toKey(item.itemCode));
            return { ...item, subBomId: sub?._id || null, subBomComponents: sub?.componentCount || 0 };
        })
    };
};

const loadBOMById = async (id) => {
    const master = await BOMMaster.findById(id)
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .lean();
    return addHierarchy(await loadBOM(master));
};

const serialTakenMessage = (serial) => `A BOM already exists for ${serial}. Open it from the list to change it.`;

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
        const bom = await loadBOMById(req.params.id);
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
        if (await BOMMaster.exists({ fgSerialKey: master.fgSerialKey })) {
            return res.status(409).json({ message: serialTakenMessage(master.fgSerialNumber) });
        }

        const created = await BOMMaster.create({
            ...master,
            status: 'Active',
            statusHistory: [statusEntry('Active', 'BOM created', req)],
            createdBy: req.user?.id,
            updatedBy: req.user?.id
        });
        try {
            await BOMItem.insertMany(items.map((item) => ({ ...item, bomMasterId: created._id })));
        } catch (itemError) {
            await BOMMaster.deleteOne({ _id: created._id });
            throw itemError;
        }
        return res.status(201).json(await loadBOMById(created._id));
    } catch (error) {
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
        const existing = await BOMMaster.findById(req.params.id).select('_id').lean();
        if (!existing) {
            return res.status(404).json({ message: 'BOM not found' });
        }

        const { errors, master, items } = await prepareBOM(req.body);
        if (errors.length) {
            return res.status(400).json({ message: 'Please correct the following.', errors });
        }
        if (await BOMMaster.exists({ fgSerialKey: master.fgSerialKey, _id: { $ne: existing._id } })) {
            return res.status(409).json({ message: serialTakenMessage(master.fgSerialNumber) });
        }

        // Insert the new lines before removing the old ones so a failure never leaves the BOM empty.
        const inserted = await BOMItem.insertMany(items.map((item) => ({ ...item, bomMasterId: existing._id })));
        await BOMItem.deleteMany({ bomMasterId: existing._id, _id: { $nin: inserted.map((item) => item._id) } });
        await BOMMaster.updateOne({ _id: existing._id }, { $set: { ...master, updatedBy: req.user?.id } });
        return res.json(await loadBOMById(existing._id));
    } catch (error) {
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

        // The parent keeps its lines and gets the assembly added at the end, validated like the form.
        const { errors, master, items } = await prepareBOM({
            fgItemCode: parent.fgItemCode,
            fgItemDescription: parent.fgItemDescription,
            fgSerialNumber: parent.fgSerialNumber,
            items: [
                ...parentItems.map((item) => ({
                    itemCode: item.itemCode,
                    itemDescription: item.enteredDescription || item.itemDescription,
                    uom: item.uom,
                    qty: item.qty,
                    componentSerialNumber: item.componentSerialNumber,
                    batchNumber: item.batchNumber,
                    remarks: item.remarks
                })),
                { itemCode, itemDescription: itemName, uom: cleanText(req.body.uom) || 'NOS', qty }
            ]
        });
        if (errors.length) {
            return res.status(400).json({ message: errors.join(' '), errors });
        }
        const added = items[items.length - 1];

        let assembly = await BOMMaster.findOne({ fgSerialKey: toKey(added.itemCode) }).select('_id').lean();
        if (!assembly) {
            assembly = await BOMMaster.create({
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
            });
        }

        const inserted = await BOMItem.insertMany(items.map((item) => ({ ...item, bomMasterId: parent._id })));
        await BOMItem.deleteMany({ bomMasterId: parent._id, _id: { $nin: inserted.map((item) => item._id) } });
        await BOMMaster.updateOne({ _id: parent._id }, { $set: { componentCount: master.componentCount, updatedBy: req.user?.id } });

        return res.status(201).json({ assemblyId: assembly._id, bom: await loadBOMById(parent._id) });
    } catch (error) {
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

const loadSubBOMs = async (bom, seen, depth = 1) => {
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
        if (!match || seen.has(String(match._id))) continue;
        seen.add(String(match._id));

        const child = await loadBOM(match);
        result.push({
            level: depth,
            forItemCode: item.itemCode,
            forSerialNumber: item.componentSerialNumber || '',
            bom: child
        });
        result.push(...await loadSubBOMs(child, seen, depth + 1));
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

        const subBoms = await loadSubBOMs(bom, new Set([String(bom._id)]));
        return res.json({ bom, subBoms });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to prepare the BOM for printing', error: error.message });
    }
};

/**
 * Exports a BOM to Excel in the BOM relationship layout (Parent Item Code, Item Code, Item
 * Name, UOM, Quantity): its own lines followed by the lines of every sub-assembly below it,
 * so the file can be uploaded again unchanged.
 */
exports.exportBOM = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid BOM ID' });
        }
        const bom = await loadBOMById(req.params.id);
        if (!bom) return res.status(404).json({ message: 'BOM not found' });

        const subBoms = await loadSubBOMs(bom, new Set([String(bom._id)]));
        const linesOf = (entry) => (entry.items || []).map((item) => [
            entry.fgItemCode || '',
            item.itemCode || '',
            item.itemDescription || '',
            item.uom || '',
            item.qty ?? ''
        ]);
        const rows = [bom, ...subBoms.map((sub) => sub.bom).filter(Boolean)].flatMap(linesOf);

        const headers = ['Parent Item Code', 'Item Code', 'Item Name', 'UOM', 'Quantity'];
        const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        sheet['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 70 }, { wch: 10 }, { wch: 10 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'BOM Relationships');

        const safeName = String(bom.fgSerialNumber || bom.fgItemCode || 'bom').replace(/[^A-Za-z0-9._-]+/g, '-');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=BOM_${safeName}.xlsx`);
        return res.send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    } catch (error) {
        return res.status(500).json({ message: 'Failed to export BOM', error: error.message });
    }
};
