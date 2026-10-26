const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { protect } = require('../middlewares/authMiddleware');
const { enforceImportRowLimit } = require('../middlewares/importRowLimit');
// The upload keeps the request's tenant context (multer finishes outside it).
const { keepTenantContext } = require('../middlewares/tenantContext');
const vendorCatalogController = require('../controllers/vendorCatalogController');

router.use(protect);

router.get('/', vendorCatalogController.getVendorCatalog);
router.post('/', vendorCatalogController.createVendorCatalogProduct);
router.post('/import', keepTenantContext(upload.single('file')), enforceImportRowLimit, vendorCatalogController.importVendorCatalog);

router.get('/:id', vendorCatalogController.getVendorCatalogProductById);
router.patch('/:id', vendorCatalogController.updateVendorCatalogProduct);
router.delete('/:id', vendorCatalogController.deleteVendorCatalogProduct);

module.exports = router;
