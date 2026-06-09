const express = require('express');
const router = express.Router();
const {
    createQuotation,
    updateQuotation,
    deleteQuotation,
    updateStatus,
    getQuotationById,
    getAllQuotations,
    finalizeQuotation,
    getReports,
    getDraft,
    autosaveDraft,
    deleteDraft
} = require('../controllers/quotationController');

const { protect } = require('../middlewares/authMiddleware');

// POST: Create Quotation
router.post('/', protect, createQuotation);

// GET: Get reports
router.get('/reports', protect, getReports);

router.get('/drafts/:draftKey', protect, getDraft);
router.put('/drafts/:draftKey', protect, autosaveDraft);
router.delete('/drafts/:draftKey', protect, deleteDraft);

// GET: Get all quotations
router.get('/', protect, getAllQuotations);

// GET: Get a specific quotation
router.get('/:id', protect, getQuotationById);

// PUT: Update Quotation
router.put('/:id', protect, updateQuotation);

// DELETE: Delete Quotation
router.delete('/:id', protect, deleteQuotation);

// PATCH: Update Quotation Status
router.patch('/:id/status', protect, updateStatus);

// PATCH: Finalize Quotation
router.patch('/:id/finalize', protect, finalizeQuotation);

module.exports = router;
