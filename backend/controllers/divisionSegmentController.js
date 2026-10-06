const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const Division = require('../models/Division');
const Segment = require('../models/Segment');
const Asset = require('../models/Asset');
const {
    normalizeCode,
    loadDivisionSegmentLookup,
    addDivisionSegmentDropdowns
} = require('../utils/divisionSegment');

// Division codes end up in Excel defined names (dependent Segment dropdown), so they are
// limited to letters, digits and "_".
const DIVISION_CODE_PATTERN = /^[A-Z0-9_]{1,20}$/;
const SEGMENT_CODE_PATTERN = /^[A-Z0-9_\-]{1,30}$/;
const STATUSES = ['Active', 'Inactive'];

const normalizeStatus = (value, fallback = 'Active') => {
    const clean = String(value ?? '').trim().toLowerCase();
    if (!clean) return fallback;
    return clean === 'inactive' ? 'Inactive' : 'Active';
};

const sendXlsx = async (res, workbook, filename) => {
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(Buffer.from(buffer));
};

const styleHeader = (worksheet) => {
    const header = worksheet.getRow(1);
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F3EF' } };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
};

// ─── DIVISION MASTER ─────────────────────────────────────────────────────────

exports.getDivisions = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;
        const divisions = await Division.find(filter).sort({ code: 1 }).lean();
        res.json(divisions);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Error fetching divisions' });
    }
};

const readDivisionBody = (body = {}) => {
    const code = normalizeCode(body.code);
    const description = String(body.description ?? '').trim();
    if (!code) throw Object.assign(new Error('Division Code is required'), { statusCode: 400 });
    if (!DIVISION_CODE_PATTERN.test(code)) {
        throw Object.assign(new Error('Division Code may contain only letters, digits and "_" (max 20)'), { statusCode: 400 });
    }
    if (!description) throw Object.assign(new Error('Division Description is required'), { statusCode: 400 });
    return { code, description, status: normalizeStatus(body.status) };
};

exports.createDivision = async (req, res) => {
    try {
        const data = readDivisionBody(req.body);
        const division = await Division.create(data);
        res.status(201).json(division);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'Division Code already exists' });
        res.status(err.statusCode || 400).json({ message: err.message });
    }
};

exports.updateDivision = async (req, res) => {
    try {
        const data = readDivisionBody(req.body);
        const division = await Division.findByIdAndUpdate(
            req.params.id,
            { ...data, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        if (!division) return res.status(404).json({ message: 'Division not found' });
        res.json(division);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'Division Code already exists' });
        res.status(err.statusCode || 400).json({ message: err.message });
    }
};

exports.deleteDivision = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid division id' });
        const [segmentCount, assetCount] = await Promise.all([
            Segment.countDocuments({ divisionId: id }),
            Asset.countDocuments({ divisionId: id }).setOptions({ bypassBranch: true })
        ]);
        if (segmentCount || assetCount) {
            return res.status(400).json({
                message: `Division is in use (${segmentCount} segment(s), ${assetCount} invoice record(s)). Set it Inactive instead.`
            });
        }
        const division = await Division.findByIdAndDelete(id);
        if (!division) return res.status(404).json({ message: 'Division not found' });
        res.json({ message: 'Division deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Error deleting division' });
    }
};

// ─── SEGMENT MASTER ──────────────────────────────────────────────────────────

exports.getSegments = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;
        if (req.query.divisionId && mongoose.Types.ObjectId.isValid(req.query.divisionId)) {
            filter.divisionId = req.query.divisionId;
        } else if (req.query.divisionCode) {
            const division = await Division.findOne({ code: normalizeCode(req.query.divisionCode) }).select('_id').lean();
            if (!division) return res.json([]);
            filter.divisionId = division._id;
        }
        const segments = await Segment.find(filter)
            .populate('divisionId', 'code description status')
            .sort({ code: 1 })
            .lean();
        res.json(segments);
    } catch (err) {
        res.status(500).json({ message: err.message || 'Error fetching segments' });
    }
};

