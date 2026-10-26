const { parseOffThread } = require('../utils/offThreadParse');

// Rows per uploaded file. IMPORT_MAX_ROWS raises or lowers it per deployment (load tests used 10,000).
const MAX_IMPORT_ROWS = (() => {
    const value = Number(process.env.IMPORT_MAX_ROWS || 5000);
    return Number.isInteger(value) && value > 0 ? value : 5000;
})();

// Read in a worker thread, so a large file does not pause other requests while it is parsed.
const SHEET_PARSER = require.resolve('../utils/importBatch');

const enforceImportRowLimit = async (req, res, next) => {
    if (!req.file?.buffer?.length) {
        return next();
    }

    let sheet;
    try {
        sheet = await parseOffThread(SHEET_PARSER, 'readUploadSheet', req.file.buffer);
    } catch (error) {
        // An unreadable file is reported by the importer itself, as before.
        return next();
    }

    const rowCount = sheet.rowCount;
    if (rowCount > MAX_IMPORT_ROWS) {
        return res.status(400).json({
            message: `Imports support a maximum of ${MAX_IMPORT_ROWS.toLocaleString()} rows per file. This file contains ${rowCount.toLocaleString()} rows. Split it into smaller files and import them one at a time.`,
            errors: [`Maximum ${MAX_IMPORT_ROWS.toLocaleString()} rows per file.`]
        });
    }

    req.importRowCount = rowCount;
    // The importers read this instead of parsing the file again (utils/importBatch.readUploadedSheet).
    req.importSheet = sheet;
    return next();
};

module.exports = { MAX_IMPORT_ROWS, enforceImportRowLimit };
