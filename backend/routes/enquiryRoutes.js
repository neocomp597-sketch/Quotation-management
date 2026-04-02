const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, enquiryController.createEnquiry);
router.get('/', protect, enquiryController.getAllEnquiries);
router.get('/:id', protect, enquiryController.getEnquiryById);
router.put('/:id', protect, enquiryController.updateEnquiry);
router.delete('/:id', protect, enquiryController.deleteEnquiry);

module.exports = router;
