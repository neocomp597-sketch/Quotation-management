const Warranty = require('../models/Warranty');
const AMC = require('../models/AMC');
const Asset = require('../models/Asset');
const AssetHistory = require('../models/AssetHistory');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const RolePermission = require('../models/RolePermission');
const mongoose = require('mongoose');
const { productMgrPopulate, applyProductMgrs, applyProductMgrsToAll, stripMgrFields } = require('../utils/productMgr');
const { loadDivisionSegmentLookup, resolveDivisionSegment } = require('../utils/divisionSegment');

// Division / Segment of an Invoice Bulk Upload record, shown as code + description.
const DIVISION_POPULATE = { path: 'divisionId', select: 'code description status' };
const SEGMENT_POPULATE = { path: 'segmentId', select: 'code description status divisionId' };

// Utility for regex matching
const buildExactRegex = (str) => {
    if (!str) return null;
    const clean = String(str).trim();
    const escaped = clean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(`^${escaped}$`, 'i');
};

const isValidObjectId = (id) => {
    if (!id) return false;
    const str = String(id);
    return mongoose.Types.ObjectId.isValid(str) && /^[0-9a-fA-F]{24}$/.test(str);
};

/**
 * Warranties and AMCs belong to the branch of their customer; when the customer has
 * none they belong to the branch the user is working in.
 */
const resolveEntitlementBranch = async (customerId, req) => {
    if (isValidObjectId(customerId)) {
        const customer = await Customer.findById(customerId).select('branchId').setOptions({ bypassTenant: true }).lean();
        if (customer?.branchId) return customer.branchId;
    }
    return req.user?.activeBranchId || null;
};

