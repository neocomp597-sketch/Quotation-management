const { parseDateText, formatDate } = require('../../utils/dateFormat');

// How each kind of field turns a non-blank cell into the value that is saved. A parser
// returns { value } or { issue: { code, message, hint } }; blank cells never reach it
// (the engine decides what a blank means: required, default, or "leave unchanged").

// SheetJS date cells can arrive a fraction before local midnight (1 Apr shown as 31 Mar).
const roundToMinute = (date) => new Date(Math.round(date.getTime() / 60000) * 60000);

const toText = (raw) => {
    if (raw instanceof Date) return formatDate(roundToMinute(raw), '');
    // 9876543210.0 typed into a text column comes back as a float string.
    const text = String(raw).replace(/\s+/g, ' ').trim();
    return /^\d+\.0+$/.test(text) ? text.replace(/\.0+$/, '') : text;
};

const shown = (raw) => (raw instanceof Date ? formatDate(roundToMinute(raw), '') : String(raw).trim());

const issue = (code, message, hint = '') => ({ issue: { code, message, hint } });

const text = (raw, field) => {
    const value = toText(raw);
    if (field.maxLength && value.length > field.maxLength) {
        return issue('TOO_LONG', `${field.label} is too long.`, `Keep it to ${field.maxLength} characters (this one has ${value.length}).`);
    }
    return { value };
};

const upperText = (raw, field) => {
    const result = text(raw, field);
    return result.issue ? result : { value: result.value.toUpperCase() };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const email = (raw, field) => {
    const value = toText(raw).toLowerCase();
    // Strict fields check every address of a "a@x.com; b@y.com" list.
    if (field.strict) {
        const invalid = value.split(/[,;]\s*/).filter(Boolean).find((address) => !EMAIL_PATTERN.test(address));
        if (invalid) {
            return issue('INVALID_EMAIL', `${field.label} is not a valid email address.`, `Check "${invalid}" - it should look like name@company.com.`);
        }
    }
    return { value };
};

const pincode = (raw, field) => {
    const digits = toText(raw).replace(/\D/g, '');
    if (digits.length !== 6) {
        return issue('INVALID_PINCODE', `${field.label} must be 6 digits.`, `The file has "${shown(raw)}".`);
    }
    return { value: digits };
};

const parseNumber = (raw) => {
    if (typeof raw === 'number') return raw;
    const cleaned = toText(raw).replace(/^(rs\.?|inr|₹)\s*/i, '').replace(/[,\s]/g, '').replace(/%$/, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;
    return Number(cleaned);
};

const number = (raw, field) => {
    const value = parseNumber(raw);
    if (!Number.isFinite(value)) {
        return issue('INVALID_NUMBER', `${field.label} must be a number.`, `"${shown(raw)}" is not a number. Use digits only, for example 5 or 12.5.`);
    }
    if (field.integer && !Number.isInteger(value)) {
        return issue('INVALID_NUMBER', `${field.label} must be a whole number.`, `"${shown(raw)}" has decimals.`);
    }
    if ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) {
        const range = field.max !== undefined ? `between ${field.min ?? 0} and ${field.max}` : `${field.min} or more`;
        return issue('OUT_OF_RANGE', `${field.label} must be ${range}.`, `The file has ${shown(raw)}.`);
    }
    return { value };
};

// Excel stores dates as days since 30 Dec 1899.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

const date = (raw, field) => {
    let value = null;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        // Date cells arrive as local midnight; keep the calendar day as UTC midnight like
        // parseDateText does, rounding away SheetJS's sub-minute drift.
        const local = new Date(Math.round(raw.getTime() / 60000) * 60000);
        value = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
    } else if (typeof raw === 'number' && raw > 0 && raw < 2958466) {
        value = new Date(EXCEL_EPOCH_MS + Math.round(raw) * 86400000);
    } else {
        value = parseDateText(toText(raw));
    }
    if (!value || Number.isNaN(value.getTime())) {
        return issue('INVALID_DATE', `${field.label} is not a valid date.`, `"${shown(raw)}" could not be read. Use DD/MM/YYYY, for example 05/10/2026.`);
    }
    return { value };
};

const YES = ['yes', 'y', 'true', '1'];
const NO = ['no', 'n', 'false', '0'];

const boolean = (raw, field) => {
    const key = toText(raw).toLowerCase();
    if (YES.includes(key)) return { value: true };
    if (NO.includes(key)) return { value: false };
    return issue('INVALID_OPTION', `${field.label} must be Yes or No.`, `The file has "${shown(raw)}".`);
};

const option = (raw, field) => {
    const key = toText(raw).toLowerCase();
    const match = (field.options || []).find((candidate) => String(candidate).toLowerCase() === key);
    if (match === undefined) {
        return issue('INVALID_OPTION', `${field.label} "${shown(raw)}" is not one of the allowed values.`, `Use one of: ${(field.options || []).join(', ')}.`);
    }
    return { value: match };
};

const FIELD_TYPES = { text, upperText, email, phone: text, pincode, number, date, boolean, option };

const parseField = (raw, field) => {
    // A module can read a field its own way (planning months: text, Excel dates and serials).
    if (field.parse) return field.parse(raw, field);
    const parser = FIELD_TYPES[field.type || 'text'];
    if (!parser) throw new Error(`Unknown import field type "${field.type}" for ${field.key}`);
    return parser(raw, field);
};

module.exports = { parseField, toText, FIELD_TYPES };
