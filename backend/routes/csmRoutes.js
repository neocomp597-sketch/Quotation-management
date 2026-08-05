const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');

const csmDashboardController = require('../controllers/csmDashboardController');
const ticketController = require('../controllers/ticketController');
const serviceVisitController = require('../controllers/serviceVisitController');
const warrantyAmcController = require('../controllers/warrantyAmcController');
const kbController = require('../controllers/kbController');
const csmMasterController = require('../controllers/csmMasterController');
const customerContactController = require('../controllers/customerContactController');

// ─── CSM DASHBOARD ──────────────────────────────────────────────────────────
router.get('/dashboard', protect, csmDashboardController.getStats);
router.get('/reports', protect, csmDashboardController.getReportData);

// ─── TICKET MANAGEMENT ──────────────────────────────────────────────────────
router.post('/tickets', protect, ticketController.createTicket);
router.get('/tickets/debug-auto-assign', ticketController.debugAutoAssign);
router.get('/tickets/customers', protect, ticketController.getTicketCustomers);
router.get('/tickets', protect, ticketController.getTickets);
router.get('/tickets/:id', protect, ticketController.getTicketById);
router.put('/tickets/:id', protect, ticketController.updateTicket);
router.patch('/tickets/:id/assign', protect, ticketController.assignTicket);
router.patch('/tickets/:id/status', protect, ticketController.updateStatus);
router.post('/tickets/:id/comments', protect, ticketController.addComment);
router.post('/tickets/:id/reassign', protect, ticketController.reassignTicket);
router.patch('/tickets/:id/escalate', protect, ticketController.escalateTicket);
router.post('/tickets/:id/feedback', protect, ticketController.submitFeedback);

// Customer contacts for ticket auto-fill
router.post('/customer-contacts', protect, customerContactController.create);
router.get('/customer-contacts', protect, customerContactController.getAll);
router.put('/customer-contacts/:id', protect, customerContactController.update);
router.delete('/customer-contacts/:id', protect, customerContactController.delete);

// ─── SERVICE VISITS ─────────────────────────────────────────────────────────
router.post('/visits', protect, serviceVisitController.createVisit);
router.get('/visits', protect, serviceVisitController.getVisits);
router.get('/visits/:id', protect, serviceVisitController.getVisitById);
router.post('/visits/:id/check-in', protect, serviceVisitController.checkIn);
router.post('/visits/:id/check-out', protect, serviceVisitController.checkOut);
router.patch('/visits/:id/reschedule', protect, serviceVisitController.rescheduleVisit);

// ─── ENTITLEMENTS (WARRANTY / AMC / ASSETS) ─────────────────────────────────
router.get('/entitlements/verify', protect, warrantyAmcController.verifyEntitlements);
router.get('/assets/summary', protect, warrantyAmcController.getAssetSummary);
router.get('/assets/search-serials', protect, warrantyAmcController.searchSerialNumbers);
router.post('/warranties', protect, warrantyAmcController.createWarranty);
router.get('/warranties', protect, warrantyAmcController.getWarranties);
router.post('/amcs', protect, warrantyAmcController.createAmc);
router.get('/amcs', protect, warrantyAmcController.getAmcs);
router.post('/assets', protect, warrantyAmcController.createAsset);
router.get('/assets', protect, warrantyAmcController.getAssets);

// ─── KNOWLEDGE BASE ──────────────────────────────────────────────────────────
router.post('/kb', protect, kbController.createArticle);
router.get('/kb', protect, kbController.getArticles);
router.get('/kb/:id', protect, kbController.getArticleById);
router.put('/kb/:id', protect, kbController.updateArticle);
router.delete('/kb/:id', protect, kbController.deleteArticle);

// ─── CONFIGURATION MASTERS ──────────────────────────────────────────────────
router.post('/masters/seed', protect, csmMasterController.seedDefaults);
router.post('/masters/seed-mh', protect, csmMasterController.seedMhData);
router.post('/masters/seed-kb', protect, csmMasterController.seedKbData);

// Categories
router.post('/masters/categories', protect, csmMasterController.categories.create);
router.get('/masters/categories', protect, csmMasterController.categories.getAll);
router.put('/masters/categories/:id', protect, csmMasterController.categories.update);
router.delete('/masters/categories/:id', protect, csmMasterController.categories.delete);

// Types
router.post('/masters/types', protect, csmMasterController.types.create);
router.get('/masters/types', protect, csmMasterController.types.getAll);
router.put('/masters/types/:id', protect, csmMasterController.types.update);
router.delete('/masters/types/:id', protect, csmMasterController.types.delete);

// Priorities
router.post('/masters/priorities', protect, csmMasterController.priorities.create);
router.get('/masters/priorities', protect, csmMasterController.priorities.getAll);
router.put('/masters/priorities/:id', protect, csmMasterController.priorities.update);
router.delete('/masters/priorities/:id', protect, csmMasterController.priorities.delete);

// Sources
router.post('/masters/sources', protect, csmMasterController.sources.create);
router.get('/masters/sources', protect, csmMasterController.sources.getAll);
router.put('/masters/sources/:id', protect, csmMasterController.sources.update);
router.delete('/masters/sources/:id', protect, csmMasterController.sources.delete);

// Designations
router.post('/masters/designations', protect, csmMasterController.designations.create);
router.get('/masters/designations', protect, csmMasterController.designations.getAll);
router.put('/masters/designations/:id', protect, csmMasterController.designations.update);
router.delete('/masters/designations/:id', protect, csmMasterController.designations.delete);

// SLA Policies
router.post('/masters/sla-policies', protect, csmMasterController.slaPolicies.create);
router.get('/masters/sla-policies', protect, csmMasterController.slaPolicies.getAll);
router.put('/masters/sla-policies/:id', protect, csmMasterController.slaPolicies.update);
router.delete('/masters/sla-policies/:id', protect, csmMasterController.slaPolicies.delete);

// Teams
router.post('/masters/teams', protect, csmMasterController.serviceTeams.create);
router.get('/masters/teams', protect, csmMasterController.serviceTeams.getAll);
router.put('/masters/teams/:id', protect, csmMasterController.serviceTeams.update);
router.delete('/masters/teams/:id', protect, csmMasterController.serviceTeams.delete);

// Engineers
router.post('/masters/engineers', protect, csmMasterController.engineers.create);
router.get('/masters/engineers', protect, csmMasterController.engineers.getAll);
router.put('/masters/engineers/:id', protect, csmMasterController.engineers.update);
router.delete('/masters/engineers/:id', protect, csmMasterController.engineers.delete);

module.exports = router;