// Warranty CRUD
exports.createWarranty = async (req, res) => {
    try {
        const branchId = req.body.branchId || await resolveEntitlementBranch(req.body.customerId, req);
        const doc = await Warranty.create({ ...req.body, branchId, companyId: req.user?.companyId });
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
        const branchId = req.body.branchId || await resolveEntitlementBranch(req.body.customerId, req);
        const doc = await AMC.create({ ...req.body, branchId, companyId: req.user?.companyId });
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
        const { serialNumber } = req.body;
        if (serialNumber && String(serialNumber).trim()) {
            const cleanSN = String(serialNumber).trim();
            const existingAssets = await Asset.find({
                serialNumber: buildExactRegex(cleanSN)
            }).setOptions({ bypassTenant: true });

            const matchedActiveAsset = existingAssets.find(a => a.status !== 'RETURN' && a.status !== 'RETURNED');
            if (matchedActiveAsset) {
                return res.status(400).json({ message: `Duplicate entry: Serial Number (${cleanSN}) already exists in the system. Serial Numbers must be unique.` });
            }
        }
        const branchId = req.body.branchId || await resolveEntitlementBranch(req.body.customerId, req);
        const doc = await Asset.create({ ...stripMgrFields(req.body), branchId, companyId: req.user?.companyId });
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
            indicatorField = '',
            divisionId,
            segmentId
        } = req.body;

        if (!serialNumber || !String(serialNumber).trim()) {
            return res.status(400).json({ message: 'Serial Number is required' });
        }
        if (!productCode || !String(productCode).trim()) {
            return res.status(400).json({ message: 'Product Code is required' });
        }
        // Mobile is optional (the single entry form has no mobile field); a blank value is
        // filled from the Customer Master below when the customer has one.
        const rawMobile = customerMobile || customerPhone || mobileNumber || '';
        let cleanMobile = String(rawMobile).trim();

        // Division and Segment are mandatory on a single entry; the segment must belong to
        // the division.
        let divisionSegment;
        try {
            const lookup = await loadDivisionSegmentLookup(companyId);
            divisionSegment = resolveDivisionSegment(lookup, { divisionId, segmentId }, { required: true });
        } catch (err) {
            return res.status(err.statusCode || 400).json({ message: err.message });
        }
        const divisionSegmentFields = {
            divisionId: divisionSegment.division._id,
            segmentId: divisionSegment.segment._id
        };

        const cleanSN = String(serialNumber).trim();
        const cleanProductCode = String(productCode).trim();
        const cleanIndicator = String(indicatorField || '').trim().slice(0, 20);

        // Resolve product
        let product = await Product.findOne({
            companyId,
            productCode: buildExactRegex(cleanProductCode)
        });

        if (!product && productName) {
            product = await Product.findOne({
                companyId,
                productName: buildExactRegex(productName)
            });
        }

        if (!product && cleanProductCode) {
            product = await Product.findOne({ productCode: buildExactRegex(cleanProductCode) })
                .setOptions({ bypassTenant: true });
        }
        if (!product && productName) {
            product = await Product.findOne({ productName: buildExactRegex(productName) })
                .setOptions({ bypassTenant: true });
        }

        if (!product) {
            try {
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
            } catch (createErr) {
                product = await Product.findOne({ productCode: buildExactRegex(cleanProductCode) })
                    .setOptions({ bypassTenant: true });
                if (!product) {
                    throw createErr;
                }
            }
        }
        // MGR 1-5 are not stored on the asset: every read derives them from the Product Master.

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
                if (!cleanMobile && customer.mobile) cleanMobile = String(customer.mobile).trim();
                if (!customer.externalCode && finalCustomerCode) {
                    customer.externalCode = finalCustomerCode;
                    await customer.save();
                }
                finalCustomerCode = customer.externalCode || searchTarget;
                // Postal Code is strictly derived from Customer Master with 6-digit validation
                const rawPin = customer.billingAddress?.pincode || customer.pincode || '';
                const cleanPin = String(rawPin).trim().replace(/\D/g, '');
                finalCustomerPostalCode = cleanPin.length === 6 ? cleanPin : String(rawPin).trim();
            }
        }

        // Unique Identifier Check: Serial Number (System-wide uniqueness)
        let existingAssets = await Asset.find({
            companyId,
            serialNumber: buildExactRegex(cleanSN)
        }).populate('productId');

        if (!existingAssets || existingAssets.length === 0) {
            existingAssets = await Asset.find({
                serialNumber: buildExactRegex(cleanSN)
            }).setOptions({ bypassTenant: true }).populate('productId');
        }

        // 1. Search for active asset match (any active asset with this serial number)
        let matchedActiveAsset = existingAssets.find(a => a.status !== 'RETURN' && a.status !== 'RETURNED');

        if (matchedActiveAsset) {
            return res.status(400).json({
                message: `Duplicate entry: Serial Number (${cleanSN}) already exists in the system. Duplicate Serial Numbers are not allowed.`
            });
        }

        // 2. Search for returned asset match (to re-activate)
        const matchedReturnedAsset = existingAssets.find(a => a.status === 'RETURN' || a.status === 'RETURNED');

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
                indicatorField: cleanIndicator,
                ...divisionSegmentFields,
                returnReason: '',
                returnedAt: null,
                // A re-sold serial moves to the new customer's branch (else the active branch).
                branchId: customer?.branchId || matchedReturnedAsset.branchId || req.user?.activeBranchId || null
            };

            await Asset.findByIdAndUpdate(matchedReturnedAsset._id, updatePayload);

            await AssetHistory.create({
                companyId,
                branchId: updatePayload.branchId,
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
                indicatorField: cleanIndicator,
                transactionType: 'SINGLE_ENTRY_RESELL',
                status: status === 'RETURN' ? 'SOLD' : status,
                createdBy: req.user?.id || null
            });

            const updatedDoc = applyProductMgrs(
                await Asset.findById(matchedReturnedAsset._id).populate('customerId').populate(productMgrPopulate()).populate(DIVISION_POPULATE).populate(SEGMENT_POPULATE).lean()
            );
            return res.status(200).json({
                message: 'Serial asset entry updated successfully (Re-use of returned serial)',
                data: updatedDoc
            });
        }

        // Case 1 / Case 3: Create new asset entry
        const newAsset = await Asset.create({
            companyId,
            // An asset belongs to its customer's branch, else to the branch being worked in.
            branchId: customer?.branchId || req.user?.activeBranchId || null,
            productId: product._id,
            productCode: product.productCode || cleanProductCode || '',
            productName: product.productName || productName || cleanProductCode || '',
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
            indicatorField: cleanIndicator,
            ...divisionSegmentFields,
            createdBy: req.user?.id || null
        });

        await AssetHistory.create({
            companyId,
            branchId: newAsset.branchId || null,
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
            indicatorField: cleanIndicator,
            transactionType: 'SINGLE_ENTRY',
            status,
            createdBy: req.user?.id || null
        });

        const createdDoc = applyProductMgrs(
            await Asset.findById(newAsset._id).populate('customerId').populate(productMgrPopulate()).populate(DIVISION_POPULATE).populate(SEGMENT_POPULATE).lean()
        );
        res.status(201).json({ message: 'Single entry added successfully', data: createdDoc });
    } catch (error) {
        console.error('createSingleAsset error:', error);
        res.status(500).json({ message: error.message || 'Error creating single entry' });
    }
};

