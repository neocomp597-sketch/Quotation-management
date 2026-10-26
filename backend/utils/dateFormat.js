/**
 * ARCRM shows every date as DD.MMM.YY, e.g. 13.OCT.26. Server-side text (notifications, emails,
 * messages, contract templates, Excel exports) is formatted in India time, so the day does not
 * depend on where the server runs.
 */

const IST_OFFSET_MS = 330 * 60000;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const pad2 = (value) => String(value).padStart(2, '0');

// The date/time as its India-time wall clock, read through the UTC getters.
const istParts = (value) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return null;
    return new Date(time + IST_OFFSET_MS);
};

/** DD.MMM.YY (13.OCT.26), or `fallback` for an empty or invalid value. */
const formatDate = (value, fallback = '-') => {
    const d = istParts(value);
    if (!d) return fallback;
    return `${pad2(d.getUTCDate())}.${MONTHS[d.getUTCMonth()]}.${pad2(d.getUTCFullYear() % 100)}`;
};

/** DD.MMM.YY, hh:mm AM/PM */
const formatDateTime = (value, fallback = '-') => {
    const d = istParts(value);
    if (!d) return fallback;
    const hours = d.getUTCHours();
    return `${formatDate(value)}, ${pad2(hours % 12 || 12)}:${pad2(d.getUTCMinutes())} ${hours < 12 ? 'AM' : 'PM'}`;
};

// Two-digit years: up to 20 years ahead are this century (26 -> 2026), older ones the last
// (90 -> 1990), so a date of birth exported as 20.MAY.90 reads back as 1990, not 2090.
const fullYear = (text) => {
    if (text.length !== 2) return Number(text);
    const year = 2000 + Number(text);
    return year > new Date().getFullYear() + 20 ? year - 100 : year;
};

// UTC midnight of the day, or null when the day does not exist (31.02).
const utcDay = (year, monthIndex, day) => {
    const date = new Date(Date.UTC(year, monthIndex, day));
    return date.getUTCDate() === day && date.getUTCMonth() === monthIndex ? date : null;
};

/**
 * Reads a date typed as text in an import file. Day first: DD.MMM.YY / DD-Oct-2026 (as ARCRM
 * shows and exports dates) and DD.MM.YYYY (also with / or -, 2-digit years), because
 * `new Date('05.10.2026')` would read it as 10 May. ISO (YYYY-MM-DD...) and other text Date
 * understands still work. Returns UTC midnight of the day for day-only text, like Excel serial
 * dates, or null.
 */
const parseDateText = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const named = /^(\d{1,2})[./ -]([A-Za-z]{3,9})[./ -](\d{2}|\d{4})$/.exec(text);
    if (named) {
        const monthIndex = MONTHS.indexOf(named[2].slice(0, 3).toUpperCase());
        return monthIndex < 0 ? null : utcDay(fullYear(named[3]), monthIndex, Number(named[1]));
    }
    const numeric = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(text);
    if (numeric) return utcDay(fullYear(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]));
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
};

module.exports = { formatDate, formatDateTime, parseDateText };
