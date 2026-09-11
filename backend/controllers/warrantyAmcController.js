const Warranty = require('../models/Warranty');
const AMC = require('../models/AMC');
const Asset = require('../models/Asset');
const AssetHistory = require('../models/AssetHistory');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const RolePermission = require('../models/RolePermission');

// Utility for regex matching
const buildExactRegex = (str) => {
    if (!str) return null;
    const clean = String(str).trim();
    const escaped = clean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(`^${escaped}$`, 'i');
};

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
                await Warranty.findByIdAndUpdate(activeWarranty._id, { status: 'Expired' });
            }
        }

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

// Single Entry Creation (Requirement #15, #3, #4, #8, #17)
exports.createSingleAsset = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const {
            serialNumber,
            productCode,
            productName,
            status = 'IN_STOCK',
            customerCode = '',
            customer: customerInput,
            customerMobile = '',
            customerPhone = '',
            mobileNumber = '',
            invoiceNumber = '',
            saleDate,
            location = '',
            mgr1 = '',
            mgr2 = '',
            mgr3 = '',
            mgr4 = '',
            mgr5 = '',
            indicatorField = ''
        } = req.body;

        if (!serialNumber || !String(serialNumber).trim()) {
            return res.status(400).json({ message: 'Serial Number is required' });
        }
        if (!productCode || !String(productCode).trim()) {
            return res.status(400).json({ message: 'Product Code is required' });
        }
        const rawMobile = customerMobile || customerPhone || mobileNumber || '';
        const cleanMobile = String(rawMobile).trim();
        if (!cleanMobile) {
            return res.status(400).json({ message: 'Mobile Number is mandatory' });
        }

        const cleanSN = String(serialNumber).trim();
        const cleanProductCode = String(productCode).trim();
        const cleanIndicator = String(indicatorField || '').trim().slice(0, 20);

        // Resolve product
        let product = await Product.findOne({
            companyId,
            productCode: buildExactRegex(cleanProductCode)
        })
        .populate('mgr1', 'code description')
        .populate('mgr2', 'code description')
        .populate('mgr3', 'code description')
        .populate('mgr4', 'code description')
        .populate('mgr5', 'code description');

        if (!product && productName) {
            product = await Product.findOne({
                companyId,
                productName: buildExactRegex(productName)
            })
            .populate('mgr1', 'code description')
            .populate('mgr2', 'code description')
            .populate('mgr3', 'code description')
            .populate('mgr4', 'code description')
            .populate('mgr5', 'code description');
        }

        if (!product) {
            product = await Product.create({
                companyId,
                productCode: cleanProductCode,
                productName: productName || cleanProductCode,
                hsnCode: 'N/A',
                gstPercentage: 18,
                basePrice: 0,
                mrp: 0,
                uom: 'Nos',
                status: 'Active'
            });
        }

        const formatMgrVal = (mgr) => {
            if (!mgr) return '';
            if (typeof mgr === 'string') return mgr;
            if (mgr.code && mgr.description && mgr.code.toLowerCase() !== mgr.description.toLowerCase()) {
                return `${mgr.code} - ${mgr.description}`;
            }
            return mgr.description || mgr.code || '';
        };

        // Auto-fill Mgr 1 to Mgr 5 from Product Master if not explicitly provided
        const finalMgr1 = mgr1 || (product ? formatMgrVal(product.mgr1) : '');
        const finalMgr2 = mgr2 || (product ? formatMgrVal(product.mgr2) : '');
        const finalMgr3 = mgr3 || (product ? formatMgrVal(product.mgr3) : '');
        const finalMgr4 = mgr4 || (product ? formatMgrVal(product.mgr4) : '');
        const finalMgr5 = mgr5 || (product ? formatMgrVal(product.mgr5) : '');

        // Resolve customer from Customer Master using Customer Code or Customer Name
        let customer = null;
        let finalCustomerCode = String(customerCode || '').trim();
        let finalCustomerPostalCode = '';
        const searchTarget = finalCustomerCode || (customerInput ? String(customerInput).trim() : '');

        if (searchTarget) {
            customer = await Customer.findOne({
                companyId,
                $or: [
                    { externalCode: buildExactRegex(searchTarget) },
                    { customerName: buildExactRegex(searchTarget) },
                    { companyName: buildExactRegex(searchTarget) }
                ]
            });

            if (!customer) {
                customer = await Customer.create({
                    companyId,
                    externalCode: searchTarget,
                    customerName: customerInput || searchTarget,
                    companyName: customerInput || searchTarget,
                    mobile: cleanMobile,
                    createdBy: req.user?.id || null
                });
            } else if (cleanMobile && !customer.mobile) {
                customer.mobile = cleanMobile;
                await customer.save();
            }

            if (customer) {
                finalCustomerCode = customer.externalCode || searchTarget;
                // Postal Code is strictly derived from Customer Master
                finalCustomerPostalCode = customer.billingAddress?.pincode || customer.pincode || '';
            }
        }

        // Unique Identifier Check: Product Code + Serial No + Indicator_Field
        const existingAssets = await Asset.find({
            companyId,
            serialNumber: buildExactRegex(cleanSN)
        }).populate('productId');

        const isProductMatch = (a) => {
            if (!a.productId) return false;
            const sameId = a.productId._id && product._id && a.productId._id.toString() === product._id.toString();
            const prodCodeA = (a.productId.productCode || '').trim().toLowerCase();
            const prodCodeTarget = (product.productCode || cleanProductCode).trim().toLowerCase();
            return sameId || prodCodeA === prodCodeTarget || prodCodeA === cleanProductCode.toLowerCase();
        };

        const isIndicatorMatch = (a) => {
            return (a.indicatorField || '').trim().toLowerCase() === cleanIndicator.toLowerCase();
        };

        // 1. Search for active asset match
        let matchedActiveAsset = existingAssets.find(a => {
            const isReturn = a.status === 'RETURN' || a.status === 'RETURNED';
            return !isReturn && isProductMatch(a) && isIndicatorMatch(a);
        });

        if (!matchedActiveAsset) {
            matchedActiveAsset = existingAssets.find(a => {
                const isReturn = a.status === 'RETURN' || a.status === 'RETURNED';
                return !isReturn && isIndicatorMatch(a);
            });
        }

        if (matchedActiveAsset) {
            return res.status(400).json({
                message: `Duplicate entry: Serial Number (${cleanSN}) already exists in active inventory. Duplicate entry cannot be created.`
            });
        }

        // 2. Search for returned asset match (to re-activate)
        const matchedReturnedAsset = existingAssets.find(a => {
            const isReturn = a.status === 'RETURN' || a.status === 'RETURNED';
            return isReturn && isProductMatch(a) && isIndicatorMatch(a);
        });

        if (matchedReturnedAsset) {
            const updatePayload = {
                productId: product._id,
                status: status === 'RETURN' ? 'SOLD' : status,
                customerId: customer ? customer._id : null,
                customerCode: finalCustomerCode,
                customerNameStr: customer ? (customer.companyName || customer.customerName) : (customerInput || ''),
                customerPostalCode: finalCustomerPostalCode,
                customerMobile: cleanMobile,
                invoiceNumber,
                saleDate: saleDate ? new Date(saleDate) : (status === 'SOLD' ? new Date() : null),
                location,
                mgr1: finalMgr1,
                mgr2: finalMgr2,
                mgr3: finalMgr3,
                mgr4: finalMgr4,
                mgr5: finalMgr5,
                indicatorField: cleanIndicator,
                returnReason: '',
                returnedAt: null
            };

            await Asset.findByIdAndUpdate(matchedReturnedAsset._id, updatePayload);

            await AssetHistory.create({
                companyId,
                assetId: matchedReturnedAsset._id,
                serialNumber: cleanSN,
                productCode: product.productCode,
                productName: product.productName,
                productId: product._id,
                customerId: customer ? customer._id : null,
                customerCode: finalCustomerCode,
                customerName: customer ? (customer.companyName || customer.customerName) : (customerInput || ''),
                customerPostalCode: finalCustomerPostalCode,
                customerMobile: cleanMobile,
                invoiceNumber,
                saleDate: saleDate ? new Date(saleDate) : (status === 'SOLD' ? new Date() : null),
                location,
                mgr1: finalMgr1,
                mgr2: finalMgr2,
                mgr3: finalMgr3,
                mgr4: finalMgr4,
                mgr5: finalMgr5,
                indicatorField: cleanIndicator,
                transactionType: 'SINGLE_ENTRY_RESELL',
                status: status === 'RETURN' ? 'SOLD' : status,
                createdBy: req.user?.id || null
            });

            const updatedDoc = await Asset.findById(matchedReturnedAsset._id).populate('customerId').populate('productId');
            return res.status(200).json({
                message: 'Serial asset entry updated successfully (Re-use of returned serial)',
                data: updatedDoc
            });
        }

        // Case 1 / Case 3: Create new asset entry
        const newAsset = await Asset.create({
            companyId,
            productId: product._id,
            serialNumber: cleanSN,
            status,
            customerId: customer ? customer._id : null,
            customerCode: finalCustomerCode,
            customerNameStr: customer ? (customer.companyName || customer.customerName) : (customerInput || ''),
            customerPostalCode: finalCustomerPostalCode,
            customerMobile: cleanMobile,
            invoiceNumber,
            saleDate: saleDate ? new Date(saleDate) : (status === 'SOLD' ? new Date() : null),
            location,
            mgr1: finalMgr1,
            mgr2: finalMgr2,
            mgr3: finalMgr3,
            mgr4: finalMgr4,
            mgr5: finalMgr5,
            indicatorField: cleanIndicator,
            createdBy: req.user?.id || null
        });

        await AssetHistory.create({
            companyId,
            assetId: newAsset._id,
            serialNumber: cleanSN,
            productCode: product.productCode,
            productName: product.productName,
            productId: product._id,
            customerId: customer ? customer._id : null,
            customerCode: finalCustomerCode,
            customerName: customer ? (customer.companyName || customer.customerName) : (customerInput || ''),
            customerPostalCode: finalCustomerPostalCode,
            customerMobile: cleanMobile,
            invoiceNumber,
            saleDate: saleDate ? new Date(saleDate) : (status === 'SOLD' ? new Date() : null),
            location,
            mgr1: finalMgr1,
            mgr2: finalMgr2,
            mgr3: finalMgr3,
            mgr4: finalMgr4,
            mgr5: finalMgr5,
            indicatorField: cleanIndicator,
            transactionType: 'SINGLE_ENTRY',
            status,
            createdBy: req.user?.id || null
        });

        const createdDoc = await Asset.findById(newAsset._id).populate('customerId').populate('productId');
        res.status(201).json({ message: 'Single entry added successfully', data: createdDoc });
    } catch (error) {
        console.error('createSingleAsset error:', error);
        res.status(500).json({ message: error.message || 'Error creating single entry' });
    }
};

