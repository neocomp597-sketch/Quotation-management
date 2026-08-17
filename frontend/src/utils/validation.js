// Shared validation functions for Master Data

export const BLOOD_GROUP_OPTIONS = [
    'A+',
    'A-',
    'B+',
    'B-',
    'AB+',
    'AB-',
    'O+',
    'O-'
];

// Clean input phone/mobile numbers (strip spaces, hyphens, and leading +91)
export const sanitizePhoneNumber = (val) => {
    if (!val) return '';
    let cleaned = String(val).trim().replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+91')) {
        cleaned = cleaned.slice(3);
    } else if (cleaned.startsWith('91') && cleaned.length > 10) {
        cleaned = cleaned.slice(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
        cleaned = cleaned.slice(1);
    }
    return cleaned;
};

/**
 * Validates Indian GSTIN (15 characters)
 * Standard pattern: 2 digits state code + 5 chars PAN + 4 digits + 1 char + 1 entity code + Z + 1 check digit
 */
export const isValidGSTIN = (gstin) => {
    if (!gstin) return true; // Optional if empty
    const cleanGST = String(gstin).trim().toUpperCase();
    if (cleanGST.length !== 15) return false;
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(cleanGST);
};

/**
 * Validates Indian PAN (10 characters)
 * Standard pattern: 5 letters + 4 digits + 1 letter
 */
export const isValidPAN = (pan) => {
    if (!pan) return true; // Optional if empty
    const cleanPAN = String(pan).trim().toUpperCase();
    if (cleanPAN.length !== 10) return false;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(cleanPAN);
};

/**
 * Validates 10-digit Mobile / Phone Number
 */
export const isValidMobile = (phone) => {
    if (!phone) return true; // Optional if empty
    const cleaned = sanitizePhoneNumber(phone);
    if (!cleaned) return true;
    return /^\d{10}$/.test(cleaned);
};

/**
 * Validates 6-digit Indian Pincode
 */
export const isValidPincode = (pincode) => {
    if (!pincode) return true; // Optional if empty
    const cleanPin = String(pincode).trim();
    if (!cleanPin) return true;
    const pinRegex = /^[1-9][0-9]{5}$/;
    return pinRegex.test(cleanPin);
};
