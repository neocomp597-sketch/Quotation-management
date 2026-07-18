const express = require('express');
const router = express.Router();
const systemUpdateController = require('../controllers/systemUpdateController');
const { protect } = require('../middlewares/authMiddleware');

// Middleware to allow authentication via System API Key OR JWT Bearer Token
const optionalProtect = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    const systemApiKey = process.env.SYSTEM_UPDATE_API_KEY;
    
    if (systemApiKey && apiKey === systemApiKey) {
        return next();
    }
    
    // Fall back to standard session JWT protection
    return protect(req, res, next);
};

router.post('/', optionalProtect, systemUpdateController.createUpdate);
router.get('/', systemUpdateController.getAllUpdates);
router.get('/latest', systemUpdateController.getLatestUpdate);

module.exports = router;
