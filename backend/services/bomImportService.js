const XLSX = require('xlsx');
const BOMMaster = require('../models/BOMMaster');
const BOMItem = require('../models/BOMItem');
const { prepareBOM, toKey } = require('./bomService');

/**
 * Bulk BOM import from an Excel/CSV workbook.
 *
 * Parsing lives here; validation, Product Master lookups and MGR1-MGR5 resolution are
 * delegated to prepareBOM() so bulk upload and manual entry behave identically.
 *
 * Each FG serial number in the file becomes one BOM with its rows as components.
 */

const TEMPLATE_HEADERS = [
    'Item code_FG',
    'FG Serial number',
    'Item code',
    'Item description',
    'Qty',
    'Component serial number',
    'Batch number',
    'Remarks'
];

const cleanCell = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeHeader = (value) => cleanCell(value).toLowerCase().replace(/[^a-z0-9]/g, '');

// Normalised header -> field. A plain "Serial number" heading is ambiguous and is
// resolved by position below (first = FG serial, second = component serial).
const HEADER_ALIASES = {
    itemcodefg: 'fgItemCode',
    fgitemcode: 'fgItemCode',
    fgcode: 'fgItemCode',
    fgserialnumber: 'fgSerialNumber',
    fgserialno: 'fgSerialNumber',
    serialnumberfg: 'fgSerialNumber',
    itemcode: 'itemCode',
    componentitemcode: 'itemCode',
    materialcode: 'itemCode',
    itemdescription: 'itemDescription',
    description: 'itemDescription',
    componentdescription: 'itemDescription',
    qty: 'qty',
    quantity: 'qty',
    componentserialnumber: 'componentSerialNumber',
    componentserialno: 'componentSerialNumber',
    serialnumbercomponent: 'componentSerialNumber',
    batchnumber: 'batchNumber',
    batchno: 'batchNumber',
    batch: 'batchNumber',
    remarks: 'remarks',
    remark: 'remarks',
    note: 'remarks',
    notes: 'remarks'
};

const GENERIC_SERIAL_HEADERS = ['serialnumber', 'serialno', 'srno', 'slno'];

const REQUIRED_COLUMNS = {
    fgItemCode: 'Item code_FG',
    fgSerialNumber: 'FG Serial number',
    itemCode: 'Item code',
    qty: 'Qty'
};

/**
 * Maps column indexes to fields. Handles both the explicit template headers and the
 * original layout that has two identically named "Serial number" columns.
 */
const mapHeaders = (headerRow = []) => {
    const columns = {};
    const genericSerialColumns = [];

    headerRow.forEach((header, index) => {
        const normalized = normalizeHeader(header);
        if (!normalized) return;
        if (GENERIC_SERIAL_HEADERS.includes(normalized)) {
            genericSerialColumns.push(index);
            return;
        }
        const field = HEADER_ALIASES[normalized];
        if (field && columns[field] === undefined) columns[field] = index;
    });

    genericSerialColumns.forEach((index) => {
        if (columns.fgSerialNumber === undefined) columns.fgSerialNumber = index;
        else if (columns.componentSerialNumber === undefined) columns.componentSerialNumber = index;
    });

    const missing = Object.entries(REQUIRED_COLUMNS)
        .filter(([field]) => columns[field] === undefined)
        .map(([, label]) => label);

    return { columns, missing };
};

const readRows = (buffer) => {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
        throw Object.assign(new Error('The file has no worksheets.'), { status: 400 });
    }

    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: true });
    if (!matrix.length) {
        throw Object.assign(new Error('The file is empty.'), { status: 400 });
    }

    const { columns, missing } = mapHeaders(matrix[0] || []);
    if (missing.length) {
        throw Object.assign(
            new Error(`Missing required column(s): ${missing.join(', ')}. Download the template for the expected layout.`),
            { status: 400 }
        );
    }

    const rows = [];
    for (let i = 1; i < matrix.length; i++) {
        const raw = matrix[i] || [];
        const row = { rowNumber: i + 1 };
        Object.entries(columns).forEach(([field, index]) => {
            row[field] = cleanCell(raw[index]);
        });
        const isBlank = Object.keys(REQUIRED_COLUMNS).every((field) => !row[field]) && !row.itemDescription;
        if (!isBlank) rows.push(row);
    }
    return rows;
};

