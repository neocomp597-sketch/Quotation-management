const express = require('express');
const router = express.Router();
const Voucher = require('../../../models/Voucher');
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated, sendError } = require('../../../utils/apiResponse');

// GET /api/v1/orders - List sales orders / vouchers
router.get('/', requireApiScope('orders.read'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId: req.apiClient.companyId };

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            filter.$or = [
                { voucherNumber: searchRegex },
                { customerName: searchRegex },
                { vendorName: searchRegex }
            ];
        }

        const [orders, total] = await Promise.all([
            Voucher.find(filter)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Voucher.countDocuments(filter)
        ]);

        const formatted = orders.map(o => ({
            id: o._id,
            voucherType: o.voucherType,
            voucherNumber: o.voucherNumber,
            date: o.date,
            customerName: o.customerName || '',
            vendorName: o.vendorName || '',
            totalQty: o.totalQty || 0,
            grandTotal: o.grandTotal || 0,
            createdAt: o.createdAt
        }));

        return sendPaginated(res, formatted, page, limit, total);
    } catch (error) {
        console.error('[PublicAPI] Error fetching sales orders:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve sales orders', 500);
    }
});

// GET /api/v1/orders/:id - Get single order
router.get('/:id', requireApiScope('orders.read'), async (req, res) => {
    try {
        const order = await Voucher.findOne({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        }).lean();

        if (!order) {
            return sendError(res, 'resource_not_found', 'Sales order was not found', 404);
        }

        const formatted = {
            id: order._id,
            voucherType: order.voucherType,
            voucherNumber: order.voucherNumber,
            date: order.date,
            customerName: order.customerName || '',
            vendorName: order.vendorName || '',
            items: (order.items || []).map(item => ({
                productName: item.productName,
                qty: item.qty,
                price: item.price,
                amount: item.amount,
                taxAmount: item.taxAmount
            })),
            totalQty: order.totalQty || 0,
            totalAmount: order.totalAmount || 0,
            totalTax: order.totalTax || 0,
            grandTotal: order.grandTotal || 0,
            createdAt: order.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error fetching sales order by ID:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve sales order', 500);
    }
});

module.exports = router;
