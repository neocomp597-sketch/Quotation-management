const express = require('express');
const router = express.Router();
const {
    createVendor,
    getAllVendors,
    getVendorById,
    updateVendor,
    deleteVendor,
    getVendor360Data
} = require('../controllers/vendorController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/', createVendor);
router.get('/', getAllVendors);
router.get('/:id/360', getVendor360Data);
router.get('/:id', getVendorById);
router.patch('/:id', updateVendor);
router.delete('/:id', deleteVendor);

module.exports = router;
