const { sendError } = require('../utils/apiResponse');

const requireApiScope = (requiredScope) => {
    return (req, res, next) => {
        if (!req.apiClient) {
            return sendError(res, 'missing_api_key', 'API authentication required', 401);
        }

        const permissions = req.apiClient.permissions || [];
        
        if (!permissions.includes(requiredScope)) {
            return sendError(
                res, 
                'insufficient_permissions', 
                `This API key does not have the required permission: '${requiredScope}'`, 
                403
            );
        }

        next();
    };
};

module.exports = {
    requireApiScope
};
