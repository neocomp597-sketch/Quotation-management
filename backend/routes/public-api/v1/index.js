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

// New Public API Module Routes
const dashboardRoutes = require('./dashboardRoutes');
const payrollPublicRoutes = require('./payrollPublicRoutes');
const cpqPublicRoutes = require('./cpqPublicRoutes');
const clmPublicRoutes = require('./clmPublicRoutes');
const csmPublicRoutes = require('./csmPublicRoutes');
const tenderPublicRoutes = require('./tenderPublicRoutes');
const grnPublicRoutes = require('./grnPublicRoutes');
const planningPublicRoutes = require('./planningPublicRoutes');
const analyticsPublicRoutes = require('./analyticsPublicRoutes');
const masterPublicRoutes = require('./masterPublicRoutes');

// Apply API Key Authentication and Rate Limiting to all /api/v1/* endpoints
router.use(apiKeyAuth);
router.use(apiRateLimiter(60000, 100)); // 100 requests per minute per key

// Mount Core Resource Routes
router.use('/customers', customerRoutes);
router.use('/contacts', contactRoutes);
router.use('/leads', leadRoutes);
router.use('/enquiries', leadRoutes);
router.use('/deals', dealRoutes);
router.use('/products', productRoutes);
router.use('/quotations', quotationRoutes);
router.use('/vendors', vendorRoutes);
router.use('/orders', orderRoutes);
router.use('/meetings', meetingRoutes);
router.use('/branches', branchRoutes);

// Mount Expanded Module Routes
router.use('/dashboard', dashboardRoutes);
router.use('/payroll', payrollPublicRoutes);
router.use('/cpq', cpqPublicRoutes);
router.use('/clm', clmPublicRoutes);
router.use('/csm', csmPublicRoutes);
router.use('/tender', tenderPublicRoutes);
router.use('/tenders', tenderPublicRoutes);
router.use('/grn', grnPublicRoutes);
router.use('/planning', planningPublicRoutes);
router.use('/simulations', planningPublicRoutes);
router.use('/', analyticsPublicRoutes);
router.use('/', masterPublicRoutes);

module.exports = router;
