const StockCount = require('../models/StockCount');
const StockAdjustment = require('../models/StockAdjustment');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const stockLedgerService = require('../services/stockLedgerService');

// Sequential count number generator
const generateCountNumber = async (companyId, session = null) => {
    const today = new Date();
    const year = today.getFullYear();
    const prefix = `SC-${year}`;

    const count = await StockCount.countDocuments({
        companyId,
        countNumber: new RegExp(`^${prefix}`)
    }).session(session);

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

// GET /api/inventory/counts - List physical audit sessions
exports.getCounts = async (req, res) => {
    try {
        const { status, warehouseId, search, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (warehouseId) filter.warehouseId = warehouseId;

        if (search) {
            filter.countNumber = { $regex: search, $options: 'i' };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [counts, total] = await Promise.all([
            StockCount.find(filter)
                .populate('warehouseId', 'warehouseCode warehouseName')
                .populate('countedBy', 'name email')
                .populate('verifiedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            StockCount.countDocuments(filter)
        ]);

        res.status(200).json({
            counts,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stock count sessions', error: error.message });
    }
};

// GET /api/inventory/counts/:id - Get single audit session by ID
exports.getCountById = async (req, res) => {
    try {
        const countDoc = await StockCount.findById(req.params.id)
            .populate('warehouseId', 'warehouseCode warehouseName type address bins')
            .populate('items.productId', 'productCode productName sku uom basePrice')
            .populate('countedBy', 'name email')
            .populate('verifiedBy', 'name email')
            .populate('linkedAdjustmentId', 'adjustmentNumber status')
            .lean();

        if (!countDoc) {
            return res.status(404).json({ message: 'Stock Count session not found' });
        }

        res.status(200).json(countDoc);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching audit details', error: error.message });
    }
};

// POST /api/inventory/counts - Start/Schedule physical audit session
exports.createCount = async (req, res) => {
    try {
        const { warehouseId, categoryFilter, notes } = req.body;

        if (!warehouseId) {
            return res.status(400).json({ message: 'Warehouse ID is required' });
        }

        const warehouse = await Warehouse.findById(warehouseId).lean();
        if (!warehouse) {
            return res.status(400).json({ message: 'Warehouse not found' });
        }

        // Auto-load products for warehouse count
        const productQuery = {};
        if (categoryFilter) {
            productQuery.categoryId = categoryFilter;
        }

        const products = await Product.find(productQuery)
            .select('_id productCode productName inventory basePrice')
            .lean();

        const countItems = products.map(prod => ({
            productId: prod._id,
            binRack: 'Default Bin',
            batchNumber: 'DEFAULT',
            expectedQty: Number(prod.inventory?.currentStock || 0),
            countedQty: Number(prod.inventory?.currentStock || 0),
            varianceQty: 0,
            status: 'Match'
        }));

        const countNumber = await generateCountNumber(req.user?.companyId);

        const countDoc = new StockCount({
            companyId: req.user?.companyId,
            countNumber,
            warehouseId,
            categoryFilter: categoryFilter || null,
            scheduledDate: new Date(),
            status: 'In_Progress',
            items: countItems,
            countedBy: req.user?.id,
            notes: notes || ''
        });

        await countDoc.save();
        res.status(201).json({ message: 'Physical Stock Count session started successfully', count: countDoc });
    } catch (error) {
        res.status(500).json({ message: 'Error creating stock count session', error: error.message });
    }
};

// PUT /api/inventory/counts/:id/record - Record physical count entries
exports.recordCount = async (req, res) => {
    try {
        const { items } = req.body; // Array of [{ productId, countedQty }]

        const countDoc = await StockCount.findById(req.params.id);
        if (!countDoc) {
            return res.status(404).json({ message: 'Stock Count session not found' });
        }

        if (['Completed', 'COMPLETED', 'Cancelled'].includes(countDoc.status)) {
            return res.status(400).json({ message: `Count session is already ${countDoc.status}` });
        }

        if (Array.isArray(items)) {
            for (const rec of items) {
                const itemIdx = countDoc.items.findIndex(i => i.productId.toString() === rec.productId.toString());
                if (itemIdx > -1) {
                    const counted = Number(rec.countedQty || 0);
                    const expected = countDoc.items[itemIdx].expectedQty;
                    const variance = counted - expected;

                    countDoc.items[itemIdx].countedQty = counted;
                    countDoc.items[itemIdx].varianceQty = variance;
                    countDoc.items[itemIdx].status = variance === 0 ? 'Match' : 'Discrepancy';
                }
            }
        }

        countDoc.status = 'Pending_Review';
        countDoc.countedBy = req.user?.id;
        await countDoc.save();

        res.status(200).json({ message: 'Physical count recorded successfully', count: countDoc });
    } catch (error) {
        res.status(500).json({ message: 'Error recording physical count', error: error.message });
    }
};

// POST /api/inventory/counts/:id/reconcile - Reconcile physical count and auto-adjust stock
exports.reconcileCount = async (req, res) => {
    try {
        const countDoc = await StockCount.findById(req.params.id);
        if (!countDoc) {
            return res.status(404).json({ message: 'Stock Count session not found' });
        }

        if (['Completed', 'COMPLETED'].includes(countDoc.status)) {
            return res.status(400).json({ message: 'Physical audit session is already reconciled and completed' });
        }

        const discrepancyItems = countDoc.items.filter(i => i.varianceQty !== 0);

        if (discrepancyItems.length > 0) {
            const adjItems = [];

            for (const item of discrepancyItems) {
                const product = await Product.findById(item.productId).lean();
                const unitCost = Number(product?.basePrice || 0);

                adjItems.push({
                    productId: item.productId,
                    batchNumber: item.batchNumber,
                    binRack: item.binRack,
                    systemQty: item.expectedQty,
                    actualQty: item.countedQty,
                    varianceQty: item.varianceQty,
                    unitCost,
                    totalValueImpact: Math.round(item.varianceQty * unitCost * 100) / 100,
                    reason: `Audit Discrepancy (${countDoc.countNumber})`
                });

                // Execute Ledger transaction immediately for reconciliation
                const transactionType = item.varianceQty > 0 ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_SUB';

                await stockLedgerService.recordTransaction({
                    companyId: req.user?.companyId,
                    productId: item.productId,
                    warehouseId: countDoc.warehouseId,
                    transactionType,
                    quantityDelta: item.varianceQty,
                    unitCost,
                    binRack: item.binRack,
                    batchNumber: item.batchNumber,
                    referenceType: 'StockCount',
                    referenceId: countDoc._id,
                    referenceNumber: countDoc.countNumber,
                    performedBy: req.user?.id,
                    notes: `Physical Audit Reconciliation (${countDoc.countNumber})`
                });
            }

            // Create linked StockAdjustment document
            const adjustmentNumber = `ADJ-AUDIT-${countDoc.countNumber.replace('SC-', '')}`;
            const adjustment = new StockAdjustment({
                companyId: req.user?.companyId,
                adjustmentNumber,
                warehouseId: countDoc.warehouseId,
                adjustmentType: 'Physical_Variance',
                items: adjItems,
                status: 'APPROVED',
                requestedBy: req.user?.id,
                approvedBy: req.user?.id,
                approvalDate: new Date(),
                notes: `Auto-generated from Physical Audit ${countDoc.countNumber}`
            });

            await adjustment.save();
            countDoc.linkedAdjustmentId = adjustment._id;
        }

        countDoc.status = 'Completed';
        countDoc.completedDate = new Date();
        countDoc.verifiedBy = req.user?.id;
        await countDoc.save();

        res.status(200).json({
            message: `Physical audit reconciled successfully. ${discrepancyItems.length} discrepancies adjusted in Stock Ledger.`,
            count: countDoc
        });
    } catch (error) {
        res.status(500).json({ message: 'Error reconciling physical count', error: error.message });
    }
};
