const express = require('express');
const router = express.Router();

const apiKeyAuth = require('../../../middleware/apiKeyAuth');
const apiRateLimiter = require('../../../middleware/apiRateLimiter');

const customerRoutes = require('./customerRoutes');
const contactRoutes = require('./contactRoutes');
const leadRoutes = require('./leadRoutes');
const dealRoutes = require('./dealRoutes');
const productRoutes = require('./productRoutes');
const quotationRoutes = require('./quotationRoutes');
const vendorRoutes = require('./vendorRoutes');
const orderRoutes = require('./orderRoutes');
const meetingRoutes = require('./meetingRoutes');
const branchRoutes = require('./branchRoutes');

// Apply API Key Authentication and Rate Limiting to all /api/v1/* endpoints
router.use(apiKeyAuth);
router.use(apiRateLimiter(60000, 100)); // 100 requests per minute per key

// Mount Resource Routes
router.use('/customers', customerRoutes);
router.use('/contacts', contactRoutes);
router.use('/leads', leadRoutes);
router.use('/deals', dealRoutes);
router.use('/products', productRoutes);
router.use('/quotations', quotationRoutes);
router.use('/vendors', vendorRoutes);
router.use('/orders', orderRoutes);
router.use('/meetings', meetingRoutes);
router.use('/branches', branchRoutes);

module.exports = router;
