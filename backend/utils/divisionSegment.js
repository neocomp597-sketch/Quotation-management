/**
 * Division / Segment Master helpers shared by the masters, Invoice Bulk Upload single
 * entry and the Excel import.
 *
 * Records store divisionId / segmentId. Excel files carry codes only (Division_Code,
 * Segment_Code); exports add the descriptions. Whatever the Excel dropdowns allow, the
 * backend checks every row: a segment must belong to the division given with it.
 */
const mongoose = require('mongoose');
const Division = require('../models/Division');
const Segment = require('../models/Segment');

const DEFAULT_DIVISIONS = [
    { code: 'U', description: 'U' },
    { code: 'UC', description: 'UC' },
    { code: 'IND', description: 'IND' },
    { code: 'EXP', description: 'EXP' },
    { code: 'CCD', description: 'CCD' },
    { code: 'OTHERS', description: 'Others' }
];

// Shown when a Division has no active segment yet (e.g. EXP / CCD before their segments
// are defined): no Invoice Bulk Upload entry can be saved under it.
const NO_ACTIVE_SEGMENTS_MESSAGE = 'No active segments are configured for this Division. Please contact the administrator.';

const normalizeCode = (value) => String(value ?? '').trim().toUpperCase();

/** "IND - IND" — how a division or segment is shown wherever the user picks one. */
const formatCodeLabel = (doc) => {
    if (!doc) return '';
    const code = String(doc.code || '').trim();
    const description = String(doc.description || '').trim();
    return code && description ? `${code} - ${description}` : (code || description);
};

/**
 * Inserts the standard Division codes a company does not have yet. Existing divisions are
 * never changed. Called when a company is created (models/Company.js) and by the one-time
 * script scripts/seedDivisionMaster.js for companies that existed before; reading the
 * masters never creates data. Returns the number of divisions inserted.
 */
const seedDefaultDivisions = async (companyId) => {
    if (!companyId) return 0;
    const result = await Division.bulkWrite(
        DEFAULT_DIVISIONS.map((division) => ({
            updateOne: {
                filter: { companyId, code: division.code },
                update: { $setOnInsert: { ...division, companyId, status: 'Active', createdAt: new Date(), updatedAt: new Date() } },
                upsert: true
            }
        })),
        { ordered: false }
    );
    return result.upsertedCount || 0;
};

/**
 * Loads the company's divisions and segments once (for an import of many rows) and
 * returns lookups by code and id.
 */
const loadDivisionSegmentLookup = async (companyId) => {
    const [divisions, segments] = await Promise.all([
        Division.find({ companyId }).lean(),
        Segment.find({ companyId }).lean()
    ]);
    const lookup = {
        divisions,
        segments,
        divisionByCode: new Map(divisions.map((d) => [normalizeCode(d.code), d])),
        divisionById: new Map(divisions.map((d) => [String(d._id), d])),
        segmentByCode: new Map(segments.map((s) => [normalizeCode(s.code), s])),
        segmentById: new Map(segments.map((s) => [String(s._id), s]))
    };
    return lookup;
};

const validationError = (message) => {
    const err = new Error(message);
    err.statusCode = 400;
    return err;
};

/**
 * Resolves a Division / Segment pair given by id (single entry form) or by code (Excel).
 *
 *   - a segment without a division takes the segment's division
 *   - a segment that belongs to a different division is rejected
 *   - unknown or inactive codes are rejected
 *   - `required` makes both mandatory
 *
 * Returns { division, segment } (either may be null when not required and not given).
 */
const resolveDivisionSegment = (lookup, input = {}, { required = false } = {}) => {
    const divisionIdIn = input.divisionId ? String(input.divisionId?._id || input.divisionId) : '';
    const segmentIdIn = input.segmentId ? String(input.segmentId?._id || input.segmentId) : '';
    const divisionCodeIn = normalizeCode(input.divisionCode);
    const segmentCodeIn = normalizeCode(input.segmentCode);

    let division = null;
    if (divisionIdIn) {
        if (!mongoose.Types.ObjectId.isValid(divisionIdIn) || !lookup.divisionById.has(divisionIdIn)) {
            throw validationError('Selected Division does not exist in the Division Master.');
        }
        division = lookup.divisionById.get(divisionIdIn);
    } else if (divisionCodeIn) {
        division = lookup.divisionByCode.get(divisionCodeIn);
        if (!division) throw validationError(`Division ${divisionCodeIn} does not exist in the Division Master.`);
    }

    let segment = null;
    if (segmentIdIn) {
        if (!mongoose.Types.ObjectId.isValid(segmentIdIn) || !lookup.segmentById.has(segmentIdIn)) {
            throw validationError('Selected Segment does not exist in the Segment Master.');
        }
        segment = lookup.segmentById.get(segmentIdIn);
    } else if (segmentCodeIn) {
        segment = lookup.segmentByCode.get(segmentCodeIn);
        if (!segment) throw validationError(`Segment ${segmentCodeIn} does not exist in the Segment Master.`);
    }

    if (segment) {
        const segmentDivision = lookup.divisionById.get(String(segment.divisionId));
        if (division && String(segment.divisionId) !== String(division._id)) {
            throw validationError(`Segment ${segment.code} does not belong to Division ${division.code}.`);
        }
        if (!division) division = segmentDivision || null;
    }

    if (division && division.status !== 'Active') {
        throw validationError(`Division ${division.code} is inactive.`);
    }
    if (segment && segment.status !== 'Active') {
        throw validationError(`Segment ${segment.code} is inactive.`);
    }

    if (required) {
        if (!division) throw validationError('Division is required.');
        if (!segment) {
            const hasActiveSegment = [...lookup.segmentById.values()].some(
                (s) => String(s.divisionId) === String(division._id) && s.status === 'Active'
            );
            throw validationError(hasActiveSegment
                ? 'Segment is required.'
                : NO_ACTIVE_SEGMENTS_MESSAGE);
        }
    }

    return { division, segment };
};

