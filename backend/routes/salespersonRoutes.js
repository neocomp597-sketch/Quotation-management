const express = require('express');
const router = express.Router();
const { getAllSalespersons, createSalesperson } = require('../controllers/salespersonController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', getAllSalespersons);
router.post('/', createSalesperson);

module.exports = router;
