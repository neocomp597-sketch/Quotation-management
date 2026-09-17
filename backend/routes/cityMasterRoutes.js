const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const cityMasterController = require('../controllers/cityMasterController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', cityMasterController.getAllCities);
router.post('/upload', protect, upload.single('file'), cityMasterController.uploadCityMaster);
router.get('/:id', cityMasterController.getCityById);
router.post('/', protect, cityMasterController.createCity);
router.put('/:id', protect, cityMasterController.updateCity);
router.delete('/:id', protect, cityMasterController.deleteCity);

module.exports = router;
