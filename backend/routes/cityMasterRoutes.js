const express = require('express');
const router = express.Router();
const cityMasterController = require('../controllers/cityMasterController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/', cityMasterController.getAllCities);
router.get('/:id', cityMasterController.getCityById);
router.post('/', protect, cityMasterController.createCity);
router.put('/:id', protect, cityMasterController.updateCity);
router.delete('/:id', protect, cityMasterController.deleteCity);

module.exports = router;
