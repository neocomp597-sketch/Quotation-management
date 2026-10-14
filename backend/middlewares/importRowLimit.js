const XLSX = require('xlsx');

const MAX_IMPORT_ROWS = 5000;

const enforceImportRowLimit = (req, res, next) => {
    if (!req.file?.buffer?.length) {
        return next();
    }

    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const rowCount = workbook.SheetNames.reduce((total, sheetName) => (
            total + XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }).length
        ), 0);

        if (rowCount > MAX_IMPORT_ROWS) {
            return res.status(400).json({
                message: `Imports support a maximum of ${MAX_IMPORT_ROWS.toLocaleString()} rows per file. This file contains ${rowCount.toLocaleString()} rows. Split it into smaller files and import them one at a time.`,
                errors: [`Maximum ${MAX_IMPORT_ROWS.toLocaleString()} rows per file.`]
            });
        }

        req.importRowCount = rowCount;
        return next();
    } catch (error) {
        return next();
    }
};

module.exports = { MAX_IMPORT_ROWS, enforceImportRowLimit };