// Edit Single Entry: updates one Invoice Bulk Upload record in place.
exports.updateAsset = async (req, res) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid entry id' });
        }

        const asset = await Asset.findOne({ _id: id, companyId });
        if (!asset) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        const body = req.body || {};
        const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

        // Division / Segment stay mandatory, the segment must belong to the division.
        let divisionSegment;
        try {
            const lookup = await loadDivisionSegmentLookup(companyId);
            divisionSegment = resolveDivisionSegment(lookup, {
                divisionId: has('divisionId') ? body.divisionId : asset.divisionId,
                segmentId: has('segmentId') ? body.segmentId : asset.segmentId
            }, { required: true });
        } catch (err) {
            return res.status(err.statusCode || 400).json({ message: err.message });
        }

        const update = {
            divisionId: divisionSegment.division._id,
            segmentId: divisionSegment.segment._id
        };

        if (has('serialNumber')) {
            const cleanSN = String(body.serialNumber || '').trim();
            if (!cleanSN) return res.status(400).json({ message: 'Serial Number is required' });
            if (cleanSN.toLowerCase() !== String(asset.serialNumber || '').toLowerCase()) {
                const duplicate = await Asset.findOne({
                    _id: { $ne: asset._id },
                    serialNumber: buildExactRegex(cleanSN),
                    status: { $nin: ['RETURN', 'RETURNED'] }
                }).setOptions({ bypassTenant: true }).select('_id').lean();
                if (duplicate) {
                    return res.status(400).json({ message: `Duplicate entry: Serial Number (${cleanSN}) already exists in the system.` });
                }
            }
            update.serialNumber = cleanSN;
        }

        if (has('productCode')) {
            const cleanProductCode = String(body.productCode || '').trim();
            if (!cleanProductCode) return res.status(400).json({ message: 'Product Code is required' });
            let product = await Product.findOne({ companyId, productCode: buildExactRegex(cleanProductCode) });
            if (!product) {
                product = await Product.create({
                    companyId,
                    productCode: cleanProductCode,
                    productName: String(body.productName || '').trim() || cleanProductCode,
                    hsnCode: 'N/A',
                    gstPercentage: 18,
                    basePrice: 0,
                    mrp: 0,
                    uom: 'Nos',
                    status: 'Active'
                });
            }
            update.productId = product._id;
            update.productCode = product.productCode;
            update.productName = product.productName;
        }

        if (has('status')) {
            const allowed = Asset.schema.path('status').enumValues;
            if (!allowed.includes(body.status)) return res.status(400).json({ message: 'Invalid status' });
            update.status = body.status;
        }

        if (has('customer') || has('customerCode')) {
            const searchTarget = String(body.customerCode || body.customer || '').trim();
            if (!searchTarget) {
                Object.assign(update, { customerId: null, customerCode: '', customerNameStr: '', customerPostalCode: '' });
            } else {
                let customer = await Customer.findOne({
                    companyId,
                    $or: [
                        { externalCode: buildExactRegex(searchTarget) },
                        { customerName: buildExactRegex(searchTarget) },
                        { companyName: buildExactRegex(searchTarget) }
                    ]
                }).setOptions({ bypassBranch: true });
                if (!customer) {
                    customer = await Customer.create({
                        companyId,
                        externalCode: searchTarget,
                        customerName: String(body.customer || searchTarget).trim(),
                        companyName: String(body.customer || searchTarget).trim(),
                        createdBy: req.user?.id || null
                    });
                }
                const rawPin = customer.billingAddress?.pincode || customer.pincode || '';
                Object.assign(update, {
                    customerId: customer._id,
                    customerCode: customer.externalCode || searchTarget,
                    customerNameStr: customer.companyName || customer.customerName || searchTarget,
                    customerPostalCode: String(rawPin).trim(),
                    customerMobile: asset.customerMobile || customer.mobile || ''
                });
            }
        }

        if (has('invoiceNumber')) update.invoiceNumber = String(body.invoiceNumber || '').trim();
        if (has('saleDate')) update.saleDate = body.saleDate ? new Date(body.saleDate) : null;
        if (has('location')) update.location = String(body.location || '').trim();
        if (has('indicatorField')) update.indicatorField = String(body.indicatorField || '').trim().slice(0, 20);
        if (has('projectCode')) update.projectCode = String(body.projectCode || '').trim();
        if (has('projectName')) update.projectName = String(body.projectName || '').trim();

        await Asset.updateOne({ _id: asset._id }, { $set: update });

        const updatedDoc = applyProductMgrs(
            await Asset.findById(asset._id)
                .populate({ path: 'customerId', select: 'customerName companyName externalCode billingAddress pincode mobile', options: { bypassTenant: true } })
                .populate(productMgrPopulate())
                .populate(DIVISION_POPULATE)
                .populate(SEGMENT_POPULATE)
                .lean()
        );

        await AssetHistory.create({
            companyId,
            branchId: updatedDoc.branchId || null,
            assetId: updatedDoc._id,
            serialNumber: updatedDoc.serialNumber,
            productCode: updatedDoc.productId?.productCode || updatedDoc.productCode || '',
            productName: updatedDoc.productId?.productName || updatedDoc.productName || '',
            productId: updatedDoc.productId?._id || null,
            customerId: updatedDoc.customerId?._id || null,
            customerCode: updatedDoc.customerCode || '',
            customerName: updatedDoc.customerNameStr || '',
            customerPostalCode: updatedDoc.customerPostalCode || '',
            invoiceNumber: updatedDoc.invoiceNumber || '',
            saleDate: updatedDoc.saleDate || null,
            location: updatedDoc.location || '',
            indicatorField: updatedDoc.indicatorField || '',
            transactionType: 'UPDATE',
            status: updatedDoc.status,
            createdBy: req.user?.id || null
        });

        res.json({ message: 'Entry updated successfully', data: updatedDoc });
    } catch (error) {
        console.error('updateAsset error:', error);
        res.status(500).json({ message: error.message || 'Error updating entry' });
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
            branchId: asset.branchId || null,
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
        .populate({ path: 'customerId', select: 'customerName companyName externalCode pincode mobile', options: { bypassTenant: true } })
        .populate(productMgrPopulate())
        .sort({ returnDate: -1, createdAt: -1 })
        .lean();

        res.json(applyProductMgrsToAll(historyDocs));
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
            .populate({ path: 'customerId', select: 'customerName companyName externalCode billingAddress pincode mobile', options: { bypassTenant: true } })
            .populate(productMgrPopulate())
            .populate(DIVISION_POPULATE)
            .populate(SEGMENT_POPULATE)
            .sort({ createdAt: -1 })
            .lean();

        res.json(applyProductMgrsToAll(docs));
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
        if (assetId && isValidObjectId(assetId)) {
            asset = await Asset.findOne({ _id: assetId, companyId })
                .populate({ path: 'customerId', select: 'customerName companyName gstin billingAddress mobile email', options: { bypassTenant: true } })
                .populate(productMgrPopulate('basePrice mrp catalogType'))
                .populate('invoiceId', 'voucherNumber date')
                .populate(DIVISION_POPULATE)
                .populate(SEGMENT_POPULATE)
                .lean();
        } else if (serialNumber) {
            const cleanSN = String(serialNumber).trim();
            const escapedSN = cleanSN.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const assetQuery = { serialNumber: { $regex: new RegExp("^" + escapedSN + "$", "i") } };
            if (companyId) assetQuery.companyId = companyId;

            let matches = await Asset.find(assetQuery)
            .populate({ path: 'customerId', select: 'customerName companyName gstin billingAddress mobile email', options: { bypassTenant: true } })
            .populate(productMgrPopulate('basePrice mrp catalogType'))
            .populate('invoiceId', 'voucherNumber date')
            .populate(DIVISION_POPULATE)
            .populate(SEGMENT_POPULATE)
            .lean();

            // Fallback search across tenant boundary if no matches found
            if (matches.length === 0 && companyId) {
                matches = await Asset.find({ serialNumber: { $regex: new RegExp("^" + escapedSN + "$", "i") } })
                .setOptions({ bypassTenant: true })
                .populate({ path: 'customerId', select: 'customerName companyName gstin billingAddress mobile email', options: { bypassTenant: true } })
                .populate(productMgrPopulate('basePrice mrp catalogType'))
                .populate('invoiceId', 'voucherNumber date')
                .lean();
            }

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

                // Ensure customerId object fallback if unpopulated
                if (!asset.customerId && (asset.customerNameStr || asset.customerCode || asset.customerMobile)) {
                    asset.customerId = {
                        _id: 'cust_' + asset._id,
                        companyName: asset.customerNameStr || asset.customerCode || 'Customer',
                        customerName: asset.customerNameStr || asset.customerCode || 'Customer',
                        externalCode: asset.customerCode || '',
                        mobile: asset.customerMobile || '',
                        billingAddress: { pincode: asset.customerPostalCode || '' }
                    };
                }

                // Ensure productId object fallback if unpopulated
                if (!asset.productId && (asset.productName || asset.productCode)) {
                    asset.productId = {
                        _id: 'prod_' + asset._id,
                        productName: asset.productName || asset.productCode || 'Product',
                        productCode: asset.productCode || ''
                    };
                }
            } else {
                // FALLBACK: Search AssetHistory (Transaction Data) if not found in Asset Master
                const historyQuery = { serialNumber: { $regex: new RegExp("^" + escapedSN + "$", "i") } };
                if (companyId) historyQuery.companyId = companyId;

                let historyDoc = await AssetHistory.findOne(historyQuery)
                .sort({ createdAt: -1 })
                .populate('customerId', 'customerName companyName gstin billingAddress mobile email')
                .populate(productMgrPopulate('basePrice mrp catalogType'))
                .lean();

                if (!historyDoc && companyId) {
                    historyDoc = await AssetHistory.findOne({ serialNumber: { $regex: new RegExp("^" + escapedSN + "$", "i") } })
                    .setOptions({ bypassTenant: true })
                    .sort({ createdAt: -1 })
                    .populate('customerId', 'customerName companyName gstin billingAddress mobile email')
                    .populate(productMgrPopulate('basePrice mrp catalogType'))
                    .lean();
                }

                if (historyDoc) {
                    asset = {
                        _id: historyDoc.assetId || historyDoc._id,
                        serialNumber: historyDoc.serialNumber,
                        productId: historyDoc.productId || { _id: 'prod_' + historyDoc._id, productName: historyDoc.productName || 'Product', productCode: historyDoc.productCode || '' },
                        productName: historyDoc.productName || historyDoc.productId?.productName || '',
                        productCode: historyDoc.productCode || historyDoc.productId?.productCode || '',
                        customerId: historyDoc.customerId || {
                            _id: 'cust_' + historyDoc._id,
                            companyName: historyDoc.customerName || 'Customer',
                            customerName: historyDoc.customerName || 'Customer',
                            mobile: historyDoc.customerMobile || '',
                            billingAddress: { pincode: historyDoc.customerPostalCode || '' }
                        },
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
        
        const custIdVal = typeof asset.customerId === 'object' && asset.customerId !== null ? asset.customerId._id : asset.customerId;
        const prodIdVal = typeof asset.productId === 'object' && asset.productId !== null ? asset.productId._id : asset.productId;
        const assetIdVal = asset._id;

        const validCustId = isValidObjectId(custIdVal) ? custIdVal : null;
        const validProdId = isValidObjectId(prodIdVal) ? prodIdVal : null;
        const validAssetId = isValidObjectId(assetIdVal) ? assetIdVal : null;

        let warranty = null;
        if (validCustId && validProdId) {
            warranty = await Warranty.findOne({
                customerId: validCustId,
                productId: validProdId,
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
        if (validCustId) {
            amc = await AMC.findOne({
                customerId: validCustId,
                status: 'Active',
                companyId,
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean();
        }

        let openTicketsCount = 0;
        let closedTicketsCount = 0;
        let lastServiceDate = null;

        if (validAssetId) {
            openTicketsCount = await Ticket.countDocuments({
                assetId: validAssetId,
                status: { $in: ['Open', 'Assigned', 'In Progress', 'Pending Customer', 'Escalated'] },
                companyId
            });

            closedTicketsCount = await Ticket.countDocuments({
                assetId: validAssetId,
                status: { $in: ['Resolved', 'Closed'] },
                companyId
            });

            const tickets = await Ticket.find({ assetId: validAssetId, companyId }).select('_id').lean();
            const ticketIds = tickets.map(t => t._id);
            
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
        }

        // Fetch transaction history
        const history = await AssetHistory.find({
            companyId,
            serialNumber: buildExactRegex(asset.serialNumber)
        }).sort({ createdAt: -1 }).lean();

        // MGR 1-5 always reflect the current Product Master assignment.
        applyProductMgrs(asset);

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
        .populate({ path: 'customerId', select: 'customerName companyName billingAddress mobile email gstin', options: { bypassTenant: true } })
        .populate(productMgrPopulate('basePrice mrp'))
        .populate('invoiceId', 'voucherNumber date')
        .lean();

        // Also search transaction history for historical serials registered in Invoice Bulk Upload
        const historyDocs = await AssetHistory.find({
            companyId,
            serialNumber: { $regex: escapedQuery, $options: 'i' }
        })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate({ path: 'customerId', select: 'customerName companyName billingAddress mobile email gstin', options: { bypassTenant: true } })
        .populate(productMgrPopulate('basePrice mrp'))
        .lean();

        const combinedResults = [];
        const seenSerials = new Set();

        const buildSNKey = (sn, cust, prod) => {
            const cleanSN = String(sn || '').trim().toLowerCase();
            const custStr = String(
                typeof cust === 'object' && cust !== null
                    ? (cust.companyName || cust.customerName || cust._id || '')
                    : (cust || '')
            ).trim().toLowerCase();
            const prodStr = String(
                typeof prod === 'object' && prod !== null
                    ? (prod.productName || prod.productCode || prod._id || '')
                    : (prod || '')
            ).trim().toLowerCase();
            return `${cleanSN}|${custStr}|${prodStr}`;
        };

        // Add active assets from Invoice Bulk Upload
        for (const a of assets) {
            applyProductMgrs(a);
            const cleanSN = String(a.serialNumber || '').trim().toLowerCase();
            const snKey = buildSNKey(
                a.serialNumber,
                a.customerId || a.customerNameStr,
                a.productId || a.productName || a.productCode
            );
            if (seenSerials.has(snKey) || (cleanSN && seenSerials.has(cleanSN))) continue;
            seenSerials.add(snKey);
            if (cleanSN) seenSerials.add(cleanSN);

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
            applyProductMgrs(h);
            const cleanSN = String(h.serialNumber || '').trim().toLowerCase();
            const snKey = buildSNKey(
                h.serialNumber,
                h.customerId || h.customerName,
                h.productId || h.productName || h.productCode
            );
            if (!seenSerials.has(snKey) && (!cleanSN || !seenSerials.has(cleanSN))) {
                seenSerials.add(snKey);
                if (cleanSN) seenSerials.add(cleanSN);
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
