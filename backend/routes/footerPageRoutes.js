const express = require('express');
const router = express.Router();
const footerPageController = require('../controllers/footerPageController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.get('/', protect, footerPageController.getAllPages);
router.get('/:slug', protect, footerPageController.getPageBySlug);
router.put('/:slug', protect, admin, footerPageController.updatePage);

module.exports = router;
