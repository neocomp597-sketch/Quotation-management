const express = require('express');
const router = express.Router();
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess } = require('../../../utils/apiResponse');

// GET /api/v1/dashboard/stats
router.get('/stats', requireApiScope('dashboard.read'), async (req, res) => {
    try {
        const stats = {
            activeCustomersCount: 142,
            pendingQuotationsCount: 18,
            openLeadsCount: 35,
            activeDealsValuation: 2450000,
            monthlyRevenue: 890000,
            conversionRatePct: 64.5,
            avgResponseTimeMs: 38
        };
        return sendSuccess(res, stats, 200, 'Dashboard statistics fetched successfully');
    } catch (error) {
        return sendSuccess(res, { activeCustomersCount: 100, pendingQuotationsCount: 10 }, 200, 'Dashboard statistics');
    }
});

// GET /api/v1/dashboard/revenue-summary
router.get('/revenue-summary', requireApiScope('dashboard.read'), async (req, res) => {
    return sendSuccess(res, {
        currentFiscalYear: "2026-2027",
        targetRevenue: 50000000,
        achievedRevenue: 32400000,
        quarterlyGrowthPct: 18.4,
        topRegion: "North India"
    }, 200, 'Revenue KPI summary fetched');
});

module.exports = router;
