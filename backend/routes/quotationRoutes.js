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

// POST: Create Quotation
router.post('/', createQuotation);

// PUT: Update Quotation
router.put('/:id', updateQuotation);

// DELETE: Delete Quotation
router.delete('/:id', deleteQuotation);

// PATCH: Finalize Quotation
router.patch('/:id/finalize', finalizeQuotation);

// GET: Get a specific quotation
router.get('/:id', getQuotationById);

// GET: Get all quotations
router.get('/', getAllQuotations);

module.exports = router;
