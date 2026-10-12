/**
 * ARCRM shows every date as DD.MM.YYYY. Server-side text (notifications, emails, messages,
 * contract templates) is formatted in India time, so the day does not depend on where the
 * server runs.
 */

const IST_OFFSET_MS = 330 * 60000;
const pad2 = (value) => String(value).padStart(2, '0');

// The date/time as its India-time wall clock, read through the UTC getters.
const istParts = (value) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return null;
    return new Date(time + IST_OFFSET_MS);
};

/** DD.MM.YYYY, or `fallback` for an empty or invalid value. */
const formatDate = (value, fallback = '-') => {
    const d = istParts(value);
    if (!d) return fallback;
    return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
};

/** DD.MM.YYYY, hh:mm AM/PM */
const formatDateTime = (value, fallback = '-') => {
    const d = istParts(value);
    if (!d) return fallback;
    const hours = d.getUTCHours();
    return `${formatDate(value)}, ${pad2(hours % 12 || 12)}:${pad2(d.getUTCMinutes())} ${hours < 12 ? 'AM' : 'PM'}`;
};

// Excel number format for date cells.
const EXCEL_DATE_FORMAT = 'dd.mm.yyyy';

/**
 * Reads a date typed as text in an import file. DD.MM.YYYY (also with / or -, and 2-digit years)
 * is read day first, because `new Date('05.10.2026')` would read it as 10 May. ISO
 * (YYYY-MM-DD...) and other text Date understands still work. Returns UTC midnight of the day
 * for day-only text, like Excel serial dates, or null.
 */
const parseDateText = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const dayFirst = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(text);
    if (dayFirst) {
        const day = Number(dayFirst[1]);
        const month = Number(dayFirst[2]);
        const year = dayFirst[3].length === 2 ? 2000 + Number(dayFirst[3]) : Number(dayFirst[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCDate() === day && date.getUTCMonth() === month - 1 ? date : null;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
};

module.exports = { formatDate, formatDateTime, parseDateText, EXCEL_DATE_FORMAT };
