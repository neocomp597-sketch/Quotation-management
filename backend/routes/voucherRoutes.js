const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', voucherController.getVouchers);
router.post('/', voucherController.createVoucher);
router.get('/:id', voucherController.getVoucherById);
router.put('/:id', voucherController.updateVoucher);
router.delete('/:id', voucherController.deleteVoucher);

module.exports = router;
