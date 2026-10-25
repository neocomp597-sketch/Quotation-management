const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const cityMasterController = require('../controllers/cityMasterController');
const { protect } = require('../middlewares/authMiddleware');
const { enforceImportRowLimit } = require('../middlewares/importRowLimit');
// The upload keeps the request's tenant context (multer finishes outside it).
const { keepTenantContext } = require('../middlewares/tenantContext');

router.get('/', cityMasterController.getAllCities);
router.post('/upload', protect, keepTenantContext(upload.single('file')), enforceImportRowLimit, cityMasterController.uploadCityMaster);
router.get('/:id', cityMasterController.getCityById);
router.post('/', protect, cityMasterController.createCity);
router.put('/:id', protect, cityMasterController.updateCity);
router.delete('/:id', protect, cityMasterController.deleteCity);

module.exports = router;
