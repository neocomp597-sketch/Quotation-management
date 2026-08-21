const Warehouse = require('../models/Warehouse');
const StockLedger = require('../models/StockLedger');

// Get all warehouses for the company
exports.getWarehouses = async (req, res) => {
    try {
        const { search, type, isActive, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        if (type) {
            filter.type = type;
        }

        if (search) {
            filter.$or = [
                { warehouseCode: { $regex: search, $options: 'i' } },
                { warehouseName: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [warehouses, total] = await Promise.all([
            Warehouse.find(filter)
                .populate('managerId', 'name email')
                .sort({ isDefault: -1, createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Warehouse.countDocuments(filter)
        ]);

        res.status(200).json({
            warehouses,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching warehouses', error: error.message });
    }
};

// Get single warehouse by ID
exports.getWarehouseById = async (req, res) => {
    try {
        const warehouse = await Warehouse.findById(req.params.id)
            .populate('managerId', 'name email')
            .lean();

        if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse not found' });
        }

        res.status(200).json(warehouse);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching warehouse details', error: error.message });
    }
};

// Create a new warehouse
exports.createWarehouse = async (req, res) => {
    try {
        const { warehouseCode, warehouseName, type, address, managerId, bins, isDefault } = req.body;

        if (!warehouseCode || !warehouseName) {
            return res.status(400).json({ message: 'Warehouse Code and Name are required' });
        }

        const codeTrimmed = String(warehouseCode).trim().toUpperCase();

        // Prevent duplicate warehouseCode per company
        const existing = await Warehouse.findOne({
            companyId: req.user?.companyId,
            warehouseCode: codeTrimmed
        }).lean();

        if (existing) {
            return res.status(400).json({ message: `Warehouse code '${codeTrimmed}' already exists` });
        }

        // If setting as default, clear previous default
        if (isDefault) {
            await Warehouse.updateMany(
                { companyId: req.user?.companyId, isDefault: true },
                { $set: { isDefault: false } }
            );
        }

        const warehouse = new Warehouse({
            companyId: req.user?.companyId,
            warehouseCode: codeTrimmed,
            warehouseName: String(warehouseName).trim(),
            type: type || 'Main Warehouse',
            address: address || {},
            managerId: managerId || null,
            bins: bins || [],
            isDefault: Boolean(isDefault),
            isActive: true
        });

        await warehouse.save();
        res.status(201).json({ message: 'Warehouse created successfully', warehouse });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Warehouse code already exists' });
        }
        res.status(500).json({ message: 'Error creating warehouse', error: error.message });
    }
};

// Update warehouse
exports.updateWarehouse = async (req, res) => {
    try {
        const { warehouseCode, warehouseName, type, address, managerId, bins, isDefault, isActive } = req.body;

        const warehouse = await Warehouse.findById(req.params.id);
        if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse not found' });
        }

        if (warehouseCode) {
            const codeTrimmed = String(warehouseCode).trim().toUpperCase();
            if (codeTrimmed !== warehouse.warehouseCode) {
                const existing = await Warehouse.findOne({
                    companyId: req.user?.companyId,
                    warehouseCode: codeTrimmed,
                    _id: { $ne: req.params.id }
                }).lean();
                if (existing) {
                    return res.status(400).json({ message: `Warehouse code '${codeTrimmed}' already exists` });
                }
                warehouse.warehouseCode = codeTrimmed;
            }
        }

        if (isDefault && !warehouse.isDefault) {
            await Warehouse.updateMany(
                { companyId: req.user?.companyId, isDefault: true, _id: { $ne: req.params.id } },
                { $set: { isDefault: false } }
            );
            warehouse.isDefault = true;
        }

        if (warehouseName) warehouse.warehouseName = String(warehouseName).trim();
        if (type) warehouse.type = type;
        if (address) warehouse.address = address;
        if (managerId !== undefined) warehouse.managerId = managerId || null;
        if (bins) warehouse.bins = bins;
        if (isActive !== undefined) warehouse.isActive = Boolean(isActive);

        await warehouse.save();
        res.status(200).json({ message: 'Warehouse updated successfully', warehouse });
    } catch (error) {
        res.status(500).json({ message: 'Error updating warehouse', error: error.message });
    }
};

// Delete warehouse (Soft delete if history exists)
exports.deleteWarehouse = async (req, res) => {
    try {
        const warehouseId = req.params.id;

        const warehouse = await Warehouse.findById(warehouseId);
        if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse not found' });
        }

        // Check if warehouse has stock ledger transactions
        const hasLedger = await StockLedger.exists({
            companyId: req.user?.companyId,
            warehouseId
        });

        if (hasLedger) {
            // Soft delete: set isActive to false
            warehouse.isActive = false;
            await warehouse.save();
            return res.status(200).json({
                message: 'Warehouse contains stock transaction history. Marked as Inactive instead of deleting.',
                softDeleted: true
            });
        }

        // Physical delete if no transaction history exists
        await Warehouse.findByIdAndDelete(warehouseId);
        res.status(200).json({ message: 'Warehouse deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting warehouse', error: error.message });
    }
};
