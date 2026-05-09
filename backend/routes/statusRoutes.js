const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', statusController.getStatuses);
router.post('/', statusController.createStatus);
router.put('/:id', statusController.updateStatus);
router.delete('/:id', statusController.deleteStatus);

module.exports = router;