const readSegmentBody = async (body = {}) => {
    const code = normalizeCode(body.code);
    const description = String(body.description ?? '').trim();
    if (!code) throw Object.assign(new Error('Segment Code is required'), { statusCode: 400 });
    if (!SEGMENT_CODE_PATTERN.test(code)) {
        throw Object.assign(new Error('Segment Code may contain only letters, digits, "_" and "-" (max 30)'), { statusCode: 400 });
    }
    if (!description) throw Object.assign(new Error('Segment Description is required'), { statusCode: 400 });
    const divisionId = String(body.divisionId?._id || body.divisionId || '');
    if (!divisionId || !mongoose.Types.ObjectId.isValid(divisionId)) {
        throw Object.assign(new Error('Division is required'), { statusCode: 400 });
    }
    const division = await Division.findById(divisionId).select('_id').lean();
    if (!division) throw Object.assign(new Error('Selected Division does not exist'), { statusCode: 400 });
    return { code, description, divisionId, status: normalizeStatus(body.status) };
};

exports.createSegment = async (req, res) => {
    try {
        const data = await readSegmentBody(req.body);
        const segment = await Segment.create(data);
        res.status(201).json(await Segment.findById(segment._id).populate('divisionId', 'code description status').lean());
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'Segment Code already exists' });
        res.status(err.statusCode || 400).json({ message: err.message });
    }
};

exports.updateSegment = async (req, res) => {
    try {
        const data = await readSegmentBody(req.body);
        const segment = await Segment.findByIdAndUpdate(
            req.params.id,
            { ...data, updatedAt: new Date() },
            { new: true, runValidators: true }
        ).populate('divisionId', 'code description status');
        if (!segment) return res.status(404).json({ message: 'Segment not found' });

        // Records keep their segment; their division follows the segment's division.
        await Asset.updateMany(
            { segmentId: segment._id, divisionId: { $ne: segment.divisionId._id } },
            { $set: { divisionId: segment.divisionId._id } }
        ).setOptions({ bypassBranch: true });

        res.json(segment);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'Segment Code already exists' });
        res.status(err.statusCode || 400).json({ message: err.message });
    }
};

exports.deleteSegment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid segment id' });
        const assetCount = await Asset.countDocuments({ segmentId: id }).setOptions({ bypassBranch: true });
        if (assetCount) {
            return res.status(400).json({ message: `Segment is used by ${assetCount} invoice record(s). Set it Inactive instead.` });
        }
        const segment = await Segment.findByIdAndDelete(id);
        if (!segment) return res.status(404).json({ message: 'Segment not found' });
        res.json({ message: 'Segment deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Error deleting segment' });
    }
};

/**
 * Import template: codes only (Division_Code, Segment_Code). Division_Code has a
 * dropdown from the Division Master. A Segment_Desc column may be added by the user to
 * name new segments; without it a new segment is created with its code as description.
 */
exports.getSegmentTemplate = async (req, res) => {
    try {
        const lookup = await loadDivisionSegmentLookup(req.user?.companyId);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Segment Master');
        sheet.columns = [
            { header: 'Division_Code', key: 'divisionCode', width: 18 },
            { header: 'Segment_Code', key: 'segmentCode', width: 18 }
        ];
        const [firstDivision] = lookup.divisions.filter((d) => d.status === 'Active');
        if (firstDivision) sheet.addRow({ divisionCode: firstDivision.code, segmentCode: '' });
        styleHeader(sheet);

        const activeDivisions = lookup.divisions.filter((d) => d.status === 'Active');
        const lists = workbook.addWorksheet('Lists', { state: 'veryHidden' });
        lists.getCell(1, 1).value = 'Division_Code';
        activeDivisions.forEach((d, i) => { lists.getCell(i + 2, 1).value = d.code; });
        workbook.definedNames.add(`Lists!$A$2:$A$${Math.max(2, activeDivisions.length + 1)}`, 'DIVISION_CODES');
        sheet.dataValidations.add('A2:A1000', {
            type: 'list',
            allowBlank: true,
            formulae: ['DIVISION_CODES'],
            showErrorMessage: true,
            errorStyle: 'stop',
            errorTitle: 'Invalid Division',
            error: 'Choose a Division_Code from the Division Master.'
        });

        await sendXlsx(res, workbook, 'Segment_Master_Template.xlsx');
    } catch (err) {
        console.error('getSegmentTemplate error:', err);
        res.status(500).json({ message: 'Error generating segment template' });
    }
};

