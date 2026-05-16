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

const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, createCustomer);
router.get('/', protect, getAllCustomers);

// Bulk operations (must come BEFORE /:id routes)
router.post('/bulk-delete', protect, bulkDeleteCustomers);
router.patch('/bulk-update', protect, bulkUpdateCustomers);

// Single item operations
router.get('/check-duplicate', protect, checkDuplicateCustomer);
router.get('/:id', protect, getCustomerById);
router.put('/:id', protect, updateCustomer);
router.delete('/:id', protect, deleteCustomer);

module.exports = router;
