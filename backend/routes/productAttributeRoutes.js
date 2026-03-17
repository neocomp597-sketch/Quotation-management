const express = require('express');
const router = express.Router();
const {
    getAllProductAttributes,
    getProductAttributes,
    saveProductAttribute,
    deleteProductAttribute
} = require('../controllers/productAttributeController');

router.get('/', getAllProductAttributes);
router.get('/:productCode', getProductAttributes);

router.post('/', saveProductAttribute);
router.delete('/:id', deleteProductAttribute);

module.exports = router;
