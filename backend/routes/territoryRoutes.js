const express = require('express');
const router = express.Router();
const {
    getTerritories,
    createTerritory,
    updateTerritory,
    deleteTerritory
} = require('../controllers/territoryController');

const { protect } = require('../middlewares/authMiddleware');

router.get('/', protect, getTerritories);
router.post('/', protect, createTerritory);
router.put('/:id', protect, updateTerritory);
router.delete('/:id', protect, deleteTerritory);

module.exports = router;
