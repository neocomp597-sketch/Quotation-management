/**
 * Standardized Response Formatter for Public API V1
 */

const sendSuccess = (res, data, statusCode = 200, message = 'Success') => {
    return res.status(statusCode).json({
        succeeded: true,
        message,
        data
    });
};

const sendPaginated = (res, data, page = 1, limit = 25, total = 0, statusCode = 200, message = 'Success') => {
    return res.status(statusCode).json({
        succeeded: true,
        message,
        data,
        pagination: {
            pageIndex: Number(page),
            pageSize: Number(limit),
            totalCount: Number(total),
            totalPages: Math.ceil(total / limit) || 1
        }
    });
};

const sendError = (res, code, message, statusCode = 400, details = null) => {
    const response = {
        succeeded: false,
        error: {
            code,
            message,
            requestId: res.getHeader('X-Request-ID') || null
        },
        errors: details ? (Array.isArray(details) ? details : [details]) : [{ code, message }]
    };

    return res.status(statusCode).json(response);
};

module.exports = {
    sendSuccess,
    sendPaginated,
    sendError
};
