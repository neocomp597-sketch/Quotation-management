const express = require('express');
const router = express.Router();
const {
    createProduct,
    getAllProducts,
    getProductById,
    getProductVendors,
    updateProduct,
    updateProductVendor,
    deleteProduct,
    bulkDeleteProducts,
    bulkUpdateProducts
} = require('../controllers/productController');

router.post('/', createProduct);
router.get('/', getAllProducts);

// Bulk operations (must come BEFORE /:id routes)
router.post('/bulk-delete', bulkDeleteProducts);
router.patch('/bulk-update', bulkUpdateProducts);

// Product vendor operations
router.get('/:id/vendors', getProductVendors);
router.patch('/:id/vendor/:vendorId', updateProductVendor);

// Single item operations
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
