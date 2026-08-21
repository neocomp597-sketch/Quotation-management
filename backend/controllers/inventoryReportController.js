const StockLedger = require('../models/StockLedger');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');

// GET /api/inventory/reports/ledger - Transaction ledger register
exports.getLedgerReport = async (req, res) => {
    try {
        const { startDate, endDate, productId, warehouseId, transactionType, page = 1, limit = 100 } = req.query;
        const filter = {};

        if (productId) filter.productId = productId;
        if (warehouseId) filter.warehouseId = warehouseId;
        if (transactionType) filter.transactionType = transactionType;

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [transactions, total] = await Promise.all([
            StockLedger.find(filter)
                .populate('productId', 'productCode productName sku uom')
                .populate('warehouseId', 'warehouseCode warehouseName')
                .populate('performedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            StockLedger.countDocuments(filter)
        ]);

        res.status(200).json({
            transactions,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        res.status(500).json({ message: 'Error generating stock ledger report', error: error.message });
    }
};

// GET /api/inventory/reports/valuation - Stock Valuation Report by Warehouse / Category
exports.getValuationReport = async (req, res) => {
    try {
        const { warehouseId, categoryId } = req.query;
        const productFilter = {};
        if (categoryId) productFilter.categoryId = categoryId;

        const products = await Product.find(productFilter)
            .populate('categoryId', 'categoryName')
            .select('productCode productName sku categoryId basePrice inventory')
            .lean();

        let grandTotalItems = 0;
        let grandTotalValuation = 0;

        const valuationItems = products.map(prod => {
            const currentStock = Number(prod.inventory?.currentStock || 0);
            const unitCost = Number(prod.basePrice || 0);
            const totalValuation = Math.round(currentStock * unitCost * 100) / 100;

            grandTotalItems += currentStock;
            grandTotalValuation += totalValuation;

            return {
                productId: prod._id,
                productCode: prod.productCode,
                productName: prod.productName,
                sku: prod.sku,
                categoryName: prod.categoryId?.categoryName || 'Uncategorized',
                currentStock,
                unitCost,
                totalValuation
            };
        });

        res.status(200).json({
            grandTotalItems,
            grandTotalValuation: Math.round(grandTotalValuation * 100) / 100,
            items: valuationItems
        });
    } catch (error) {
        res.status(500).json({ message: 'Error generating valuation report', error: error.message });
    }
};

// GET /api/inventory/reports/movement - Fast/Slow Moving & Dead Stock Analysis
exports.getMovementReport = async (req, res) => {
    try {
        const { days = 90 } = req.query;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - Number(days));

        // Aggregate outward movements in period
        const movementData = await StockLedger.aggregate([
            {
                $match: {
                    companyId: req.user?.companyId,
                    transactionType: { $in: ['STOCK_OUT', 'TRANSFER_OUT'] },
                    createdAt: { $gte: cutoffDate }
                }
            },
            {
                $group: {
                    _id: '$productId',
                    outwardQty: { $sum: { $abs: '$quantityDelta' } },
                    transactionCount: { $sum: 1 },
                    lastMovementDate: { $max: '$createdAt' }
                }
            }
        ]);

        const movementMap = new Map();
        movementData.forEach(item => {
            movementMap.set(item._id.toString(), item);
        });

        const products = await Product.find({ companyId: req.user?.companyId })
            .populate('categoryId', 'categoryName')
            .select('productCode productName sku categoryId inventory basePrice')
            .lean();

        const report = products.map(prod => {
            const mov = movementMap.get(prod._id.toString());
            const outwardQty = mov ? mov.outwardQty : 0;
            const currentStock = Number(prod.inventory?.currentStock || 0);

            let velocity = 'Dead Stock';
            if (outwardQty > 50) velocity = 'Fast Moving';
            else if (outwardQty > 0) velocity = 'Slow Moving';

            return {
                productId: prod._id,
                productCode: prod.productCode,
                productName: prod.productName,
                categoryName: prod.categoryId?.categoryName || 'Uncategorized',
                currentStock,
                outwardQtyInPeriod: outwardQty,
                lastMovementDate: mov ? mov.lastMovementDate : null,
                velocityCategory: velocity
            };
        });

        res.status(200).json({
            days: Number(days),
            totalProducts: report.length,
            report
        });
    } catch (error) {
        res.status(500).json({ message: 'Error generating stock movement report', error: error.message });
    }
};
