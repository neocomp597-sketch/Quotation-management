const Warranty = require('../models/Warranty');
const AMC = require('../models/AMC');
const Asset = require('../models/Asset');

// Warranty CRUD
exports.createWarranty = async (req, res) => {
    try {
        const doc = await Warranty.create({ ...req.body, companyId: req.user?.companyId });
        res.status(201).json(doc);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getWarranties = async (req, res) => {
    try {
        const docs = await Warranty.find({ companyId: req.user?.companyId })
            .populate('customerId', 'customerName companyName')
            .populate('productId', 'productName productCode')
            .populate('assetId')
            .sort({ createdAt: -1 })
            .lean();
        res.json(docs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// AMC CRUD
exports.createAmc = async (req, res) => {
    try {
        const doc = await AMC.create({ ...req.body, companyId: req.user?.companyId });
        res.status(201).json(doc);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getAmcs = async (req, res) => {
    try {
        const docs = await AMC.find({ companyId: req.user?.companyId })
            .populate('customerId', 'customerName companyName')
            .sort({ createdAt: -1 })
            .lean();
        res.json(docs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Entitlement Verification
exports.verifyEntitlements = async (req, res) => {
    try {
        const { customerId, productId, assetId } = req.query;
        const companyId = req.user?.companyId;

        if (!customerId) {
            return res.status(400).json({ message: 'customerId is required' });
        }

        const now = new Date();
        const verification = {
            warranty: { isActive: false, expiryDate: null },
            amc: { isActive: false, contractNo: null, remainingVisits: 0 },
            recommendedBillingType: 'Paid'
        };

        // 1. Check active warranties
        const warrantyFilter = { customerId, status: 'Active', companyId };
        if (productId) warrantyFilter.productId = productId;
        if (assetId) warrantyFilter.assetId = assetId;

        const activeWarranty = await Warranty.findOne(warrantyFilter)
            .populate('productId', 'productName')
            .lean();

        if (activeWarranty) {
            if (activeWarranty.expiryDate > now) {
                verification.warranty.isActive = true;
                verification.warranty.expiryDate = activeWarranty.expiryDate;
                verification.recommendedBillingType = 'Under Warranty';
            } else {
                // Auto expire if past expiry date
                await Warranty.findByIdAndUpdate(activeWarranty._id, { status: 'Expired' });
            }
        }

        // 2. Check active AMC (if warranty is not active)
        if (!verification.warranty.isActive) {
            const activeAmc = await AMC.findOne({
                customerId,
                status: 'Active',
                companyId,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean();

            if (activeAmc) {
                const remainingVisits = activeAmc.visitsAllowed - activeAmc.visitsUsed;
                if (remainingVisits > 0) {
                    verification.amc.isActive = true;
                    verification.amc.contractNo = activeAmc.contractNo;
                    verification.amc.remainingVisits = remainingVisits;
                    verification.recommendedBillingType = 'Under AMC';
                } else {
                    // Auto expire if visits depleted
                    await AMC.findByIdAndUpdate(activeAmc._id, { status: 'Expired' });
                }
            }
        }

        res.json(verification);
    } catch (error) {
        console.error('Verify entitlements error:', error);
        res.status(500).json({ message: error.message || 'Error verifying entitlements' });
    }
};

// Asset CRUD
exports.createAsset = async (req, res) => {
    try {
        const doc = await Asset.create({ ...req.body, companyId: req.user?.companyId });
        res.status(201).json(doc);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getAssets = async (req, res) => {
    try {
        const docs = await Asset.find({ companyId: req.user?.companyId })
            .populate('customerId', 'customerName companyName')
            .populate('productId', 'productName productCode')
            .sort({ createdAt: -1 })
            .lean();
        res.json(docs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
