const XLSX = require('xlsx');
const Product = require('../models/Product');
const Asset = require('../models/Asset');
const BOMMaster = require('../models/BOMMaster');
const BOMItem = require('../models/BOMItem');

const TEMPLATE_HEADERS = [
    'Item code_FG',
    'FG Serial number',
    'Item code',
    'Item description',
    'Qty',
    'Component serial number',
    'Batch number'
];

const MGR_FIELDS = ['mgr1', 'mgr2', 'mgr3', 'mgr4', 'mgr5'];

const cleanCell = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizeHeader = (value) => cleanCell(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const toKey = (value) => cleanCell(value).toUpperCase();

// Normalised header -> field. Plain "Serial number" is ambiguous and handled by position below.
const HEADER_ALIASES = {
    itemcodefg: 'fgItemCode',
    fgitemcode: 'fgItemCode',
    fgcode: 'fgItemCode',
    fgserialnumber: 'fgSerialNumber',
    fgserialno: 'fgSerialNumber',
    serialnumberfg: 'fgSerialNumber',
    itemcode: 'itemCode',
    componentitemcode: 'itemCode',
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
    batch: 'batchNumber'
};
const GENERIC_SERIAL_HEADERS = ['serialnumber', 'serialno', 'srno', 'slno'];
const REQUIRED_FIELDS = {
    fgItemCode: 'Item code_FG',
    fgSerialNumber: 'FG Serial number',
    itemCode: 'Item code',
    itemDescription: 'Item description',
    qty: 'Qty'
};

/**
 * Maps column indexes to fields. Supports the explicit template headers and the original
 * layout with two identical "Serial number" columns: the first one is taken as the FG serial,
 * the second as the component serial.
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
        if (field && columns[field] === undefined) {
            columns[field] = index;
        }
    });

    genericSerialColumns.forEach((index) => {
        if (columns.fgSerialNumber === undefined) columns.fgSerialNumber = index;
        else if (columns.componentSerialNumber === undefined) columns.componentSerialNumber = index;
    });

    const missing = Object.entries(REQUIRED_FIELDS)
        .filter(([field]) => columns[field] === undefined)
        .map(([, label]) => label);

    return { columns, missing };
};

const readRows = (buffer) => {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
        throw Object.assign(new Error('The file has no worksheets'), { status: 400 });
    }

    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true, raw: true });
    const { columns, missing } = mapHeaders(matrix[0] || []);
    if (missing.length) {
        throw Object.assign(
            new Error(`Missing required column(s): ${missing.join(', ')}. Download the template for the expected layout.`),
            { status: 400 }
        );
    }

    const rows = [];
    for (let i = 1; i < matrix.length; i += 1) {
        const cells = matrix[i] || [];
        const pick = (field) => (columns[field] === undefined ? '' : cells[columns[field]]);
        const row = {
            rowNumber: i + 1,
            fgItemCode: cleanCell(pick('fgItemCode')),
            fgSerialNumber: cleanCell(pick('fgSerialNumber')),
            itemCode: cleanCell(pick('itemCode')),
            itemDescription: cleanCell(pick('itemDescription')),
            qtyRaw: pick('qty'),
            componentSerialNumber: cleanCell(pick('componentSerialNumber')),
            batchNumber: cleanCell(pick('batchNumber'))
        };
        const isBlank = !row.fgItemCode && !row.fgSerialNumber && !row.itemCode
            && !row.itemDescription && cleanCell(row.qtyRaw) === ''
            && !row.componentSerialNumber && !row.batchNumber;
        if (!isBlank) rows.push(row);
    }
    return rows;
};

const validateRow = (row) => {
    const errors = [];
    if (!row.fgItemCode) errors.push('Item code_FG is required');
    if (!row.fgSerialNumber) errors.push('FG Serial number is required');
    if (!row.itemCode) errors.push('Item code is required');

    const qtyText = cleanCell(row.qtyRaw);
    const qty = Number(qtyText);
    if (qtyText === '') errors.push('Qty is required');
    else if (!Number.isFinite(qty)) errors.push(`Qty "${qtyText}" is not a number`);
    else if (qty <= 0) errors.push('Qty must be greater than 0');
    row.qty = qty;

    return errors;
};

// Product codes are matched case-insensitively without a regex scan per row.
const findProductsByCode = async (codes) => {
    const variants = new Set();
    codes.forEach((code) => {
        variants.add(code);
        variants.add(code.toUpperCase());
        variants.add(code.toLowerCase());
    });
    if (!variants.size) return new Map();

    const products = await Product.find({ productCode: { $in: [...variants] } })
        .select(`productCode productName description ${MGR_FIELDS.join(' ')}`)
        .lean();

    const byKey = new Map();
    products.forEach((product) => {
        const key = toKey(product.productCode);
        if (!byKey.has(key)) byKey.set(key, product);
    });
    return byKey;
};

const findAssetsBySerial = async (serials) => {
    const variants = new Set();
    serials.forEach((serial) => {
        variants.add(serial);
        variants.add(serial.toUpperCase());
        variants.add(serial.toLowerCase());
    });
    if (!variants.size) return new Map();

    const assets = await Asset.find({ serialNumber: { $in: [...variants] } })
        .select('serialNumber productId productCode')
        .lean();

    const byKey = new Map();
    assets.forEach((asset) => {
        const key = toKey(asset.serialNumber);
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(asset);
    });
    return byKey;
};

const masterDescription = (product) => cleanCell(product?.productName) || cleanCell(product?.description);

const toErrorRow = (row, error) => ({
    row: row.rowNumber,
    fgItemCode: row.fgItemCode,
    fgSerialNumber: row.fgSerialNumber,
    itemCode: row.itemCode,
    itemDescription: row.itemDescription,
    qty: cleanCell(row.qtyRaw),
    componentSerialNumber: row.componentSerialNumber,
    batchNumber: row.batchNumber,
    error
});

/**
 * Imports a BOM workbook. Rows are grouped by FG serial number and each serial is imported
 * all-or-nothing: if any of its rows is invalid, none of them are written, so a BOM is never
 * replaced with a partial component list. An FG serial that already has a BOM gets its
 * components replaced by the uploaded ones.
 */
const importBOMWorkbook = async ({ buffer, fileName = '', userId }) => {
    const rows = readRows(buffer);
    if (!rows.length) {
        throw Object.assign(new Error('The file has no data rows'), { status: 400 });
    }

    const rowErrors = new Map();
    const addError = (row, message) => {
        if (!rowErrors.has(row.rowNumber)) rowErrors.set(row.rowNumber, []);
        rowErrors.get(row.rowNumber).push(message);
    };

    rows.forEach((row) => validateRow(row).forEach((message) => addError(row, message)));

    const productsByCode = await findProductsByCode(
        [...new Set(rows.flatMap((row) => [row.itemCode, row.fgItemCode]).filter(Boolean))]
    );

    // The uploaded description is only a fallback, so it is needed only for items missing from Product Master.
    rows.forEach((row) => {
        if (row.itemCode && !row.itemDescription && !productsByCode.has(toKey(row.itemCode))) {
            addError(row, `Item description is required because item code ${row.itemCode} is not in Product Master`);
        }
    });

    // Group by FG serial and check each group is internally consistent.
    const groups = new Map();
    rows.forEach((row) => {
        if (!row.fgSerialNumber) return;
        const key = toKey(row.fgSerialNumber);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    });

    groups.forEach((groupRows) => {
        const first = groupRows.find((row) => row.fgItemCode) || groupRows[0];
        const seenLines = new Map();

        groupRows.forEach((row) => {
            if (row.fgItemCode && toKey(row.fgItemCode) !== toKey(first.fgItemCode)) {
                addError(row, `FG serial ${row.fgSerialNumber} is already listed under Item code_FG ${first.fgItemCode} (row ${first.rowNumber})`);
            }
            if (!row.itemCode) return;
            const lineKey = [row.itemCode, row.componentSerialNumber, row.batchNumber].map(toKey).join('|');
            if (seenLines.has(lineKey)) {
                addError(row, `Duplicate component line (same Item code, Component serial and Batch as row ${seenLines.get(lineKey)})`);
            } else {
                seenLines.set(lineKey, row.rowNumber);
            }
        });
    });

    const assetsBySerial = await findAssetsBySerial([...groups.values()].map((groupRows) => groupRows[0].fgSerialNumber));

    const existingMasters = await BOMMaster.find({ fgSerialKey: { $in: [...groups.keys()] } })
        .select('_id fgSerialKey')
        .lean();
    const existingByKey = new Map(existingMasters.map((master) => [master.fgSerialKey, master]));

    const failedRows = [];
    const unmatchedItemCodes = new Set();
    const summary = {
        totalRows: rows.length,
        successRows: 0,
        failedRows: 0,
        fgSerialCount: 0,
        bomsCreated: 0,
        bomsReplaced: 0,
        itemsCreated: 0,
        itemsNotInProductMaster: 0
    };

    // Rows without an FG serial can't belong to any BOM.
    rows.filter((row) => !row.fgSerialNumber).forEach((row) => {
        failedRows.push(toErrorRow(row, (rowErrors.get(row.rowNumber) || []).join('; ')));
    });

    for (const [serialKey, groupRows] of groups) {
        const groupHasErrors = groupRows.some((row) => rowErrors.has(row.rowNumber));
        if (groupHasErrors) {
            groupRows.forEach((row) => {
                const own = rowErrors.get(row.rowNumber);
                failedRows.push(toErrorRow(
                    row,
                    own ? own.join('; ') : `Not imported: other rows for FG serial ${row.fgSerialNumber} have errors`
                ));
            });
            continue;
        }

        const first = groupRows[0];
        const fgProduct = productsByCode.get(toKey(first.fgItemCode)) || null;
        const assetCandidates = assetsBySerial.get(serialKey) || [];
        const asset = assetCandidates.find((candidate) => (
            (fgProduct && String(candidate.productId) === String(fgProduct._id))
            || toKey(candidate.productCode) === toKey(first.fgItemCode)
        )) || assetCandidates[0] || null;

        const masterFields = {
            fgItemCode: first.fgItemCode,
            fgItemDescription: masterDescription(fgProduct),
            fgProductId: fgProduct?._id || null,
            fgSerialNumber: first.fgSerialNumber,
            fgSerialKey: serialKey,
            assetId: asset?._id || null,
            componentCount: groupRows.length,
            status: 'Active',
            sourceFileName: fileName,
            updatedBy: userId
        };

        const buildItems = (bomMasterId) => groupRows.map((row, index) => {
            const product = productsByCode.get(toKey(row.itemCode));
            if (!product) unmatchedItemCodes.add(row.itemCode);
            const item = {
                bomMasterId,
                lineNo: index + 1,
                itemCode: product ? product.productCode : row.itemCode,
                itemDescription: masterDescription(product) || row.itemDescription,
                uploadedDescription: row.itemDescription,
                productId: product?._id || null,
                qty: row.qty,
                componentSerialNumber: row.componentSerialNumber,
                batchNumber: row.batchNumber
            };
            MGR_FIELDS.forEach((field) => { item[field] = product?.[field] || null; });
            return item;
        });

        try {
            const existing = existingByKey.get(serialKey);
            if (existing) {
                // Insert the new lines before removing the old ones so a failure never leaves the BOM empty.
                const inserted = await BOMItem.insertMany(buildItems(existing._id));
                await BOMItem.deleteMany({
                    bomMasterId: existing._id,
                    _id: { $nin: inserted.map((item) => item._id) }
                });
                await BOMMaster.updateOne({ _id: existing._id }, { $set: masterFields });
                summary.bomsReplaced += 1;
            } else {
                const master = await BOMMaster.create({ ...masterFields, createdBy: userId });
                try {
                    await BOMItem.insertMany(buildItems(master._id));
                } catch (itemError) {
                    await BOMMaster.deleteOne({ _id: master._id });
                    throw itemError;
                }
                summary.bomsCreated += 1;
            }

            summary.fgSerialCount += 1;
            summary.successRows += groupRows.length;
            summary.itemsCreated += groupRows.length;
            summary.itemsNotInProductMaster += groupRows.filter((row) => !productsByCode.has(toKey(row.itemCode))).length;
        } catch (error) {
            const message = error.code === 11000
                ? `BOM for FG serial ${first.fgSerialNumber} was created by another upload at the same time; upload again`
                : `Could not save BOM: ${error.message}`;
            groupRows.forEach((row) => failedRows.push(toErrorRow(row, message)));
        }
    }

    failedRows.sort((a, b) => a.row - b.row);
    summary.failedRows = failedRows.length;

    return {
        summary,
        errors: failedRows,
        unmatchedItemCodes: [...unmatchedItemCodes].slice(0, 500)
    };
};

const buildTemplateBuffer = () => {
    const workbook = XLSX.utils.book_new();
    const sample = [
        TEMPLATE_HEADERS,
        ['FG100', 'FG-SN-001', 'MOTOR01', 'Motor', 1, 'MOTOR-SN-55', 'B001'],
        ['FG100', 'FG-SN-001', 'SENSOR02', 'Sensor', 2, '', 'B002']
    ];
    const sheet = XLSX.utils.aoa_to_sheet(sample);
    sheet['!cols'] = TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(16, header.length + 4) }));
    XLSX.utils.book_append_sheet(workbook, sheet, 'BOM');

    const notes = XLSX.utils.aoa_to_sheet([
        ['Column', 'Required', 'Notes'],
        ['Item code_FG', 'Yes', 'Finished-good item code'],
        ['FG Serial number', 'Yes', 'Serial number of the finished good. One BOM per FG serial; re-uploading a serial replaces its BOM.'],
        ['Item code', 'Yes', 'Component item code. MGR1-MGR5 and description are taken from Product Master when found.'],
        ['Item description', 'Yes', 'Used only when the item code is not in Product Master'],
        ['Qty', 'Yes', 'Must be greater than 0'],
        ['Component serial number', 'No', 'Serial number of the component'],
        ['Batch number', 'No', 'Component batch']
    ]);
    notes['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, notes, 'Instructions');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
    importBOMWorkbook,
    buildTemplateBuffer,
    mapHeaders,
    toKey
};
