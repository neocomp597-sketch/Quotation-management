const express = require('express');
const router = express.Router();

const {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    bulkDeleteCustomers,
    bulkUpdateCustomers,
    checkDuplicateCustomer
} = require('../controllers/customerController');

const {
    getCustomerAnalyticsDashboard,
    getCustomerAnalyticsSegmentation,
    getCustomerAnalyticsTopCustomers,
    getCustomerAnalyticsChurn,
    getCustomerAnalyticsCLV,
    getCustomerAnalyticsRepeatBusiness,
    getCustomerAnalyticsOutstanding,
    getCustomerAnalyticsHealth,
    getCustomerAnalyticsExport,
    getCustomerAnalyticsTable,
    getCustomer360Data
} = require('../controllers/customerAnalyticsController');

const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, createCustomer);
router.get('/', protect, getAllCustomers);

// Bulk operations (must come BEFORE /:id routes)
router.post('/bulk-delete', protect, bulkDeleteCustomers);
router.patch('/bulk-update', protect, bulkUpdateCustomers);

// Analytics endpoints
router.get('/analytics/dashboard', protect, getCustomerAnalyticsDashboard);
router.get('/analytics/segmentation', protect, getCustomerAnalyticsSegmentation);
router.get('/analytics/top-customers', protect, getCustomerAnalyticsTopCustomers);
router.get('/analytics/churn', protect, getCustomerAnalyticsChurn);
router.get('/analytics/clv', protect, getCustomerAnalyticsCLV);
router.get('/analytics/repeat-business', protect, getCustomerAnalyticsRepeatBusiness);
router.get('/analytics/outstanding', protect, getCustomerAnalyticsOutstanding);
router.get('/analytics/health', protect, getCustomerAnalyticsHealth);
router.get('/analytics/export', protect, getCustomerAnalyticsExport);
router.get('/analytics/table', protect, getCustomerAnalyticsTable);

// Single item operations
router.get('/check-duplicate', protect, checkDuplicateCustomer);
router.get('/:id/360', protect, getCustomer360Data);
router.get('/:id', protect, getCustomerById);
router.put('/:id', protect, updateCustomer);
router.delete('/:id', protect, deleteCustomer);

module.exports = router;
