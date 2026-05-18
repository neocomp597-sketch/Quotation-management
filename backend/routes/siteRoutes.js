const express = require('express');
const router = express.Router();
const { getAllSites, createSite } = require('../controllers/siteController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', getAllSites);
router.post('/', createSite);

module.exports = router;
