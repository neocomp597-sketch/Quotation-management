const express = require('express');
const router = express.Router();
const stateMasterController = require('../controllers/stateMasterController');
const auth = require('../middlewares/auth');

router.get('/', auth, stateMasterController.getAll);
router.post('/', auth, stateMasterController.create);
router.put('/:id', auth, stateMasterController.update);
router.delete('/:id', auth, stateMasterController.delete);

module.exports = router;
