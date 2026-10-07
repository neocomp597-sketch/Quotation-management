const XLSX = require('xlsx');
const BOMMaster = require('../models/BOMMaster');
const BOMItem = require('../models/BOMItem');
const { prepareBOM, toKey } = require('./bomService');

/**
 * Bulk BOM import from an Excel/CSV workbook.
 *
 * The standard layout is the BOM relationship sheet exported from SAP:
 *
 *     Parent Item Code | Item Code | Item Name | UOM | Quantity
 *
 * Every Parent Item Code becomes one BOM (keyed by that code) with its rows as components.
 * A component that is itself a parent further down the sheet is a sub-assembly: it gets a
 * BOM of its own, and the export walks the tree back into the same layout.
 *
 * The older serial-wise layout (Item code_FG, FG Serial number, Item code, ...) is still
 * accepted so existing files keep working.
 *
 * Validation, Product Master lookups and MGR1-MGR5 resolution are delegated to prepareBOM()
 * so bulk upload and manual entry behave identically. Lines that cannot be used (an SAP
 * print footer, a blank quantity) are skipped and reported; they never fail the file.
 */

const TEMPLATE_HEADERS = ['Parent Item Code', 'Item Code', 'Item Name', 'UOM', 'Quantity'];

const cleanCell = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeHeader = (value) => cleanCell(value).toLowerCase().replace(/[^a-z0-9]/g, '');

// Normalised header -> field. A plain "Serial number" heading is ambiguous and is
// resolved by position below (first = FG serial, second = component serial).
const HEADER_ALIASES = {
    parentitemcode: 'fgItemCode',
    parentcode: 'fgItemCode',
    parentitem: 'fgItemCode',
    itemcodefg: 'fgItemCode',
    fgitemcode: 'fgItemCode',
    fgcode: 'fgItemCode',
    fgserialnumber: 'fgSerialNumber',
    fgserialno: 'fgSerialNumber',
    serialnumberfg: 'fgSerialNumber',
    itemcode: 'itemCode',
    childitemcode: 'itemCode',
    componentitemcode: 'itemCode',
    materialcode: 'itemCode',
    itemname: 'itemDescription',
    itemdescription: 'itemDescription',
    description: 'itemDescription',
    componentdescription: 'itemDescription',
    uom: 'uom',
    unit: 'uom',
    unitofmeasure: 'uom',
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
    fgItemCode: 'Parent Item Code',
    itemCode: 'Item Code',
    qty: 'Quantity'
};

/** Maps column indexes to fields. */
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

// The header is normally the first row, but SAP exports can carry a title line or two above it.
const findHeaderRow = (matrix) => {
    for (let i = 0; i < Math.min(matrix.length, 10); i++) {
        const mapped = mapHeaders(matrix[i] || []);
        if (!mapped.missing.length) return { index: i, ...mapped };
    }
    return { index: 0, ...mapHeaders(matrix[0] || []) };
};

const readRows = (buffer) => {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
        throw Object.assign(new Error('The file has no worksheets.'), { status: 400 });
    }

    // Raw cell values: a long numeric item code stays 2304100045 rather than a formatted 2.3E+09.
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: true });
    if (!matrix.length) {
        throw Object.assign(new Error('The file is empty.'), { status: 400 });
    }

    const { index: headerIndex, columns, missing } = findHeaderRow(matrix);
    if (missing.length) {
        throw Object.assign(
            new Error(`Missing required column(s): ${missing.join(', ')}. Expected columns: ${TEMPLATE_HEADERS.join(', ')}. Download the template for the layout.`),
            { status: 400 }
        );
    }

    const rows = [];
    const skipped = [];
    for (let i = headerIndex + 1; i < matrix.length; i++) {
        const raw = matrix[i] || [];
        const row = { rowNumber: i + 1 };
        Object.entries(columns).forEach(([field, index]) => {
            row[field] = cleanCell(raw[index]);
        });
        if (!row.fgItemCode && !row.itemCode && !row.itemDescription && !row.qty) continue;

        // A line with no quantity and no item name is not a BOM line: SAP prints totals and
        // "Page 1 of 1" / "Printed by SAP Business One" footers into the same columns.
        if (!row.qty && !row.uom && !row.itemDescription) {
            skipped.push({ row: row.rowNumber, serial: row.fgItemCode, message: `Not a BOM line ("${row.itemCode || row.fgItemCode}"), skipped.` });
            continue;
        }
        if (!row.fgItemCode) {
            skipped.push({ row: row.rowNumber, serial: '', message: 'Parent Item Code is blank, line skipped.' });
            continue;
        }
        rows.push(row);
    }
    return { rows, skipped, hasSerialColumn: columns.fgSerialNumber !== undefined };
};

/**
 * Groups the rows into one payload per BOM, preserving file order. With the relationship
 * sheet a BOM is a Parent Item Code; with the older layout it is an FG serial number.
 */
