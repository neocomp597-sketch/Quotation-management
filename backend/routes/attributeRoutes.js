const express = require('express');
const router = express.Router();
const attributeController = require('../controllers/attributeController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/mgr3/:mgr3Id', attributeController.getAttributesByMGR3);
router.post('/', attributeController.createAttribute);
router.put('/:id', attributeController.updateAttribute);
router.delete('/:id', attributeController.deleteAttribute);

module.exports = router;
