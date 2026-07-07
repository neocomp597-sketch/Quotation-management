const express = require('express');
const router = express.Router();
const clmController = require('../controllers/clmController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

// Dashboard
router.get('/dashboard', clmController.getCLMDashboard);

// Contracts
router.get('/contracts', clmController.getCLMContracts);
router.post('/contracts', clmController.createCLMContract);

// Clauses
router.get('/clauses', clmController.getClauses);
router.post('/clauses', clmController.createClause);
router.put('/clauses/:id', clmController.updateClause);
router.delete('/clauses/:id', clmController.deleteClause);

// Themes
router.get('/themes', clmController.getThemes);
router.post('/themes', clmController.createTheme);
router.put('/themes/:id', clmController.updateTheme);
router.delete('/themes/:id', clmController.deleteTheme);

// Templates
router.get('/templates', clmController.getTemplates);
router.post('/templates', clmController.createTemplate);
router.put('/templates/:id', clmController.updateTemplate);
router.delete('/templates/:id', clmController.deleteTemplate);

// Document Pipeline
router.post('/generate', clmController.generateDocument);
router.get('/versions/:contractId', clmController.getDocumentVersions);
router.get('/version-html/:id', clmController.getDocumentVersionHtml);

// Categories Mini-Master
router.get('/categories', clmController.getCategories);
router.post('/categories', clmController.createCategory);
router.delete('/categories/:id', clmController.deleteCategory);

module.exports = router;
