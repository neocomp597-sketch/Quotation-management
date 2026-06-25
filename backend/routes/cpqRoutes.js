const express = require('express');
const router = express.Router();
const cpqController = require('../controllers/cpqController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

// Price Books CRUD
router.post('/price-books', cpqController.createPriceBook);
router.get('/price-books', cpqController.getAllPriceBooks);
router.get('/price-books/:id', cpqController.getPriceBookById);
router.put('/price-books/:id', cpqController.updatePriceBook);
router.delete('/price-books/:id', cpqController.deletePriceBook);

// Price Book Items
router.post('/price-books/items', cpqController.addItemToPriceBook);
router.get('/price-books/:priceBookId/items', cpqController.getItemsInPriceBook);
router.delete('/price-books/items/:itemId', cpqController.removeItemFromPriceBook);

// Pricing Rules
router.post('/pricing-rules', cpqController.createPricingRule);
router.get('/pricing-rules', cpqController.getAllPricingRules);
router.put('/pricing-rules/:id', cpqController.updatePricingRule);
router.delete('/pricing-rules/:id', cpqController.deletePricingRule);

// Discount Policies
router.post('/discounts', cpqController.createDiscountPolicy);
router.get('/discounts', cpqController.getAllDiscountPolicies);
router.put('/discounts/:id', cpqController.updateDiscountPolicy);
router.delete('/discounts/:id', cpqController.deleteDiscountPolicy);

// Promotions
router.post('/promotions', cpqController.createPromotion);
router.get('/promotions', cpqController.getAllPromotions);
router.put('/promotions/:id', cpqController.updatePromotion);
router.delete('/promotions/:id', cpqController.deletePromotion);

// Currency Rates
router.post('/currencies', cpqController.createCurrencyRate);
router.get('/currencies', cpqController.getAllCurrencyRates);

// Subscription Plans
router.post('/subscriptions', cpqController.createSubscriptionPlan);
router.get('/subscriptions', cpqController.getAllSubscriptionPlans);

// Product Configuration Matrices
router.post('/config-templates', cpqController.saveProductConfigTemplate);
router.get('/config-templates/:productId', cpqController.getProductConfigTemplate);

// Quote Simulator Sandbox
router.post('/simulate', cpqController.simulateQuote);

// Competitor Price Logging
router.post('/competitors', cpqController.createCompetitorPrice);
router.get('/competitors', cpqController.getAllCompetitorPrices);

// Audit Compliance logs
router.get('/audit-logs', cpqController.getAuditLogs);

// Contracts Agreements
router.post('/contracts', cpqController.createContract);
router.get('/contracts', cpqController.getAllContracts);
router.put('/contracts/:id', cpqController.updateContract);
router.delete('/contracts/:id', cpqController.deleteContract);

module.exports = router;
