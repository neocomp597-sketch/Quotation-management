// Errors the import screens show as they are: a code for the screen, a message and a hint.

/** A problem with the file itself: nothing is imported and the user gets the reason. */
class ImportFileError extends Error {
    constructor(code, message, hint = '') {
        super(message);
        // The name survives the trip back from the file-reading worker (utils/offThreadParse.js).
        this.name = 'ImportFileError';
        this.code = code;
        this.hint = hint;
        this.status = 400;
    }
}

/** A request that does not fit the job's state or settings (already running, columns locked...). */
class ImportJobError extends Error {
    constructor(code, message, hint = '', status = 409) {
        super(message);
        this.name = 'ImportJobError';
        this.code = code;
        this.hint = hint;
        this.status = status;
    }
}

module.exports = { ImportFileError, ImportJobError };
