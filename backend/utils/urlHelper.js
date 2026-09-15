const path = require('path');

const trimTrailingSlash = (value = '') => String(value).replace(/\/+$/, '');

/**
 * Generates a public URL for a file given its local destination and filename.
 * @param {string} destination - Multer file.destination (can be absolute or relative)
 * @param {string} filename - The filename
 * @returns {string} The public URL starting with /uploads/
 */
const getPublicUrl = (destination, filename) => {
    if (!destination) return filename ? `/uploads/${filename}` : '';
    const normalizedDest = String(destination).replace(/\\/g, '/');
    const parts = normalizedDest.split('/uploads/');
    const subPath = parts.length > 1 ? parts[1] : '';
    return subPath ? `/uploads/${subPath}/${filename}` : `/uploads/${filename}`;
};

/**
 * Resolves the base asset domain URL from environment variables.
 */
const getPublicAssetBaseUrl = () => {
    const candidates = [
        process.env.PUBLIC_API_URL,
        process.env.VITE_API_URL,
        process.env.DOMAIN_NAME,
        process.env.BACKEND_URL
    ];

    for (const candidate of candidates) {
        const trimmed = trimTrailingSlash(candidate || '');
        if (!trimmed) continue;

        try {
            const parsed = new URL(trimmed);
            return trimTrailingSlash(parsed.toString());
        } catch {
            if (trimmed.startsWith('http')) return trimmed;
        }
    }

    return '';
};

/**
 * Converts a path or relative URL into an absolute public URL.
 */
const toAbsolutePublicUrl = (pathOrUrl = '') => {
    if (!pathOrUrl) return '';
    if (/^https?:\/\//i.test(pathOrUrl) || String(pathOrUrl).startsWith('data:')) return pathOrUrl;

    const normalizedPath = String(pathOrUrl).replace(/\\/g, '/');
    let cleanPath = normalizedPath;
    if (/\/uploads\//i.test(cleanPath)) {
        cleanPath = cleanPath.replace(/^.*\/uploads\//i, '/uploads/');
    }
    const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    const baseUrl = getPublicAssetBaseUrl();
    return baseUrl ? `${baseUrl}${finalPath}` : finalPath;
};

module.exports = {
    getPublicUrl,
    getPublicAssetBaseUrl,
    toAbsolutePublicUrl
};
