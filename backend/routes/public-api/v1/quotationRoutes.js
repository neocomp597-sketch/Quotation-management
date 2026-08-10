const express = require('express');
const router = express.Router();
const Quotation = require('../../../models/Quotation');
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated, sendError } = require('../../../utils/apiResponse');

// GET /api/v1/quotations - List quotations
router.get('/', requireApiScope('deals.read'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId: req.apiClient.companyId };

        if (req.query.search) {
            filter.quotationNo = new RegExp(req.query.search.trim(), 'i');
        }

        const [quotes, total] = await Promise.all([
            Quotation.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('customerId', 'customerName companyName')
                .lean(),
            Quotation.countDocuments(filter)
        ]);

        const formatted = quotes.map(q => ({
            id: q._id,
            quotationNo: q.quotationNo,
            customerName: q.customerId ? (q.customerId.customerName || q.customerId.companyName) : 'N/A',
            status: q.status || 'Draft',
            grandTotal: q.grandTotal || q.totalAmount || 0,
            validTill: q.validTill,
            createdAt: q.createdAt
        }));

        return sendPaginated(res, formatted, page, limit, total);
    } catch (error) {
        console.error('[PublicAPI] Error fetching quotations:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve quotations', 500);
    }
});

// GET /api/v1/quotations/:id - Get quotation by ID
router.get('/:id', requireApiScope('deals.read'), async (req, res) => {
    try {
        const quote = await Quotation.findOne({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        }).populate('customerId', 'customerName companyName email mobile').lean();

        if (!quote) {
            return sendError(res, 'resource_not_found', 'Quotation was not found', 404);
        }

        const formatted = {
            id: quote._id,
            quotationNo: quote.quotationNo,
            customerName: quote.customerId ? (quote.customerId.customerName || quote.customerId.companyName) : 'N/A',
            status: quote.status || 'Draft',
            grandTotal: quote.grandTotal || 0,
            validTill: quote.validTill,
            items: (quote.items || []).map(i => ({
                productName: i.productName,
                quantity: i.quantity,
                rate: i.rate,
                total: i.total
            })),
            createdAt: quote.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error fetching quotation by ID:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve quotation', 500);
    }
});

module.exports = router;
