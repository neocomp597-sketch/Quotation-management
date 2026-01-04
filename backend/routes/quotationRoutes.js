const express = require('express');
const router = express.Router();
const {
    createQuotation,
    updateQuotation,
    deleteQuotation,
    getQuotationById,
    getAllQuotations,
    finalizeQuotation
} = require('../controllers/quotationController');

const { protect } = require('../middlewares/authMiddleware');

// POST: Create Quotation
router.post('/', protect, createQuotation);

// GET: Get all quotations
router.get('/', protect, getAllQuotations);

// GET: Get a specific quotation
router.get('/:id', protect, getQuotationById);

// PUT: Update Quotation
router.put('/:id', protect, updateQuotation);

// DELETE: Delete Quotation
router.delete('/:id', protect, deleteQuotation);

// PATCH: Finalize Quotation

module.exports = router;
