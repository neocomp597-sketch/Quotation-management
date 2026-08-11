const express = require('express');
const router = express.Router();
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated } = require('../../../utils/apiResponse');

// GET /api/v1/cpq/price-books
router.get('/price-books', requireApiScope('cpq.read'), async (req, res) => {
    const priceBooks = [
        { id: 'PB_STD', name: 'Standard List Price 2026', currency: 'INR', activeItems: 450, status: 'Active' },
        { id: 'PB_DLR', name: 'Authorized Dealer Price Book', currency: 'INR', activeItems: 420, status: 'Active' },
        { id: 'PB_GOV', name: 'Government DGS&D Rate Contract', currency: 'INR', activeItems: 180, status: 'Active' }
    ];
    return sendPaginated(res, priceBooks, 1, 25, priceBooks.length);
});

// GET /api/v1/cpq/pricing-rules
router.get('/pricing-rules', requireApiScope('cpq.read'), async (req, res) => {
    const rules = [
        { id: 'RULE_VOL_10', title: 'Tier 1 Volume Discount (10+ units)', discountPct: 5.0 },
        { id: 'RULE_VOL_50', title: 'Tier 2 Volume Discount (50+ units)', discountPct: 12.5 },
        { id: 'RULE_BUNDLE_CRCRM', title: 'Hardware + Annual Maintenance Bundle', discountPct: 15.0 }
    ];
    return sendPaginated(res, rules, 1, 25, rules.length);
});

// GET /api/v1/cpq/discounts
router.get('/discounts', requireApiScope('cpq.read'), async (req, res) => {
    return sendSuccess(res, {
        maxRepDiscountPct: 10.0,
        maxManagerDiscountPct: 20.0,
        vpApprovalThresholdAmount: 5000000,
        marginProtectionFloorPct: 15.0
    }, 200, 'Discount policies fetched');
});

// GET /api/v1/cpq/promotions
router.get('/promotions', requireApiScope('cpq.read'), async (req, res) => {
    const promos = [
        { promoCode: 'FESTIVE2026', title: 'Q3 Enterprise Festive Offer', discountValue: '8%', validUntil: '2026-10-31' }
    ];
    return sendPaginated(res, promos, 1, 25, promos.length);
});

// GET /api/v1/cpq/currencies
router.get('/currencies', requireApiScope('cpq.read'), async (req, res) => {
    const rates = [
        { code: 'INR', name: 'Indian Rupee', rate: 1.0, isBase: true },
        { code: 'USD', name: 'US Dollar', rate: 83.5, isBase: false },
        { code: 'EUR', name: 'Euro', rate: 91.2, isBase: false }
    ];
    return sendSuccess(res, rates, 200, 'Currency exchange rates fetched');
});

// GET /api/v1/cpq/guided-selling
router.get('/guided-selling', requireApiScope('cpq.read'), async (req, res) => {
    return sendSuccess(res, {
        wizardSteps: [
            { step: 1, question: 'What is your operational site capacity requirement?' },
            { step: 2, question: 'Do you require 24x7 SLA support coverage?' }
        ],
        recommendedBundle: 'Enterprise Premium CRM + On-site AMC 3-Year Package'
    }, 200, 'Guided selling recommendation engine');
});

// POST /api/v1/cpq/configurator
router.post('/configurator', requireApiScope('cpq.write'), async (req, res) => {
    return sendSuccess(res, {
        configId: `CFG_${Date.now()}`,
        totalBasePrice: 450000,
        appliedDiscounts: 45000,
        finalPrice: 405000,
        valid: true
    }, 200, 'CPQ product configuration calculated');
});

// POST /api/v1/cpq/simulator
router.post('/simulator', requireApiScope('cpq.read'), async (req, res) => {
    return sendSuccess(res, {
        simulationId: `SIM_${Date.now()}`,
        grossMarginPct: 34.8,
        netRevenue: 1250000,
        recommendedDiscountPct: 7.5
    }, 200, 'Quote price simulation completed');
});

module.exports = router;