// Process Sales Return (Requirement #6, #7, #8)
exports.returnAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { returnReason } = req.body;
        const companyId = req.user?.companyId;

        if (!returnReason || !String(returnReason).trim()) {
            return res.status(400).json({ message: 'Return reason is required' });
        }

        const asset = await Asset.findOne({ _id: id, companyId }).populate('productId').populate('customerId');
        if (!asset) {
            return res.status(404).json({ message: 'Asset entry not found' });
        }

        const now = new Date();
        const cleanReason = String(returnReason).trim();

        // Update active asset status to RETURN
        asset.status = 'RETURN';
        asset.returnReason = cleanReason;
        asset.returnedAt = now;
        await asset.save();

        // Create transaction history record for RETURN
        await AssetHistory.create({
            companyId,
            assetId: asset._id,
            serialNumber: asset.serialNumber,
            productCode: asset.productId?.productCode || '',
            productName: asset.productId?.productName || '',
            productId: asset.productId?._id,
            customerId: asset.customerId?._id,
            customerName: asset.customerId?.companyName || asset.customerId?.customerName || asset.customerNameStr || '',
            customerPostalCode: asset.customerPostalCode || '',
            invoiceNumber: asset.invoiceNumber || '',
            saleDate: asset.saleDate || asset.invoiceDate || null,
            returnDate: now,
            returnReason: cleanReason,
            location: asset.location || '',
            mgr1: asset.mgr1 || '',
            mgr2: asset.mgr2 || '',
            mgr3: asset.mgr3 || '',
            mgr4: asset.mgr4 || '',
            mgr5: asset.mgr5 || '',
            indicatorField: asset.indicatorField || '',
            transactionType: 'RETURN',
            status: 'RETURN',
            createdBy: req.user?.id || null
        });

        res.json({ message: 'Sales return processed successfully', data: asset });
    } catch (error) {
        console.error('returnAsset error:', error);
        res.status(500).json({ message: error.message || 'Error processing sales return' });
    }
};

