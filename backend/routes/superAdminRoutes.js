const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { protect, superAdmin } = require('../middlewares/authMiddleware');

router.use(protect, superAdmin);

const mutationHits = new Map();
const mutationLimiter = (req, res, next) => {
    const key = `${req.user.id}:${req.ip}`;
    const now = Date.now();
    const windowMs = 60 * 1000;
    const max = 30;
    const recent = (mutationHits.get(key) || []).filter((time) => now - time < windowMs);

    if (recent.length >= max) {
        return res.status(429).json({ message: 'Too many super admin changes. Please wait and try again.' });
    }

    recent.push(now);
    mutationHits.set(key, recent);
    next();
};

router.get('/company-stats', superAdminController.getCompanyStats);
router.get('/companies', superAdminController.getCompanies);
router.get('/users', superAdminController.getUsers);
router.get('/audit-logs', superAdminController.getAuditLogs);
router.patch('/users/:id/status', mutationLimiter, superAdminController.updateUserStatus);
router.patch('/companies/:id/status', mutationLimiter, superAdminController.updateCompanyStatus);

module.exports = router;
