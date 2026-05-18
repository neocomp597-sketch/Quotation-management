const express = require('express');
const router = express.Router();
const {
    getAllProductAttributes,
    getProductAttributes,
    saveProductAttribute,
    deleteProductAttribute
} = require('../controllers/productAttributeController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', getAllProductAttributes);
router.get('/:productCode', getProductAttributes);

router.post('/', saveProductAttribute);
router.delete('/:id', deleteProductAttribute);

module.exports = router;
