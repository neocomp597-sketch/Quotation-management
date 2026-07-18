const express = require('express');
const router = express.Router();
const { getAllSalespersons, createSalesperson, updateSalesperson } = require('../controllers/salespersonController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', getAllSalespersons);
router.post('/', createSalesperson);
router.put('/:id', updateSalesperson);

module.exports = router;