/** Groups the flat rows into one payload per FG serial number, preserving file order. */
const groupBySerial = (rows) => {
    const groups = new Map();
    rows.forEach((row) => {
        const key = toKey(row.fgSerialNumber);
        if (!groups.has(key)) {
            groups.set(key, {
                fgItemCode: row.fgItemCode,
                fgSerialNumber: row.fgSerialNumber,
                firstRow: row.rowNumber,
                rowNumbers: [],
                items: []
            });
        }
        const group = groups.get(key);
        if (!group.fgItemCode && row.fgItemCode) group.fgItemCode = row.fgItemCode;
        group.rowNumbers.push(row.rowNumber);
        group.items.push({
            itemCode: row.itemCode,
            itemDescription: row.itemDescription,
            qty: row.qty,
            componentSerialNumber: row.componentSerialNumber,
            batchNumber: row.batchNumber,
            remarks: row.remarks
        });
    });
    return [...groups.values()];
};

/**
 * Imports a workbook. Existing BOMs for a serial are replaced so re-uploading a corrected
 * file is safe. Returns per-serial counts plus the reason for every serial that failed.
 */
const importBOMWorkbook = async (buffer, { fileName = '', userId = null } = {}) => {
    const groups = groupBySerial(readRows(buffer));
    if (!groups.length) {
        throw Object.assign(new Error('No data rows found in the file.'), { status: 400 });
    }

    const summary = { fileName, serials: groups.length, created: 0, updated: 0, failed: 0, components: 0, errors: [] };

    for (const group of groups) {
        const label = `FG serial "${group.fgSerialNumber || '(blank)'}" (row ${group.firstRow})`;
        try {
            const { errors, master, items } = await prepareBOM(group);
            if (errors.length) {
                summary.failed++;
                summary.errors.push({ serial: group.fgSerialNumber, row: group.firstRow, message: errors.join(' ') });
                continue;
            }

            const existing = await BOMMaster.findOne({ fgSerialKey: master.fgSerialKey });
            if (existing) {
                await BOMItem.deleteMany({ bomMasterId: existing._id });
                await BOMMaster.updateOne(
                    { _id: existing._id },
                    { ...master, sourceFileName: fileName, status: 'Active', updatedBy: userId }
                );
                await BOMItem.insertMany(items.map((item) => ({ ...item, bomMasterId: existing._id })));
                summary.updated++;
            } else {
                const created = await BOMMaster.create({
                    ...master,
                    sourceFileName: fileName,
                    status: 'Active',
                    createdBy: userId,
                    updatedBy: userId
                });
                try {
                    await BOMItem.insertMany(items.map((item) => ({ ...item, bomMasterId: created._id })));
                } catch (itemError) {
                    await BOMMaster.deleteOne({ _id: created._id });
                    throw itemError;
                }
                summary.created++;
            }
            summary.components += items.length;
        } catch (error) {
            summary.failed++;
            summary.errors.push({ serial: group.fgSerialNumber, row: group.firstRow, message: `${label}: ${error.message}` });
        }
    }

    return summary;
};

/** Builds the upload template: one sample row plus a short guide sheet. */
const buildTemplateBuffer = () => {
    const sample = [{
        'Item code_FG': 'FG-1001',
        'FG Serial number': 'SN-FG-0001',
        'Item code': 'RM-2001',
        'Item description': 'Used only when the item code is not in Product Master',
        'Qty': 2,
        'Component serial number': 'SN-CMP-0001',
        'Batch number': 'BATCH-01',
        'Remarks': 'Free text, optional'
    }];

    const sheet = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_HEADERS });
    sheet['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 52 }, { wch: 8 }, { wch: 22 }, { wch: 16 }, { wch: 30 }];

    const guide = XLSX.utils.aoa_to_sheet([
        ['Column', 'Required', 'Notes'],
        ['Item code_FG', 'Yes', 'Finished good item code.'],
        ['FG Serial number', 'Yes', 'One BOM per FG serial. Repeat the serial on every component row of that BOM.'],
        ['Item code', 'Yes', 'Component item code. Description and MGR1-MGR5 come from Product Master when the code is found.'],
        ['Item description', 'Only if the item code is not in Product Master', 'Used as a fallback description; MGR1-MGR5 stay blank.'],
        ['Qty', 'Yes', 'Must be a number greater than 0.'],
        ['Component serial number', 'No', 'Serial number of the component, if tracked.'],
        ['Batch number', 'No', 'Batch of the component, if tracked.'],
        ['Remarks', 'No', 'Free text kept against the component.'],
        [],
        ['Re-uploading a serial replaces the components of its existing BOM.']
    ]);
    guide['!cols'] = [{ wch: 26 }, { wch: 36 }, { wch: 86 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'BOM');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guide');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = { importBOMWorkbook, buildTemplateBuffer, mapHeaders, TEMPLATE_HEADERS };
