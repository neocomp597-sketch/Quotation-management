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
        const filter = { companyId: req.user?.companyId };
        if (req.query.customerId) filter.customerId = req.query.customerId;
        if (req.query.productId) filter.productId = req.query.productId;
        const docs = await Asset.find(filter)
            .populate('customerId', 'customerName companyName')
            .populate('productId', 'productName productCode')
            .sort({ createdAt: -1 })
            .lean();
        res.json(docs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAssetSummary = async (req, res) => {
    try {
        const { assetId, serialNumber } = req.query;
        const companyId = req.user?.companyId;

        const Ticket = require('../models/Ticket');
        const ServiceVisit = require('../models/ServiceVisit');

        const query = { companyId };
        if (assetId) {
            query._id = assetId;
        } else if (serialNumber) {
            query.serialNumber = serialNumber;
        } else {
            return res.status(400).json({ message: 'assetId or serialNumber is required' });
        }

        const asset = await Asset.findOne(query)
            .populate('customerId', 'customerName companyName gstin billingAddress mobile email')
            .populate('productId', 'productName productCode basePrice mrp catalogType')
            .lean();

        if (!asset) {
            return res.status(404).json({ message: 'Asset not found' });
        }

        const now = new Date();
        
        // 1. Warranty Coverage
        let warranty = null;
        if (asset.customerId) {
            warranty = await Warranty.findOne({
                customerId: asset.customerId._id,
                productId: asset.productId._id,
                serialNumber: asset.serialNumber,
                companyId
            }).lean();
        }

        if (!warranty && asset.warrantyEnd) {
            warranty = {
                status: new Date(asset.warrantyEnd) > now ? 'Active' : 'Expired',
                expiryDate: asset.warrantyEnd,
                startDate: asset.warrantyStart
            };
        }

        // 2. AMC Coverage
        let amc = null;
        if (asset.customerId) {
            amc = await AMC.findOne({
                customerId: asset.customerId._id,
                status: 'Active',
                companyId,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean();
        }

        // 3. Ticket counts for this asset
        const openTicketsCount = await Ticket.countDocuments({
            assetId: asset._id,
            status: { $in: ['Open', 'Assigned', 'In Progress', 'Pending Customer', 'Escalated'] },
            companyId
        });

        const closedTicketsCount = await Ticket.countDocuments({
            assetId: asset._id,
            status: { $in: ['Resolved', 'Closed'] },
            companyId
        });

        // 4. Last Service Date (derived from recent completed visit)
        const tickets = await Ticket.find({ assetId: asset._id, companyId }).select('_id').lean();
        const ticketIds = tickets.map(t => t._id);
        
        let lastServiceDate = null;
        if (ticketIds.length > 0) {
            const lastVisit = await ServiceVisit.findOne({
                ticketId: { $in: ticketIds },
                status: 'Completed',
                companyId
            })
            .sort({ scheduledDate: -1 })
            .select('scheduledDate')
            .lean();
            if (lastVisit) {
                lastServiceDate = lastVisit.scheduledDate;
            }
        }

        res.json({
            asset,
            warranty,
            amc,
            lastServiceDate,
            ticketCounts: {
                open: openTicketsCount,
                closed: closedTicketsCount
            }
        });
    } catch (error) {
        console.error('getAssetSummary error:', error);
        res.status(500).json({ message: error.message || 'Error fetching asset summary' });
    }
};

