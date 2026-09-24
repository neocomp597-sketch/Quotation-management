const mongoose = require('mongoose');
const BOMMaster = require('../models/BOMMaster');
const BOMItem = require('../models/BOMItem');
const Ticket = require('../models/Ticket');
const { importBOMWorkbook, buildTemplateBuffer, toKey } = require('../services/bomImportService');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

exports.uploadBOM = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an Excel file' });
        }

        const result = await importBOMWorkbook({
            buffer: req.file.buffer,
            fileName: req.file.originalname,
            userId: req.user?.id
        });

        const { summary } = result;
        const message = summary.successRows === 0
            ? 'No BOM rows were imported'
            : `BOM import completed: ${summary.successRows} of ${summary.totalRows} rows imported`;

        return res.status(summary.successRows === 0 ? 400 : 200).json({ message, ...result });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'BOM import failed' });
    }
};

exports.downloadTemplate = (req, res) => {
    const buffer = buildTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bom_import_template.xlsx');
    return res.send(buffer);
};

exports.listBOMs = async (req, res) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const query = {};
        const search = String(req.query.search || '').trim();
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
        const master = await BOMMaster.findById(req.params.id)
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name')
            .lean();
        if (!master) {
            return res.status(404).json({ message: 'BOM not found' });
        }
        return res.json(await loadBOM(master));
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load BOM', error: error.message });
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
        // The tenant plugin applies company and branch scoping, so users only reach BOMs of complaints they can see.
        const ticket = await Ticket.findById(req.params.ticketId)
            .select('serialNumber assetId')
            .populate('assetId', 'serialNumber')
            .lean();
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        const serialNumber = ticket.serialNumber || ticket.assetId?.serialNumber || '';
        return res.json({ serialNumber, bom: await findBOMBySerial(serialNumber) });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load BOM', error: error.message });
    }
};
