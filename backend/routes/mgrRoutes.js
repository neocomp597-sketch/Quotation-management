const express = require('express');
const router = express.Router();
const mgrController = require('../controllers/mgrController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', mgrController.getAllMGRs);
router.get('/:id', mgrController.getMGRById);
router.post('/', mgrController.createMGR);
router.put('/:id', mgrController.updateMGR);
router.delete('/:id', mgrController.deleteMGR);

module.exports = router;
