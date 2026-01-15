const express = require('express');
const router = express.Router();
const {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    bulkDeleteProducts,
    bulkUpdateProducts
} = require('../controllers/productController');

router.post('/', createProduct);
router.get('/', getAllProducts);

// Bulk operations (must come BEFORE /:id routes)
router.post('/bulk-delete', bulkDeleteProducts);
router.patch('/bulk-update', bulkUpdateProducts);

// Single item operations
router.get('/:id', getProductById);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
