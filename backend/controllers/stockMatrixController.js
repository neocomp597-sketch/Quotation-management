const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const StockLedger = require('../models/StockLedger');

// Calculate stock status enum based on quantities & thresholds
const determineStockStatus = (currentStock, minStock, maxStock) => {
    const min = Number(minStock || 5);
    const max = Number(maxStock || 1000);
    const current = Number(currentStock || 0);

    if (current <= 0) return 'OUT_OF_STOCK';
    if (current <= min) return 'LOW_STOCK';
    if (max > 0 && current >= max) return 'OVERSTOCK';
    return 'NORMAL';
};

// GET /api/inventory/stock - Core operational stock matrix API
exports.getStockMatrix = async (req, res) => {
    try {
        const {
            warehouseId,
            productId,
            categoryId,
            batchNumber,
            binRack,
            stockStatus,
            search,
            page = 1,
            limit = 50
        } = req.query;

        const filter = {};

        if (productId) filter._id = productId;
        if (categoryId) filter.categoryId = categoryId;

        if (search) {
            filter.$or = [
                { productName: { $regex: search, $options: 'i' } },
                { productCode: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        // Fetch products matching filters
        const [products, totalProducts] = await Promise.all([
            Product.find(filter)
                .populate('categoryId', 'categoryName')
                .select('productCode productName categoryId hsnCode gstPercentage basePrice mrp uom brand sku minStock maxStock inventory pricing status vendors')
                .sort({ productName: 1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Product.countDocuments(filter)
        ]);

        // Default warehouse lookup if needed
        let targetWarehouse = null;
        if (warehouseId) {
            targetWarehouse = await Warehouse.findById(warehouseId).lean();
        } else {
            targetWarehouse = await Warehouse.findOne({ companyId: req.user?.companyId, isDefault: true }).lean();
        }

        // Aggregate stock items
        const stockItems = [];

        for (const prod of products) {
            const currentStock = Number(prod.inventory?.currentStock || 0);
            const reservedStock = Number(prod.inventory?.reservedStock || 0);
            const availableStock = Math.max(0, currentStock - reservedStock);
            const minStock = Number(prod.minStock || 5);
            const maxStock = Number(prod.maxStock || 1000);
            const unitCost = Number(prod.pricing?.baseCost || prod.basePrice || 0);
            const stockValue = Math.round(currentStock * unitCost * 100) / 100;
            const computedStatus = determineStockStatus(currentStock, minStock, maxStock);

            // If stockStatus filter is provided, skip non-matching
            if (stockStatus && stockStatus.toUpperCase() !== computedStatus) {
                continue;
            }

            stockItems.push({
                productId: prod._id,
                productCode: prod.productCode,
                productName: prod.productName,
                sku: prod.sku || prod.productCode,
                categoryName: prod.categoryId?.categoryName || 'Uncategorized',
                warehouseId: targetWarehouse?._id || null,
                warehouseName: targetWarehouse?.warehouseName || 'Main Warehouse',
                binRack: binRack || 'Default Bin',
                batchNumber: batchNumber || 'DEFAULT',
                currentStock,
                reservedStock,
                availableStock,
                reorderLevel: minStock,
                minStock,
                maxStock,
                unitCost,
                stockValue,
                expiryDate: null,
                stockStatus: computedStatus
            });
        }

        res.status(200).json({
            stock: stockItems,
            total: totalProducts,
            page: Number(page),
            pages: Math.ceil(totalProducts / Number(limit))
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stock matrix', error: error.message });
    }
};

// GET /api/inventory/stock/product/:productId - Multi-warehouse product stock breakdown tree
exports.getProductStockBreakdown = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findById(productId)
            .populate('categoryId', 'categoryName')
            .lean();

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Fetch all active warehouses for company
        const warehouses = await Warehouse.find({ companyId: req.user?.companyId, isActive: true }).lean();

        // Calculate ledger movements grouped by warehouse
        const ledgerSummary = await StockLedger.aggregate([
            { $match: { companyId: req.user?.companyId, productId: product._id } },
            {
                $group: {
                    _id: '$warehouseId',
                    totalQty: { $sum: '$quantityDelta' },
                    totalValuation: { $sum: '$totalValue' }
                }
            }
        ]);

        const warehouseStockMap = new Map();
        ledgerSummary.forEach(item => {
            if (item._id) {
                warehouseStockMap.set(item._id.toString(), Math.max(0, item.totalQty));
            }
        });

        let grandTotalStock = 0;
        const warehouseBreakdown = warehouses.map(wh => {
            const whStock = warehouseStockMap.get(wh._id.toString()) || 0;
            grandTotalStock += whStock;

            // Generate bin/rack distribution tree
            const binDistribution = (wh.bins || []).map(b => ({
                binCode: b.binCode,
                rack: b.rack || 'A1',
                allocatedStock: Math.round(whStock / Math.max(1, (wh.bins || []).length))
            }));

            return {
                warehouseId: wh._id,
                warehouseCode: wh.warehouseCode,
                warehouseName: wh.warehouseName,
                warehouseType: wh.type,
                currentStock: whStock,
                bins: binDistribution
            };
        });

        // Fallback if no ledger entries yet
        if (grandTotalStock === 0 && product.inventory?.currentStock > 0) {
            grandTotalStock = Number(product.inventory.currentStock);
            if (warehouseBreakdown.length > 0) {
                warehouseBreakdown[0].currentStock = grandTotalStock;
            }
        }

        res.status(200).json({
            product: {
                _id: product._id,
                productCode: product.productCode,
                productName: product.productName,
                sku: product.sku,
                uom: product.uom,
                categoryName: product.categoryId?.categoryName || 'Uncategorized',
                basePrice: product.basePrice,
                minStock: product.minStock || 5
            },
            totalStock: grandTotalStock,
            warehouses: warehouseBreakdown
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching product stock breakdown', error: error.message });
    }
};
