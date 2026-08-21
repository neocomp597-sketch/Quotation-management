const StockAdjustment = require('../models/StockAdjustment');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const stockLedgerService = require('../services/stockLedgerService');

// Sequential adjustment number generator
const generateAdjustmentNumber = async (companyId, session = null) => {
    const today = new Date();
    const year = today.getFullYear();
    const prefix = `ADJ-${year}`;

    const count = await StockAdjustment.countDocuments({
        companyId,
        adjustmentNumber: new RegExp(`^${prefix}`)
    }).session(session);

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

// GET /api/inventory/adjustments - List stock adjustments
exports.getAdjustments = async (req, res) => {
    try {
        const { status, warehouseId, adjustmentType, search, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (warehouseId) filter.warehouseId = warehouseId;
        if (adjustmentType) filter.adjustmentType = adjustmentType;

        if (search) {
            filter.adjustmentNumber = { $regex: search, $options: 'i' };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [adjustments, total] = await Promise.all([
            StockAdjustment.find(filter)
                .populate('warehouseId', 'warehouseCode warehouseName')
                .populate('items.productId', 'productCode productName uom basePrice')
                .populate('requestedBy', 'name email')
                .populate('approvedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            StockAdjustment.countDocuments(filter)
        ]);

        res.status(200).json({
            adjustments,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stock adjustments', error: error.message });
    }
};

// GET /api/inventory/adjustments/:id - Get single adjustment by ID
exports.getAdjustmentById = async (req, res) => {
    try {
        const adjustment = await StockAdjustment.findById(req.params.id)
            .populate('warehouseId', 'warehouseCode warehouseName type address')
            .populate('items.productId', 'productCode productName sku uom basePrice')
            .populate('requestedBy', 'name email')
            .populate('approvedBy', 'name email')
            .lean();

        if (!adjustment) {
            return res.status(404).json({ message: 'Stock Adjustment not found' });
        }

        res.status(200).json(adjustment);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching adjustment details', error: error.message });
    }
};

// POST /api/inventory/adjustments - Create stock adjustment request (NO stock change)
exports.createAdjustment = async (req, res) => {
    try {
        const { warehouseId, adjustmentType, items, notes } = req.body;

        if (!warehouseId || !adjustmentType) {
            return res.status(400).json({ message: 'Warehouse ID and Adjustment Type are required' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Adjustment request must contain at least one item' });
        }

        const warehouse = await Warehouse.findById(warehouseId).lean();
        if (!warehouse) {
            return res.status(400).json({ message: 'Warehouse not found' });
        }

        const processedItems = [];

        for (const item of items) {
            if (!item.productId) {
                return res.status(400).json({ message: 'Product ID is required for all items' });
            }

            const product = await Product.findById(item.productId).lean();
            if (!product) {
                return res.status(400).json({ message: `Product not found for ID: ${item.productId}` });
            }

            const systemQty = Number(item.systemQty !== undefined ? item.systemQty : (product.inventory?.currentStock || 0));
            const actualQty = Number(item.actualQty || 0);
            const varianceQty = actualQty - systemQty;
            const unitCost = Number(item.unitCost || product.basePrice || 0);
            const totalValueImpact = Math.round(varianceQty * unitCost * 100) / 100;

            processedItems.push({
                productId: product._id,
                batchNumber: item.batchNumber || '',
                binRack: item.binRack || '',
                systemQty,
                actualQty,
                varianceQty,
                unitCost,
                totalValueImpact,
                reason: item.reason || adjustmentType
            });
        }

        const adjustmentNumber = await generateAdjustmentNumber(req.user?.companyId);

        const adjustment = new StockAdjustment({
            companyId: req.user?.companyId,
            adjustmentNumber,
            warehouseId,
            adjustmentType,
            items: processedItems,
            status: 'PENDING_APPROVAL',
            requestedBy: req.user?.id,
            notes: notes || ''
        });

        await adjustment.save();
        res.status(201).json({ message: 'Stock Adjustment request created successfully', adjustment });
    } catch (error) {
        res.status(500).json({ message: 'Error creating stock adjustment', error: error.message });
    }
};

// POST /api/inventory/adjustments/:id/approve - Approve Adjustment Request (Writes to StockLedger)
exports.approveAdjustment = async (req, res) => {
    try {
        const adjustment = await StockAdjustment.findById(req.params.id);
        if (!adjustment) {
            return res.status(404).json({ message: 'Stock Adjustment not found' });
        }

        if (['APPROVED', 'Approved'].includes(adjustment.status)) {
            return res.status(400).json({ message: 'Stock Adjustment has already been approved' });
        }

        if (['REJECTED', 'Rejected'].includes(adjustment.status)) {
            return res.status(400).json({ message: 'Cannot approve a rejected stock adjustment' });
        }

        // Apply ledger transactions for variance
        for (const item of adjustment.items) {
            if (item.varianceQty === 0) continue;

            const transactionType = item.varianceQty > 0 ? 'ADJUSTMENT_ADD' : 'ADJUSTMENT_SUB';

            await stockLedgerService.recordTransaction({
                companyId: req.user?.companyId,
                productId: item.productId,
                warehouseId: adjustment.warehouseId,
                transactionType,
                quantityDelta: item.varianceQty,
                unitCost: item.unitCost,
                binRack: item.binRack,
                batchNumber: item.batchNumber,
                referenceType: 'StockAdjustment',
                referenceId: adjustment._id,
                referenceNumber: adjustment.adjustmentNumber,
                performedBy: req.user?.id,
                notes: `Adjustment (${adjustment.adjustmentType}): ${item.reason}`
            });
        }

        adjustment.status = 'APPROVED';
        adjustment.approvedBy = req.user?.id;
        adjustment.approvalDate = new Date();
        await adjustment.save();

        res.status(200).json({ message: 'Stock Adjustment approved and ledger updated successfully', adjustment });
    } catch (error) {
        res.status(500).json({ message: 'Error approving stock adjustment', error: error.message });
    }
};

// POST /api/inventory/adjustments/:id/reject - Reject Stock Adjustment Request
exports.rejectAdjustment = async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        const adjustment = await StockAdjustment.findById(req.params.id);
        if (!adjustment) {
            return res.status(404).json({ message: 'Stock Adjustment not found' });
        }

        if (['APPROVED', 'Approved'].includes(adjustment.status)) {
            return res.status(400).json({ message: 'Cannot reject an already approved adjustment' });
        }

        adjustment.status = 'REJECTED';
        adjustment.rejectionReason = rejectionReason || 'Rejected by manager';
        await adjustment.save();

        res.status(200).json({ message: 'Stock Adjustment rejected', adjustment });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting stock adjustment', error: error.message });
    }
};
