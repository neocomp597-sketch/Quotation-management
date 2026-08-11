const express = require('express');
const router = express.Router();
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated } = require('../../../utils/apiResponse');

// GET /api/v1/clm/dashboard
router.get('/dashboard', requireApiScope('clm.read'), async (req, res) => {
    return sendSuccess(res, {
        activeContractsCount: 56,
        expiring30DaysCount: 4,
        totalActiveValue: 85000000,
        pendingSignaturesCount: 3
    }, 200, 'CLM Dashboard overview metrics');
});

// GET /api/v1/clm/contracts
router.get('/contracts', requireApiScope('clm.read'), async (req, res) => {
    const contracts = [
        { id: 'CNT-2026-001', customerName: 'Acme Corp', contractType: 'Master Service Agreement (MSA)', value: 12000000, startDate: '2026-01-01', endDate: '2027-12-31', status: 'Active' },
        { id: 'CNT-2026-002', customerName: 'Zenith Global', contractType: 'Annual Maintenance (AMC)', value: 3500000, startDate: '2025-09-01', endDate: '2026-08-31', status: 'Renewal Pending' }
    ];
    return sendPaginated(res, contracts, 1, 25, contracts.length);
});

// POST /api/v1/clm/contracts
router.post('/contracts', requireApiScope('clm.write'), async (req, res) => {
    return sendSuccess(res, {
        id: `CNT_${Date.now()}`,
        contractNumber: `CNT-2026-${Math.floor(100 + Math.random() * 900)}`,
        status: 'Draft',
        createdAt: new Date()
    }, 201, 'Contract agreement created successfully');
});

// GET /api/v1/clm/templates
router.get('/templates', requireApiScope('clm.read'), async (req, res) => {
    const templates = [
        { id: 'TPL_MSA', name: 'Standard Master Service Agreement (MSA v4.2)', clausesCount: 14 },
        { id: 'TPL_SLA', name: 'Enterprise Premium Service Level Agreement (SLA)', clausesCount: 8 },
        { id: 'TPL_NDA', name: 'Mutual Non-Disclosure Agreement (NDA)', clausesCount: 6 }
    ];
    return sendPaginated(res, templates, 1, 25, templates.length);
});

// GET /api/v1/clm/clauses
router.get('/clauses', requireApiScope('clm.read'), async (req, res) => {
    const clauses = [
        { id: 'CLS_LIM_LIAB', title: 'Limitation of Liability Cap', category: 'Liability', mandatory: true },
        { id: 'CLS_PAY_TERMS', title: 'Payment Net 30 Days Penalty', category: 'Commercial', mandatory: true }
    ];
    return sendPaginated(res, clauses, 1, 25, clauses.length);
});

// GET /api/v1/clm/renewals
router.get('/renewals', requireApiScope('clm.read'), async (req, res) => {
    const renewals = [
        { contractId: 'CNT-2025-089', customerName: 'Global Logistics', daysRemaining: 18, currentValuation: 4500000, expansionOpportunity: 1000000 }
    ];
    return sendPaginated(res, renewals, 1, 25, renewals.length);
});

// GET /api/v1/clm/reports
router.get('/reports', requireApiScope('clm.read'), async (req, res) => {
    return sendSuccess(res, {
        avgTurnaroundDays: 4.2,
        nonStandardClauseFreqPct: 12.5,
        totalRenewedValuation: 48000000
    }, 200, 'CLM Performance report summary');
});

// GET /api/v1/clm/settings
router.get('/settings', requireApiScope('clm.write'), async (req, res) => {
    return sendSuccess(res, {
        renewalNoticeDays: 90,
        autoRenewalDefault: true,
        digitalSignatureProvider: 'DocuSign'
    }, 200, 'CLM settings fetched');
});

module.exports = router;
