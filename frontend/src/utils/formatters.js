/**
 * Format a number in Indian currency format (lakhs)
 * @param {number} value - The value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted value like "12.34 L" or "1,234.56 L"
 */
export const formatToLakhs = (value, decimals = 2) => {
    if (!value || isNaN(value)) return '0.00 L';
    
    const numValue = Number(value);
    const lakhValue = numValue / 100000; // 1 Lakh = 100,000
    
    const formatted = lakhValue.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
    
    return `${formatted} L`;
};

/**
 * Format a number with Indian locale (comma separated)
 * @param {number} value - The value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted value
 */
export const formatToIndian = (value, decimals = 2) => {
    if (!value || isNaN(value)) return '0.00';
    
    return Number(value).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

/**
 * Format percentage value
 * @param {number} value - The percentage value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage like "12.34%"
 */
export const formatPercentage = (value, decimals = 1) => {
    if (!value || isNaN(value)) return '0.0%';
    
    return `${Number(value).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })}%`;
};

/**
 * Format currency value
 * @param {number} value - The currency value in rupees
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted value
 */
export const formatCurrency = (value, decimals = 2) => {
    if (!value || isNaN(value)) return '₹0.00';
    
    return `₹ ${Number(value).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })}`;
};
