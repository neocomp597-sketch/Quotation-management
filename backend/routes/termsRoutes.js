const express = require('express');
const router = express.Router();
const { getAllTemplates, createTemplate } = require('../controllers/termsController');

router.get('/', getAllTemplates);
router.post('/', createTemplate);
router.put('/:id', require('../controllers/termsController').updateTemplate);
router.delete('/:id', require('../controllers/termsController').deleteTemplate);

module.exports = router;