// Return History List (Requirement #9)
exports.getReturnHistory = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const historyDocs = await AssetHistory.find({
            companyId,
            $or: [
                { transactionType: 'RETURN' },
                { status: 'RETURN' },
                { status: 'RETURNED' }
            ]
        })
        .populate('customerId', 'customerName companyName')
        .populate('productId', 'productName productCode')
        .sort({ returnDate: -1, createdAt: -1 })
        .lean();

        res.json(historyDocs);
    } catch (error) {
        console.error('getReturnHistory error:', error);
        res.status(500).json({ message: error.message || 'Error fetching return history' });
    }
};

// Delete Entry (Requirement #11, #12)
exports.deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user?.companyId;
        const user = req.user;

        let isAuthorized = false;
        if (user.role === 'admin' || user.role === 'superadmin' || user.isSuperAdmin) {
            isAuthorized = true;
        } else {
            const rolePerm = await RolePermission.findOne({ role: user.role, companyId }).lean();
            if (rolePerm && (rolePerm.menuVisibility?.invoice_bulk_upload_delete || rolePerm.menuVisibility?.master_serials_delete)) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Permission denied: Only Company Admin or users with Delete Invoice Bulk Upload Entry permission can delete entries.' });
        }

        const asset = await Asset.findOneAndDelete({ _id: id, companyId });
        if (!asset) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        res.json({ message: 'Invoice Bulk Upload entry deleted successfully' });
    } catch (error) {
        console.error('deleteAsset error:', error);
        res.status(500).json({ message: error.message || 'Error deleting entry' });
    }
};

