const express = require('express');
const router = express.Router();
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated } = require('../../../utils/apiResponse');

// GET /api/v1/tender/dashboard & /api/v1/tenders/dashboard
router.get(['/dashboard', '/register/dashboard'], requireApiScope('tenders.read'), async (req, res) => {
    return sendSuccess(res, {
        activeTendersCount: 14,
        totalBidValuation: 145000000,
        totalEmdDeposited: 4500000,
        bidsSubmittedThisMonth: 6,
        winRatePct: 42.8
    }, 200, 'Tenders dashboard overview');
});

// GET /api/v1/tender/register & /api/v1/tenders
router.get(['/', '/register'], requireApiScope('tenders.read'), async (req, res) => {
    const tenders = [
        { tenderNo: 'TND-2026-NTPC-09', clientAuthority: 'NTPC Limited', title: 'Supply & Installation of Industrial Automation Panels', estimatedValue: 35000000, emdAmount: 700000, submissionDeadline: '2026-09-15', status: 'Bid Prepared' },
        { tenderNo: 'TND-2026-BHEL-02', clientAuthority: 'BHEL Haridwar', title: 'Annual Maintenance Rate Contract for SCADA Systems', estimatedValue: 18000000, emdAmount: 360000, submissionDeadline: '2026-08-30', status: 'Submitted' }
    ];
    return sendPaginated(res, tenders, 1, 25, tenders.length);
});

// POST /api/v1/tender/register & /api/v1/tenders
router.post(['/', '/register'], requireApiScope('tenders.write'), async (req, res) => {
    return sendSuccess(res, {
        tenderNo: req.body?.tenderNo || `TND-2026-${Math.floor(100 + Math.random() * 900)}`,
        status: 'Registered',
        createdAt: new Date()
    }, 201, 'Tender registered successfully');
});

// GET /api/v1/tender/reports & /api/v1/tenders/reports
router.get('/reports', requireApiScope('tenders.read'), async (req, res) => {
    return sendSuccess(res, {
        wonTendersCount: 8,
        lostTendersCount: 4,
        pendingOutcomeCount: 6,
        totalWonValuation: 98000000,
        emdRefundStatus: '100% Clear'
    }, 200, 'Tender bid performance reports');
});

module.exports = router;
