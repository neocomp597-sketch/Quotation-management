const mongoose = require('mongoose');
const StockTransfer = require('../models/StockTransfer');
const Warehouse = require('../models/Warehouse');
const Product = require('../models/Product');
const stockLedgerService = require('../services/stockLedgerService');

// Sequential transfer number generator
const generateTransferNumber = async (companyId, session = null) => {
    const today = new Date();
    const year = today.getFullYear();
    const prefix = `TR-${year}`;

    const count = await StockTransfer.countDocuments({
        companyId,
        transferNumber: new RegExp(`^${prefix}`)
    }).session(session);

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

// GET /api/inventory/transfers - List stock transfers with filters
exports.getTransfers = async (req, res) => {
    try {
        const { status, fromWarehouseId, toWarehouseId, search, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (fromWarehouseId) filter.fromWarehouseId = fromWarehouseId;
        if (toWarehouseId) filter.toWarehouseId = toWarehouseId;

        if (search) {
            filter.transferNumber = { $regex: search, $options: 'i' };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [transfers, total] = await Promise.all([
            StockTransfer.find(filter)
                .populate('fromWarehouseId', 'warehouseCode warehouseName')
                .populate('toWarehouseId', 'warehouseCode warehouseName')
                .populate('items.productId', 'productCode productName uom')
                .populate('requestedBy', 'name email')
                .populate('approvedBy', 'name email')
                .populate('dispatchedBy', 'name email')
                .populate('receivedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            StockTransfer.countDocuments(filter)
        ]);

        res.status(200).json({
            transfers,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stock transfers', error: error.message });
    }
};

// GET /api/inventory/transfers/:id - Get single transfer by ID
exports.getTransferById = async (req, res) => {
    try {
        const transfer = await StockTransfer.findById(req.params.id)
            .populate('fromWarehouseId', 'warehouseCode warehouseName type address')
            .populate('toWarehouseId', 'warehouseCode warehouseName type address')
            .populate('items.productId', 'productCode productName sku uom basePrice minStock')
            .populate('requestedBy', 'name email')
            .populate('approvedBy', 'name email')
            .populate('dispatchedBy', 'name email')
            .populate('receivedBy', 'name email')
            .lean();

        if (!transfer) {
            return res.status(404).json({ message: 'Stock Transfer not found' });
        }

        res.status(200).json(transfer);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching transfer details', error: error.message });
    }
};

// POST /api/inventory/transfers - Create new Stock Transfer Request (NO stock change)
exports.createTransfer = async (req, res) => {
    try {
        const { fromWarehouseId, toWarehouseId, expectedDeliveryDate, items, notes } = req.body;

        if (!fromWarehouseId || !toWarehouseId) {
            return res.status(400).json({ message: 'Source and Destination Warehouses are required' });
        }

        if (fromWarehouseId.toString() === toWarehouseId.toString()) {
            return res.status(400).json({ message: 'Source and Destination warehouses must be different' });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Transfer request must contain at least one item' });
        }

        const fromWh = await Warehouse.findById(fromWarehouseId).lean();
        const toWh = await Warehouse.findById(toWarehouseId).lean();

        if (!fromWh || !toWh) {
            return res.status(400).json({ message: 'Invalid Source or Destination Warehouse' });
        }

        const processedItems = [];

        for (const item of items) {
            if (!item.productId || Number(item.qtyRequested || 0) <= 0) {
                return res.status(400).json({ message: 'Valid Product ID and Quantity (> 0) are required for all items' });
            }

            const product = await Product.findById(item.productId).lean();
            if (!product) {
                return res.status(400).json({ message: `Product not found for ID: ${item.productId}` });
            }

            const qtyReq = Number(item.qtyRequested);
            const currentStock = Number(product.inventory?.currentStock || 0);

            if (currentStock < qtyReq) {
                return res.status(400).json({
                    message: `Insufficient stock for product '${product.productName}'. Available: ${currentStock}, Requested: ${qtyReq}`
                });
            }

            processedItems.push({
                productId: product._id,
                batchNumber: item.batchNumber || '',
                qtyRequested: qtyReq,
                qtyDispatched: 0,
                qtyReceived: 0,
                uom: product.uom || 'Pcs',
                serialNumbers: item.serialNumbers || []
            });
        }

        const transferNumber = await generateTransferNumber(req.user?.companyId);

        const transfer = new StockTransfer({
            companyId: req.user?.companyId,
            transferNumber,
            fromWarehouseId,
            toWarehouseId,
            requestDate: new Date(),
            expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
            items: processedItems,
            status: 'PENDING_APPROVAL',
            requestedBy: req.user?.id,
            notes: notes || ''
        });

        await transfer.save();
        res.status(201).json({ message: 'Stock Transfer request created successfully', transfer });
    } catch (error) {
        res.status(500).json({ message: 'Error creating stock transfer', error: error.message });
    }
};

// POST /api/inventory/transfers/:id/approve - Approve Transfer Request (NO stock change)
exports.approveTransfer = async (req, res) => {
    try {
        const transfer = await StockTransfer.findById(req.params.id);
        if (!transfer) {
            return res.status(404).json({ message: 'Stock Transfer not found' });
        }

        if (!['Pending_Approval', 'PENDING_APPROVAL', 'Draft'].includes(transfer.status)) {
            return res.status(400).json({ message: `Transfer cannot be approved from current status '${transfer.status}'` });
        }

        // Re-validate stock availability
        for (const item of transfer.items) {
            const product = await Product.findById(item.productId).lean();
            const avail = Number(product?.inventory?.currentStock || 0);
            if (avail < item.qtyRequested) {
                return res.status(400).json({
                    message: `Cannot approve transfer. Product '${product?.productName}' current stock (${avail}) is less than requested (${item.qtyRequested})`
                });
            }
        }

        transfer.status = 'APPROVED';
        transfer.approvedBy = req.user?.id;
        await transfer.save();

        res.status(200).json({ message: 'Stock Transfer approved successfully', transfer });
    } catch (error) {
        res.status(500).json({ message: 'Error approving stock transfer', error: error.message });
    }
};

// POST /api/inventory/transfers/:id/dispatch - Dispatch Stock Transfer (Generates TRANSFER_OUT Ledger Entry)
exports.dispatchTransfer = async (req, res) => {
    try {
        const { dispatchItems } = req.body; // Optional partial dispatch array: [{ productId, dispatchQty }]

        const transfer = await StockTransfer.findById(req.params.id);
        if (!transfer) {
            return res.status(404).json({ message: 'Stock Transfer not found' });
        }

        // Double dispatch safety check
        if (['DISPATCHED', 'Dispatched', 'PARTIALLY_RECEIVED', 'COMPLETED', 'Completed'].includes(transfer.status)) {
            return res.status(400).json({ message: 'Transfer has already been dispatched' });
        }

        if (!['APPROVED', 'Approved', 'Pending_Approval', 'PENDING_APPROVAL'].includes(transfer.status)) {
            return res.status(400).json({ message: `Transfer cannot be dispatched in status '${transfer.status}'` });
        }

        for (const item of transfer.items) {
            const override = (dispatchItems || []).find(d => d.productId?.toString() === item.productId.toString());
            const qtyToDispatch = override ? Number(override.dispatchQty) : (item.qtyRequested - item.qtyDispatched);

            if (qtyToDispatch <= 0) continue;

            // Over-dispatching safety
            if (item.qtyDispatched + qtyToDispatch > item.qtyRequested) {
                return res.status(400).json({
                    message: `Over-dispatch rejected. Product requested: ${item.qtyRequested}, already dispatched: ${item.qtyDispatched}, attempted dispatch: ${qtyToDispatch}`
                });
            }

            // Insufficient stock safety check
            const product = await Product.findById(item.productId).lean();
            const availStock = Number(product?.inventory?.currentStock || 0);
            if (availStock < qtyToDispatch) {
                return res.status(400).json({
                    message: `Insufficient stock in source warehouse. Available: ${availStock}, Attempting dispatch: ${qtyToDispatch}`
                });
            }

            // Execute Immutable Ledger Entry: TRANSFER_OUT
            await stockLedgerService.recordTransaction({
                companyId: req.user?.companyId,
                productId: item.productId,
                warehouseId: transfer.fromWarehouseId,
                transactionType: 'TRANSFER_OUT',
                quantityDelta: -qtyToDispatch,
                unitCost: product?.basePrice || 0,
                batchNumber: item.batchNumber,
                serialNumbers: item.serialNumbers,
                referenceType: 'StockTransfer',
                referenceId: transfer._id,
                referenceNumber: transfer.transferNumber,
                performedBy: req.user?.id,
                notes: `Transfer Out to ${transfer.toWarehouseId}`
            });

            item.qtyDispatched += qtyToDispatch;
        }

        transfer.status = 'DISPATCHED';
        transfer.dispatchedBy = req.user?.id;
        transfer.dispatchDate = new Date();
        await transfer.save();

        res.status(200).json({ message: 'Stock Transfer dispatched successfully', transfer });
    } catch (error) {
        res.status(500).json({ message: 'Error dispatching stock transfer', error: error.message });
    }
};

// POST /api/inventory/transfers/:id/receive - Receive Stock Transfer (Generates TRANSFER_IN Ledger Entry)
exports.receiveTransfer = async (req, res) => {
    try {
        const { receiveItems } = req.body; // Array of [{ productId, receiveQty }]

        const transfer = await StockTransfer.findById(req.params.id);
        if (!transfer) {
            return res.status(404).json({ message: 'Stock Transfer not found' });
        }

        // Double receive / Completed safety check
        if (['COMPLETED', 'Completed'].includes(transfer.status)) {
            return res.status(400).json({ message: 'Transfer is already completed' });
        }

        if (!['DISPATCHED', 'Dispatched', 'PARTIALLY_RECEIVED', 'Partially_Received'].includes(transfer.status)) {
            return res.status(400).json({ message: `Transfer must be dispatched before receiving. Current status: '${transfer.status}'` });
        }

        let allFullyReceived = true;

        for (const item of transfer.items) {
            const override = (receiveItems || []).find(r => r.productId?.toString() === item.productId.toString());
            const pendingDispatch = item.qtyDispatched - item.qtyReceived;
            const qtyToReceive = override ? Number(override.receiveQty) : pendingDispatch;

            if (qtyToReceive <= 0) {
                if (item.qtyReceived < item.qtyDispatched) allFullyReceived = false;
                continue;
            }

            // Over-receiving safety check against dispatched quantity
            if (item.qtyReceived + qtyToReceive > item.qtyDispatched) {
                return res.status(400).json({
                    message: `Over-receive rejected. Dispatched: ${item.qtyDispatched}, already received: ${item.qtyReceived}, attempted receive: ${qtyToReceive}`
                });
            }

            const product = await Product.findById(item.productId).lean();

            // Execute Immutable Ledger Entry: TRANSFER_IN at destination warehouse
            await stockLedgerService.recordTransaction({
                companyId: req.user?.companyId,
                productId: item.productId,
                warehouseId: transfer.toWarehouseId,
                transactionType: 'TRANSFER_IN',
                quantityDelta: qtyToReceive,
                unitCost: product?.basePrice || 0,
                batchNumber: item.batchNumber,
                serialNumbers: item.serialNumbers,
                referenceType: 'StockTransfer',
                referenceId: transfer._id,
                referenceNumber: transfer.transferNumber,
                performedBy: req.user?.id,
                notes: `Transfer In from ${transfer.fromWarehouseId}`
            });

            item.qtyReceived += qtyToReceive;

            if (item.qtyReceived < item.qtyDispatched) {
                allFullyReceived = false;
            }
        }

        transfer.status = allFullyReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED';
        transfer.receivedBy = req.user?.id;
        transfer.receivedDate = new Date();
        await transfer.save();

        res.status(200).json({ message: `Stock Transfer updated. Status: ${transfer.status}`, transfer });
    } catch (error) {
        res.status(500).json({ message: 'Error receiving stock transfer', error: error.message });
    }
};

// POST /api/inventory/transfers/:id/reject - Reject Stock Transfer
exports.rejectTransfer = async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        const transfer = await StockTransfer.findById(req.params.id);
        if (!transfer) {
            return res.status(404).json({ message: 'Stock Transfer not found' });
        }

        if (['DISPATCHED', 'Dispatched', 'COMPLETED', 'Completed'].includes(transfer.status)) {
            return res.status(400).json({ message: 'Cannot reject transfer after it has been dispatched or completed' });
        }

        transfer.status = 'REJECTED';
        transfer.rejectionReason = rejectionReason || 'Transfer request rejected by manager';
        await transfer.save();

        res.status(200).json({ message: 'Stock Transfer rejected', transfer });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting stock transfer', error: error.message });
    }
};
