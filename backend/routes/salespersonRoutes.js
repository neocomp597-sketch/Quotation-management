const express = require('express');
const router = express.Router();
const { getAllSalespersons, createSalesperson } = require('../controllers/salespersonController');

router.get('/', getAllSalespersons);
router.post('/', createSalesperson);

module.exports = router;
