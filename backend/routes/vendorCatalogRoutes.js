const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { protect } = require('../middlewares/authMiddleware');
const vendorCatalogController = require('../controllers/vendorCatalogController');

router.use(protect);

router.get('/', vendorCatalogController.getVendorCatalog);
router.post('/', vendorCatalogController.createVendorCatalogProduct);
router.post('/import', upload.single('file'), vendorCatalogController.importVendorCatalog);

router.get('/:id', vendorCatalogController.getVendorCatalogProductById);
router.patch('/:id', vendorCatalogController.updateVendorCatalogProduct);
router.delete('/:id', vendorCatalogController.deleteVendorCatalogProduct);

module.exports = router;
