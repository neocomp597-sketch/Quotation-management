const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', statusController.getStatuses);
router.post('/', admin, statusController.createStatus);
router.put('/:id', admin, statusController.updateStatus);
router.delete('/:id', admin, statusController.deleteStatus);

module.exports = router;