exports.exportSegments = async (req, res) => {
    try {
        const segments = await Segment.find({})
            .populate('divisionId', 'code description')
            .lean();
        segments.sort((a, b) => (
            String(a.divisionId?.code || '').localeCompare(String(b.divisionId?.code || ''))
            || String(a.code).localeCompare(String(b.code))
        ));

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Segment Master');
        sheet.columns = [
            { header: 'Division_Code', key: 'divisionCode', width: 16 },
            { header: 'Division_Desc', key: 'divisionDesc', width: 24 },
            { header: 'Segment_Code', key: 'segmentCode', width: 16 },
            { header: 'Segment_Desc', key: 'segmentDesc', width: 34 },
            { header: 'Status', key: 'status', width: 12 }
        ];
        segments.forEach((s) => sheet.addRow({
            divisionCode: s.divisionId?.code || '',
            divisionDesc: s.divisionId?.description || '',
            segmentCode: s.code,
            segmentDesc: s.description,
            status: s.status
        }));
        styleHeader(sheet);
        await sendXlsx(res, workbook, `Segment_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
        console.error('exportSegments error:', err);
        res.status(500).json({ message: 'Error exporting segments' });
    }
};

const pickCell = (row, ...keys) => {
    const normalized = Object.keys(row).reduce((acc, key) => {
        acc[key.trim().toLowerCase().replace(/[\s_]+/g, '')] = row[key];
        return acc;
    }, {});
    for (const key of keys) {
        const value = normalized[key.toLowerCase().replace(/[\s_]+/g, '')];
        if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
};

exports.importSegments = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (!rows.length) return res.status(400).json({ message: 'No data found in file' });

        const lookup = await loadDivisionSegmentLookup(req.user?.companyId);
        const results = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
        const seen = new Set();

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNo = i + 2;
            try {
                const divisionCode = normalizeCode(pickCell(row, 'Division_Code', 'Division Code', 'Division'));
                const segmentCode = normalizeCode(pickCell(row, 'Segment_Code', 'Segment Code', 'Segment'));
                const description = pickCell(row, 'Segment_Desc', 'Segment Description', 'Segment_Description', 'Description');
                const statusRaw = pickCell(row, 'Status');

                if (!divisionCode && !segmentCode) { results.skipped++; continue; }
                if (!divisionCode) throw new Error('Division_Code is required.');
                if (!segmentCode) throw new Error('Segment_Code is required.');
                if (!SEGMENT_CODE_PATTERN.test(segmentCode)) throw new Error(`Segment_Code "${segmentCode}" may contain only letters, digits, "_" and "-".`);

                const division = lookup.divisionByCode.get(divisionCode);
                if (!division) throw new Error(`Division ${divisionCode} does not exist in the Division Master.`);
                if (seen.has(segmentCode)) throw new Error(`Segment_Code ${segmentCode} appears more than once in the file.`);
                seen.add(segmentCode);

                const existing = lookup.segmentByCode.get(segmentCode);
                if (existing) {
                    const update = { divisionId: division._id, updatedAt: new Date() };
                    if (description) update.description = description;
                    if (statusRaw) update.status = normalizeStatus(statusRaw);
                    await Segment.updateOne({ _id: existing._id }, { $set: update });
                    if (String(existing.divisionId) !== String(division._id)) {
                        await Asset.updateMany({ segmentId: existing._id }, { $set: { divisionId: division._id } }).setOptions({ bypassBranch: true });
                    }
                    results.updated++;
                } else {
                    const created = await Segment.create({
                        divisionId: division._id,
                        code: segmentCode,
                        description: description || segmentCode,
                        status: normalizeStatus(statusRaw)
                    });
                    lookup.segmentByCode.set(segmentCode, created.toObject());
                    results.created++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${rowNo}: ${err.message}`);
            }
        }

        const success = results.created + results.updated;
        const status = success === 0 && results.failed > 0 ? 400 : 200;
        res.status(status).json({
            message: `Import completed. Created: ${results.created}, Updated: ${results.updated}, Skipped: ${results.skipped}, Failed: ${results.failed}.`,
            success,
            ...results
        });
    } catch (err) {
        console.error('importSegments error:', err);
        res.status(500).json({ message: err.message || 'Error importing segments', errors: [err.message] });
    }
};

exports.addDivisionSegmentDropdowns = addDivisionSegmentDropdowns;