// Excel defined names may hold letters, digits, "_" and "."; prefixing keeps codes such as
// "U" from being read as a column reference.
const segmentRangeName = (divisionCode) => `SEG_${normalizeCode(divisionCode).replace(/[^A-Z0-9_]/g, '_')}`;

const columnLetter = (index) => {
    let n = index;
    let letters = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        letters = String.fromCharCode(65 + rem) + letters;
        n = Math.floor((n - 1) / 26);
    }
    return letters;
};

/**
 * Adds Division_Code / Segment_Code dropdowns to an exceljs worksheet. The lists are read
 * from the masters (never hard-coded) and written to a hidden "Lists" sheet:
 *
 *   - Division_Code: active division codes
 *   - Segment_Code:  the active segments of the division chosen on that row, or every
 *                    active segment while the row's division is still empty
 */
const addDivisionSegmentDropdowns = (workbook, worksheet, {
    divisions,
    segments,
    divisionColumn,
    segmentColumn,
    firstRow = 2,
    lastRow = 1000
}) => {
    const activeDivisions = divisions.filter((d) => d.status === 'Active');
    const activeSegments = segments.filter((s) => s.status === 'Active');

    const lists = workbook.getWorksheet('Lists') || workbook.addWorksheet('Lists', { state: 'veryHidden' });
    lists.getCell(1, 1).value = 'Division_Code';
    activeDivisions.forEach((d, i) => { lists.getCell(i + 2, 1).value = d.code; });

    lists.getCell(1, 2).value = 'Segment_Code (all)';
    activeSegments.forEach((s, i) => { lists.getCell(i + 2, 2).value = s.code; });

    const divisionRangeEnd = Math.max(2, activeDivisions.length + 1);
    const allSegmentsEnd = Math.max(2, activeSegments.length + 1);
    workbook.definedNames.add(`Lists!$A$2:$A$${divisionRangeEnd}`, 'DIVISION_CODES');
    workbook.definedNames.add(`Lists!$B$2:$B$${allSegmentsEnd}`, 'SEGMENT_CODES');

    activeDivisions.forEach((division, i) => {
        const col = i + 3;
        const letter = columnLetter(col);
        const own = activeSegments.filter((s) => String(s.divisionId) === String(division._id));
        lists.getCell(1, col).value = division.code;
        own.forEach((s, j) => { lists.getCell(j + 2, col).value = s.code; });
        const end = Math.max(2, own.length + 1);
        workbook.definedNames.add(`Lists!$${letter}$2:$${letter}$${end}`, segmentRangeName(division.code));
    });

    const divLetter = columnLetter(divisionColumn);
    const segLetter = columnLetter(segmentColumn);
    const divisionList = activeDivisions.map((d) => d.code).join(', ');

    worksheet.dataValidations.add(`${divLetter}${firstRow}:${divLetter}${lastRow}`, {
        type: 'list',
        allowBlank: true,
        formulae: ['DIVISION_CODES'],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Division',
        error: `Choose a Division_Code from the Division Master${divisionList ? ` (${divisionList})` : ''}.`
    });
    worksheet.dataValidations.add(`${segLetter}${firstRow}:${segLetter}${lastRow}`, {
        type: 'list',
        allowBlank: true,
        formulae: [`IF($${divLetter}${firstRow}="",SEGMENT_CODES,INDIRECT("${segmentRangeName('')}"&$${divLetter}${firstRow}))`],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Segment',
        error: 'Choose a Segment_Code that belongs to the selected Division.'
    });
};

module.exports = {
    DEFAULT_DIVISIONS,
    NO_ACTIVE_SEGMENTS_MESSAGE,
    normalizeCode,
    formatCodeLabel,
    seedDefaultDivisions,
    loadDivisionSegmentLookup,
    resolveDivisionSegment,
    addDivisionSegmentDropdowns,
    columnLetter
};