const groupRows = (rows, hasSerialColumn) => {
    // A parent's name is the Item Name it carries where it appears as a component.
    const nameByCode = new Map();
    rows.forEach((row) => {
        if (row.itemCode && row.itemDescription && !nameByCode.has(toKey(row.itemCode))) {
            nameByCode.set(toKey(row.itemCode), row.itemDescription);
        }
    });

    const groups = new Map();
    rows.forEach((row) => {
        const serial = hasSerialColumn && row.fgSerialNumber ? row.fgSerialNumber : row.fgItemCode;
        const key = toKey(serial);
        if (!groups.has(key)) {
            groups.set(key, {
                fgItemCode: row.fgItemCode,
                fgItemDescription: nameByCode.get(toKey(row.fgItemCode)) || '',
                fgSerialNumber: serial,
                firstRow: row.rowNumber,
                items: []
            });
        }
        const group = groups.get(key);
        if (!group.fgItemCode && row.fgItemCode) group.fgItemCode = row.fgItemCode;
        group.items.push({
            rowNumber: row.rowNumber,
            itemCode: row.itemCode,
            itemDescription: row.itemDescription,
            uom: row.uom,
            qty: row.qty,
            componentSerialNumber: row.componentSerialNumber,
            batchNumber: row.batchNumber,
            remarks: row.remarks
        });
    });
    return [...groups.values()];
};

const statusLog = (reason, userId, userName) => ({
    status: 'Active', reason, changedBy: userId, changedByName: userName, changedAt: new Date()
});

/**
 * Imports a workbook. An existing BOM for the same parent item (or serial) has its components
 * replaced, so re-uploading a corrected file is safe. Returns counts, the reason for every BOM
 * that could not be saved, and the lines that were skipped.
 */
const importBOMWorkbook = async (buffer, { fileName = '', userId = null, userName = '' } = {}) => {
    const { rows, skipped, hasSerialColumn } = readRows(buffer);
    const groups = groupRows(rows, hasSerialColumn);
    if (!groups.length) {
        throw Object.assign(new Error('No BOM lines found in the file.'), { status: 400 });
    }

    const summary = {
        fileName,
        serials: groups.length,
        boms: groups.length,
        created: 0,
        updated: 0,
        failed: 0,
        components: 0,
        skippedLines: skipped.length,
        errors: [],
        warnings: [...skipped]
    };

    for (const group of groups) {
        const label = `Parent ${group.fgItemCode || '(blank)'}${toKey(group.fgSerialNumber) !== toKey(group.fgItemCode) ? ` / serial ${group.fgSerialNumber}` : ''}`;
        try {
            const { errors, warnings, master, items } = await prepareBOM(group, { lenient: true });
            warnings.forEach((message) => {
                summary.skippedLines++;
                summary.warnings.push({ row: group.firstRow, serial: group.fgItemCode, message });
            });
            if (errors.length) {
                summary.failed++;
                summary.errors.push({ serial: group.fgItemCode, row: group.firstRow, message: `${label}: ${errors.join(' ')}` });
                continue;
            }

            const existing = await BOMMaster.findOne({ fgSerialKey: master.fgSerialKey });
            if (existing) {
                // New lines go in before the old ones are removed, so a failure never empties the BOM.
                const inserted = await BOMItem.insertMany(items.map((item) => ({ ...item, bomMasterId: existing._id })));
                await BOMItem.deleteMany({ bomMasterId: existing._id, _id: { $nin: inserted.map((item) => item._id) } });
                const update = { $set: { ...master, sourceFileName: fileName, status: 'Active', updatedBy: userId } };
                // Re-uploading brings a switched-off BOM back; that is a status change and is logged.
                if (existing.status !== 'Active') {
                    update.$push = { statusHistory: statusLog(`Reactivated by upload${fileName ? ` of ${fileName}` : ''}`, userId, userName) };
                }
                await BOMMaster.updateOne({ _id: existing._id }, update);
                summary.updated++;
            } else {
                const created = await BOMMaster.create({
                    ...master,
                    sourceFileName: fileName,
                    status: 'Active',
                    statusHistory: [statusLog(`Created by upload${fileName ? ` of ${fileName}` : ''}`, userId, userName)],
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
            summary.errors.push({ serial: group.fgItemCode, row: group.firstRow, message: `${label}: ${error.message}` });
        }
    }

    return summary;
};

/** Builds the upload template in the BOM relationship layout, plus a short guide sheet. */
const buildTemplateBuffer = () => {
    const sample = [
        ['2304100045', '2872010207', 'Assy Of Outdoor Type Panel (3-Way Rmu)', 'NOS', 1],
        ['2872010207', '2606010051', 'Sheet Metal_Part_Ms_Assly V Drive Handle_S213R120607', 'NOS', 1],
        ['2872010207', '2803020013', 'Copper_Strip_Ec Grade_12 X 3Mm', 'KGS', 0.04]
    ];
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...sample]);
    sheet['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 60 }, { wch: 10 }, { wch: 10 }];

    const guide = XLSX.utils.aoa_to_sheet([
        ['Column', 'Required', 'Notes'],
        ['Parent Item Code', 'Yes', 'The item this line belongs to. All lines with the same Parent Item Code form one BOM.'],
        ['Item Code', 'Yes', 'Component item code. A component that is also a Parent Item Code is a sub-assembly with its own BOM.'],
        ['Item Name', 'If the item code is not in Product Master', 'Product Master name is shown when the code is found; MGR1-MGR5 always come from Product Master.'],
        ['UOM', 'No', 'Unit of measure (NOS, KGS, MTR, SET...). Product Master UOM is used when blank.'],
        ['Quantity', 'Yes', 'Number greater than 0. Decimals are allowed (0.04 KGS).'],
        [],
        ['Re-uploading a Parent Item Code replaces the components of its existing BOM.'],
        ['Lines without a quantity and item name (SAP totals, "Page 1 of 1" footers) are skipped and listed in the import summary.'],
        ['The same item may appear more than once under one parent.']
    ]);
    guide['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 100 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'BOM Relationships');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guide');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = { importBOMWorkbook, buildTemplateBuffer, mapHeaders, readRows, groupRows, TEMPLATE_HEADERS };
