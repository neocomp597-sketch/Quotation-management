const StockAlert = require('../models/StockAlert');

// GET /api/inventory/alerts - List active/all stock alerts
exports.getAlerts = async (req, res) => {
    try {
        const { isResolved = 'false', alertType, severity, page = 1, limit = 50 } = req.query;
        const filter = {};

        if (isResolved !== undefined) {
            filter.isResolved = isResolved === 'true';
        }

        if (alertType) filter.alertType = alertType;
        if (severity) filter.severity = severity;

        const skip = (Number(page) - 1) * Number(limit);

        const [alerts, total] = await Promise.all([
            StockAlert.find(filter)
                .populate('productId', 'productCode productName uom minStock maxStock')
                .populate('warehouseId', 'warehouseCode warehouseName')
                .populate('resolvedBy', 'name email')
                .sort({ severity: 1, createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            StockAlert.countDocuments(filter)
        ]);

        res.status(200).json({
            alerts,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stock alerts', error: error.message });
    }
};

// POST /api/inventory/alerts/:id/resolve - Mark alert as resolved
exports.resolveAlert = async (req, res) => {
    try {
        const alert = await StockAlert.findById(req.params.id);
        if (!alert) {
            return res.status(404).json({ message: 'Stock alert not found' });
        }

        alert.isResolved = true;
        alert.resolvedAt = new Date();
        alert.resolvedBy = req.user?.id;
        await alert.save();

        res.status(200).json({ message: 'Alert resolved successfully', alert });
    } catch (error) {
        res.status(500).json({ message: 'Error resolving alert', error: error.message });
    }
};
