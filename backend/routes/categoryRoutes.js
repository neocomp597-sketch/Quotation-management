const express = require('express');
const router = express.Router();
const { getAll, create } = require('../controllers/categoryController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);
router.get('/', getAll);
router.post('/', create);

module.exports = router;
