/**
 * Calculate tax and total for a line item
 */
export const calculateLineItem = (quantity, rate, discountPercent, gstPercentage) => {
    const amount = quantity * rate;
    const discountAmount = (amount * discountPercent) / 100;
    const taxableAmount = amount - discountAmount;
    const gstAmount = (taxableAmount * gstPercentage) / 100;
    const lineTotal = taxableAmount + gstAmount;

    return {
        discountAmount,
        taxableAmount,
        gstAmount,
        lineTotal
    };
};

/**
 * Format currency to INR
 */
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

/**
 * Generate Quotation Number
 */
export const generateQuotationNo = (sequence) => {
    const year = new Date().getFullYear();
    const seqStr = sequence.toString().padStart(4, '0');
    return `JAG/QTN/${year}/${seqStr}`;
};

/**
 * Format Date
 */
export const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

/**
 * Resolve Backend Image URLs
 */
export const resolveImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    // For local development, assuming backend on 5000
    const base = 'http://localhost:5000';
    let cleanUrl = url.replace(/\\/g, '/'); // Fix windows backslashes

    // If it's just a filename (no slashes), prepend /uploads/
    if (!cleanUrl.includes('/')) {
        cleanUrl = `/uploads/${cleanUrl}`;
    }

    // Ensure it starts with / if not present
    if (!cleanUrl.startsWith('/')) {
        cleanUrl = `/${cleanUrl}`;
    }

    return `${base}${cleanUrl}`;
};
