const express = require('express');
const router = express.Router();
const { getAllSites, createSite } = require('../controllers/siteController');

router.get('/', getAllSites);
router.post('/', createSite);

module.exports = router;