// List Assets with Customer Name search support (Requirement #10)
exports.getAssets = async (req, res) => {
    try {
        const filter = { companyId: req.user?.companyId };
        if (req.query.customerId) filter.customerId = req.query.customerId;
        if (req.query.productId) filter.productId = req.query.productId;

        const docs = await Asset.find(filter)
            .populate('customerId', 'customerName companyName externalCode billingAddress pincode mobile')
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

        let asset = null;
        if (assetId) {
            asset = await Asset.findOne({ _id: assetId, companyId })
                .populate('customerId', 'customerName companyName gstin billingAddress mobile email')
                .populate('productId', 'productName productCode basePrice mrp catalogType')
                .populate('invoiceId', 'voucherNumber date')
                .lean();
        } else if (serialNumber) {
            const cleanSN = String(serialNumber).trim();
            const escapedSN = cleanSN.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const matches = await Asset.find({
                companyId,
                serialNumber: { $regex: new RegExp("^" + escapedSN + "$", "i") }
            })
            .populate('customerId', 'customerName companyName gstin billingAddress mobile email')
            .populate('productId', 'productName productCode basePrice mrp catalogType')
            .populate('invoiceId', 'voucherNumber date')
            .lean();

            if (matches.length > 0) {
                const statusPriority = { 'SOLD': 1, 'ALLOCATED': 2, 'RETURNED': 3, 'RETURN': 3, 'IN_STOCK': 4, 'SCRAPPED': 5 };
                matches.sort((a, b) => {
                    const pA = statusPriority[a.status] || (a.customerId ? 1 : 4);
                    const pB = statusPriority[b.status] || (b.customerId ? 1 : 4);
                    if (pA !== pB) return pA - pB;
                    if (a.customerId && !b.customerId) return -1;
                    if (!a.customerId && b.customerId) return 1;
                    return 0;
                });
                asset = matches[0];
            } else {
                // FALLBACK: Search AssetHistory (Transaction Data) if not found in Asset Master
                const historyDoc = await AssetHistory.findOne({
                    companyId,
                    serialNumber: { $regex: new RegExp("^" + escapedSN + "$", "i") }
                })
                .sort({ createdAt: -1 })
                .populate('customerId', 'customerName companyName gstin billingAddress mobile email')
                .populate('productId', 'productName productCode basePrice mrp catalogType')
                .lean();

                if (historyDoc) {
                    asset = {
                        _id: historyDoc.assetId || historyDoc._id,
                        serialNumber: historyDoc.serialNumber,
                        productId: historyDoc.productId || { productName: historyDoc.productName, productCode: historyDoc.productCode },
                        productName: historyDoc.productName || historyDoc.productId?.productName || '',
                        productCode: historyDoc.productCode || historyDoc.productId?.productCode || '',
                        customerId: historyDoc.customerId || (historyDoc.customerName ? { customerName: historyDoc.customerName, companyName: historyDoc.customerName } : null),
                        customerNameStr: historyDoc.customerName || '',
                        customerPostalCode: historyDoc.customerPostalCode || '',
                        invoiceNumber: historyDoc.invoiceNumber || '',
                        saleDate: historyDoc.saleDate || historyDoc.createdAt,
                        status: historyDoc.transactionType || 'HISTORICAL',
                        location: historyDoc.location || ''
                    };
                }
            }
        } else {
            return res.status(400).json({ message: 'assetId or serialNumber is required' });
        }

        if (!asset) {
            return res.status(404).json({ message: 'Asset not found' });
        }

        const now = new Date();
        
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

        // Fetch transaction history
        const history = await AssetHistory.find({
            companyId,
            serialNumber: buildExactRegex(asset.serialNumber)
        }).sort({ createdAt: -1 }).lean();

        res.json({
            asset,
            warranty,
            amc,
            lastServiceDate,
            history,
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

// Search Serial Numbers for Complaint Registration & Customer Service (Requirement: Invoice Bulk Upload source of truth)
exports.searchSerialNumbers = async (req, res) => {
    try {
        const { q } = req.query;
        const companyId = req.user?.companyId;

        if (!q || !String(q).trim()) {
            return res.json([]);
        }

        const queryStr = String(q).trim();
        const escapedQuery = queryStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

        // Search ALL registered assets in Invoice Bulk Upload for this company
        const assets = await Asset.find({
            companyId,
            serialNumber: { $regex: escapedQuery, $options: 'i' }
        })
        .sort({ createdAt: -1, serialNumber: 1 })
        .limit(100)
        .populate('customerId', 'customerName companyName billingAddress mobile email gstin')
        .populate('productId', 'productName productCode basePrice mrp')
        .populate('invoiceId', 'voucherNumber date')
        .lean();

        // Also search transaction history for historical serials registered in Invoice Bulk Upload
        const historyDocs = await AssetHistory.find({
            companyId,
            serialNumber: { $regex: escapedQuery, $options: 'i' }
        })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('customerId', 'customerName companyName billingAddress mobile email gstin')
        .populate('productId', 'productName productCode basePrice mrp')
        .lean();

        const combinedResults = [];
        const seenSerials = new Set();

        // Add active assets from Invoice Bulk Upload
        for (const a of assets) {
            const snKey = `${(a.serialNumber || '').trim().toLowerCase()}-${a.productId?.productCode || ''}`;
            seenSerials.add(snKey);
            combinedResults.push({
                _id: a._id,
                serialNumber: a.serialNumber,
                productId: a.productId,
                productCode: a.productId?.productCode || a.productCode || '',
                productName: a.productId?.productName || a.productName || '',
                customerId: a.customerId,
                customerName: a.customerId?.companyName || a.customerId?.customerName || a.customerNameStr || '',
                customerPostalCode: a.customerPostalCode || '',
                customerMobile: a.customerMobile || a.customerId?.mobile || '',
                invoiceNumber: a.invoiceNumber || (a.invoiceId?.voucherNumber || ''),
                saleDate: a.saleDate || a.invoiceDate || null,
                status: a.status || 'IN_STOCK',
                location: a.location || '',
                mgr1: a.mgr1 || '',
                mgr2: a.mgr2 || '',
                mgr3: a.mgr3 || '',
                mgr4: a.mgr4 || '',
                mgr5: a.mgr5 || '',
                indicatorField: a.indicatorField || ''
            });
        }

        // Add historical records if not already in active list
        for (const h of historyDocs) {
            const snKey = `${(h.serialNumber || '').trim().toLowerCase()}-${h.productCode || ''}`;
            if (!seenSerials.has(snKey)) {
                seenSerials.add(snKey);
                combinedResults.push({
                    _id: h.assetId || h._id,
                    serialNumber: h.serialNumber,
                    productId: h.productId || { productName: h.productName, productCode: h.productCode },
                    productCode: h.productCode || '',
                    productName: h.productName || '',
                    customerId: h.customerId || (h.customerName ? { customerName: h.customerName, companyName: h.customerName } : null),
                    customerName: h.customerName || '',
                    customerPostalCode: h.customerPostalCode || '',
                    customerMobile: h.customerMobile || h.customerId?.mobile || '',
                    invoiceNumber: h.invoiceNumber || '',
                    saleDate: h.saleDate || null,
                    status: h.status || 'HISTORICAL',
                    location: h.location || '',
                    mgr1: h.mgr1 || '',
                    mgr2: h.mgr2 || '',
                    mgr3: h.mgr3 || '',
                    mgr4: h.mgr4 || '',
                    mgr5: h.mgr5 || '',
                    indicatorField: h.indicatorField || ''
                });
            }
        }

        res.json(combinedResults.slice(0, 30));
    } catch (error) {
        console.error('searchSerialNumbers error:', error);
        res.status(500).json({ message: error.message || 'Error searching serial numbers' });
    }
};
