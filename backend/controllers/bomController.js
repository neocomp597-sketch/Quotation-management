const mongoose = require('mongoose');
const BOMMaster = require('../models/BOMMaster');
const BOMItem = require('../models/BOMItem');
const Ticket = require('../models/Ticket');
const { canViewTicketDetails } = require('./ticketController');
const { prepareBOM, searchMaterials, toKey, cleanText, escapeRegex } = require('../services/bomService');
const { importBOMWorkbook, buildTemplateBuffer } = require('../services/bomImportService');

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

    return {
        ...master,
        items: items.map((item) => ({
            ...item,
            inProductMaster: Boolean(item.productId),
            mgr1: formatMgr(item.mgr1),
            mgr2: formatMgr(item.mgr2),
            mgr3: formatMgr(item.mgr3),
            mgr4: formatMgr(item.mgr4),
            mgr5: formatMgr(item.mgr5)
        }))
    };
};

const findBOMBySerial = async (serialNumber) => {
    const key = toKey(serialNumber);
    if (!key) return null;
    const master = await BOMMaster.findOne({ fgSerialKey: key, status: 'Active' }).lean();
    return loadBOM(master);
};

const loadBOMById = async (id) => {
    const master = await BOMMaster.findById(id)
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .lean();
    return loadBOM(master);
};

const serialTakenMessage = (serial) => `A BOM already exists for FG serial number ${serial}. Open it from the list to change it.`;

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

        const created = await BOMMaster.create({ ...master, status: 'Active', createdBy: req.user?.id, updatedBy: req.user?.id });
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

exports.deleteBOM = async (req, res) => {
    try {
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
            userId: req.user?.id || null
        });
        return res.status(summary.failed && !summary.created && !summary.updated ? 400 : 200).json(summary);
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Failed to import the BOM file' });
    }
};
