const XLSX = require('xlsx');
const { MAX_IMPORT_ROWS } = require('../../middlewares/importRowLimit');
const { ImportFileError } = require('./errors');

const isBlank = (value) => (
    value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
);

const cleanLabel = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const isCsvFile = (fileName = '', mimeType = '') => (
    /\.csv$/i.test(fileName) || /csv/i.test(mimeType)
);

/**
 * Reads the first sheet of an Excel or CSV file.
 *
 * The header is the first non-empty row; every later row keeps the row number Excel shows,
 * so issues can point the user at the exact line. Only non-blank cells are kept, keyed by
 * column letter (headers can repeat - SAP exports have two "Industry" columns).
 */
const parseWorkbook = (buffer, { fileName = '', mimeType = '', maxRows = MAX_IMPORT_ROWS } = {}) => {
    if (!buffer?.length) {
        throw new ImportFileError('FILE_EMPTY', 'The uploaded file is empty.', 'Choose the file again and upload it.');
    }

    let workbook;
    try {
        // CSV cells stay text: guessing dates from "01/02/2026" would swap day and month.
        workbook = XLSX.read(buffer, isCsvFile(fileName, mimeType)
            ? { type: 'buffer', raw: true }
            : { type: 'buffer', cellDates: true });
    } catch (error) {
        throw new ImportFileError(
            'FILE_UNREADABLE',
            'This file could not be read.',
            'Open it in Excel, save it as .xlsx (or .csv) and upload it again.'
        );
    }

    const sheetName = workbook.SheetNames?.[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : null;
    if (!sheet || !sheet['!ref']) {
        throw new ImportFileError('FILE_EMPTY', 'The first sheet of this file is empty.', 'Put the data on the first sheet, with the column headings in the first row.');
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true, raw: true });
    const headerIndex = matrix.findIndex((cells) => (cells || []).some((cell) => !isBlank(cell)));
    if (headerIndex === -1) {
        throw new ImportFileError('FILE_EMPTY', 'The first sheet of this file is empty.', 'Put the data on the first sheet, with the column headings in the first row.');
    }

    const width = range.e.c - range.s.c + 1;
    const headerCells = matrix[headerIndex] || [];
    const headers = [];
    for (let c = 0; c < width; c++) {
        const key = XLSX.utils.encode_col(range.s.c + c);
        const label = cleanLabel(headerCells[c]);
        headers.push({ key, label: label || `Column ${key}`, blank: !label });
    }

    // Completely empty lines are only counted. Formatting often stretches the sheet range far
    // below the data, so empty lines after the last record are not counted either.
    const firstDataRowNumber = range.s.r + headerIndex + 2;
    const rows = [];
    let emptyRowCount = 0;
    let pendingEmpty = 0;
    matrix.slice(headerIndex + 1).forEach((cells, index) => {
        const values = {};
        (cells || []).forEach((cell, c) => {
            if (c < width && !isBlank(cell)) values[headers[c].key] = cell;
        });
        if (!Object.keys(values).length) {
            pendingEmpty++;
            return;
        }
        emptyRowCount += pendingEmpty;
        pendingEmpty = 0;
        rows.push({ rowNumber: firstDataRowNumber + index, values });
    });

    const dataRowCount = rows.length;
    if (!dataRowCount) {
        throw new ImportFileError('NO_ROWS', 'The file has column headings but no data rows.', 'Add the records below the heading row and upload the file again.');
    }
    if (dataRowCount > maxRows) {
        throw new ImportFileError(
            'TOO_MANY_ROWS',
            `This file has ${dataRowCount.toLocaleString('en-IN')} rows. One import can take up to ${maxRows.toLocaleString('en-IN')} rows.`,
            'Split the file into smaller files and import them one at a time.'
        );
    }

    return {
        sheetName,
        sheetCount: workbook.SheetNames.length,
        headerRow: range.s.r + headerIndex + 1,
        headers,
        rows,
        emptyRowCount
    };
};

module.exports = { parseWorkbook, ImportFileError, isBlank };
