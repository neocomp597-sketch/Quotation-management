const express = require('express');
const router = express.Router();
const Product = require('../../../models/Product');
const { requireApiScope } = require('../../../middleware/apiPermission');
const { sendSuccess, sendPaginated, sendError } = require('../../../utils/apiResponse');

// GET /api/v1/products - List products
router.get('/', requireApiScope('customers.read'), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const skip = (page - 1) * limit;

        const filter = { companyId: req.apiClient.companyId };

        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            filter.$or = [
                { productName: searchRegex },
                { productCode: searchRegex },
                { hsnCode: searchRegex },
                { brand: searchRegex }
            ];
        }

        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Product.countDocuments(filter)
        ]);

        const formatted = products.map(p => ({
            id: p._id,
            productCode: p.productCode,
            productName: p.productName,
            hsnCode: p.hsnCode || '',
            gstPercentage: p.gstPercentage || 18,
            basePrice: p.basePrice || 0,
            mrp: p.mrp || 0,
            uom: p.uom || 'Pcs',
            brand: p.brand || '',
            status: p.status || 'Active',
            createdAt: p.createdAt
        }));

        return sendPaginated(res, formatted, page, limit, total);
    } catch (error) {
        console.error('[PublicAPI] Error fetching products:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve products', 500);
    }
});

// GET /api/v1/products/:id - Single product
router.get('/:id', requireApiScope('customers.read'), async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            companyId: req.apiClient.companyId
        }).lean();

        if (!product) {
            return sendError(res, 'resource_not_found', 'Product was not found', 404);
        }

        const formatted = {
            id: product._id,
            productCode: product.productCode,
            productName: product.productName,
            hsnCode: product.hsnCode || '',
            gstPercentage: product.gstPercentage || 18,
            basePrice: product.basePrice || 0,
            mrp: product.mrp || 0,
            uom: product.uom || 'Pcs',
            brand: product.brand || '',
            status: product.status || 'Active',
            createdAt: product.createdAt
        };

        return sendSuccess(res, formatted);
    } catch (error) {
        console.error('[PublicAPI] Error fetching product by ID:', error);
        return sendError(res, 'internal_error', 'Failed to retrieve product', 500);
    }
});

module.exports = router;
