const express = require('express');
const router = express.Router();
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated } = require('../../../utils/apiResponse');

// GET /api/v1/reports
router.get('/reports', requireApiScope('analytics.read'), async (req, res) => {
    const reportList = [
        { reportId: 'REP-01', title: 'Monthly Sales Revenue & Tax Ledger', format: 'XLSX', category: 'Finance' },
        { reportId: 'REP-02', title: 'Quotations Conversion Velocity Analysis', format: 'PDF', category: 'Sales' },
        { reportId: 'REP-03', title: 'Employee Payroll Salary Disbursal Audit', format: 'XLSX', category: 'HR' }
    ];
    return sendPaginated(res, reportList, 1, 25, reportList.length);
});

// GET /api/v1/analytics/sales
router.get('/analytics/sales', requireApiScope('analytics.read'), async (req, res) => {
    return sendSuccess(res, {
        monthlyRunRate: 12400000,
        avgDealSize: 850000,
        dealWinRatioPct: 62.4,
        topSellingCategory: 'Industrial CNC Controllers'
    }, 200, 'Sales analytics overview');
});

// GET /api/v1/analytics/customers
router.get('/analytics/customers', requireApiScope('analytics.read'), async (req, res) => {
    return sendSuccess(res, {
        totalCustomerLifetimeValueAvg: 4500000,
        repeatPurchaseRatioPct: 78.2,
        churnRiskAccountsCount: 3
    }, 200, 'Customer intelligence analytics');
});

// GET /api/v1/analytics/revenue
router.get('/analytics/revenue', requireApiScope('analytics.read'), async (req, res) => {
    return sendSuccess(res, {
        mrr: 4500000,
        arr: 54000000,
        yoyGrowthRatePct: 24.8,
        netRetentionRatePct: 114.5
    }, 200, 'Revenue growth analytics');
});

module.exports = router;
