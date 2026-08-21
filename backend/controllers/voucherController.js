const Voucher = require('../models/Voucher');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const stockLedgerService = require('../services/stockLedgerService');

const normalizeVoucherType = (type = '') => String(type || '').trim();
const isInvoiceType = (type = '') => normalizeVoucherType(type) === 'Invoice';
const isInwardType = (type = '') => ['Purchase', 'Sale Return'].includes(normalizeVoucherType(type));

const cleanObjectIds = (voucherData = {}) => {
    if (voucherData.vendorId === '') delete voucherData.vendorId;
    if (voucherData.customerId === '') delete voucherData.customerId;
    if (voucherData.referenceVoucherId === '') delete voucherData.referenceVoucherId;
    if (voucherData.items && Array.isArray(voucherData.items)) {
        voucherData.items.forEach(item => {
            if (item.productId === '') delete item.productId;
        });
    }
};

const adjustProductStock = async (voucherData, savedVoucher, userId) => {
    for (const item of voucherData.items || []) {
        if (!item.productId) continue;

        const qty = Number(item.qty || 0);
        if (qty <= 0) continue;

        let transactionType = 'STOCK_OUT';
        let quantityDelta = -qty;

        const type = normalizeVoucherType(voucherData.voucherType);
        if (type === 'Purchase' || type === 'Purchase Voucher' || type === 'Invoice Voucher') {
            transactionType = 'STOCK_IN';
            quantityDelta = qty;
        } else if (type === 'Sale Return') {
            transactionType = 'RETURN_CUSTOMER';
            quantityDelta = qty;
        } else if (type === 'Purchase Return') {
            transactionType = 'RETURN_SUPPLIER';
            quantityDelta = -qty;
        }

        const serials = (item.serialNumbers || []).map(s => s.serialNumber || s);

        await stockLedgerService.recordTransaction({
            companyId: savedVoucher.companyId || voucherData.companyId,
            productId: item.productId,
            warehouseId: voucherData.warehouseId || null,
            transactionType,
            quantityDelta,
            unitCost: item.price || 0,
            serialNumbers: serials,
            referenceType: 'Voucher',
            referenceId: savedVoucher._id,
            referenceNumber: voucherData.voucherNumber,
            vendorId: voucherData.vendorId || null,
            performedBy: userId,
            notes: `${voucherData.voucherType} #${voucherData.voucherNumber}`
        });
    }
};

// Get all vouchers
exports.getVouchers = async (req, res) => {
    try {
        const { scope, type, voucherType, customerId } = req.query;
        const filter = {};
        if (customerId) {
            filter.customerId = customerId;
        }

        const isVendorUser = req.user?.role === 'vendor' || String(req.user?.role || '').toLowerCase() === 'vendor';
        if (isVendorUser && req.user?.vendorId) {
            filter.vendorId = req.user.vendorId;
        }

        const finalType = type || voucherType;
        if (finalType) {
            filter.voucherType = finalType;
        } else if (scope === 'invoice') {
            filter.voucherType = 'Invoice';
        } else if (scope === 'grn') {
            filter.voucherType = { $in: ['Purchase', 'Sale Return', 'Purchase Voucher', 'Invoice Voucher'] };
        }

        const vouchers = await Voucher.find(filter)
            .select('voucherNumber voucherType date vendorId customerId vendorName customerName contactNumber items totalQty totalTax grandTotal totalAmount referenceVoucherId createdAt updatedAt')
            .sort({ voucherNumber: -1, createdAt: -1 })
            .populate('vendorId', 'name vendorName')
            .populate('customerId', 'companyName customerName')
            .populate('referenceVoucherId', 'voucherNumber')
            .lean();
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vouchers', error: error.message });
    }
};

// Get single voucher
exports.getVoucherById = async (req, res) => {
    try {
        const voucher = await Voucher.findById(req.params.id).lean();
        if (!voucher) {
            return res.status(404).json({ message: 'Voucher not found' });
        }
        const isVendorUser = req.user?.role === 'vendor' || String(req.user?.role || '').toLowerCase() === 'vendor';
        if (isVendorUser && req.user?.vendorId && voucher.vendorId && String(voucher.vendorId) !== String(req.user.vendorId)) {
            return res.status(403).json({ message: 'Not authorized to view this voucher' });
        }
        res.status(200).json(voucher);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching voucher details', error: error.message });
    }
};

// Create a new voucher
exports.createVoucher = async (req, res) => {
    try {
        const isVendorUser = req.user?.role === 'vendor' || String(req.user?.role || '').toLowerCase() === 'vendor';
        if (isVendorUser) {
            return res.status(403).json({ message: 'Vendors only have read-only access to vouchers' });
        }

        const voucherData = req.body;
        
        // Ensure standard fields formatting
        voucherData.date = new Date(voucherData.date);
        
        cleanObjectIds(voucherData);

        // Check for duplicate voucher number within the same company
        if (voucherData.voucherNumber) {
            const existing = await Voucher.findOne({
                companyId: req.user?.companyId,
                voucherNumber: String(voucherData.voucherNumber).trim()
            }).lean();
            if (existing) {
                return res.status(400).json({ message: 'Voucher Number already exists' });
            }
        }

        if (voucherData.voucherType === 'Invoice') {
            delete voucherData.vendorId;
            delete voucherData.vendorName;
            delete voucherData.referenceVoucherId;
            if (!voucherData.customerName) {
                return res.status(400).json({ message: 'Customer Name is required for invoices' });
            }

            // Assign / generate Serial Numbers for invoice products
            const Asset = require('../models/Asset');
            for (const item of voucherData.items || []) {
                if (!item.productId) continue;

                const product = await Product.findById(item.productId).lean();
                if (!product) continue;

                // Skip non-physical items like Services or Subscriptions
                if (['Service', 'Subscription'].includes(product.catalogType)) {
                    continue;
                }

                const qty = Number(item.qty || 0);
                if (qty <= 0) continue;

                // Retrieve oldest available stock serials
                const existingAssets = await Asset.find({
                    companyId: req.user?.companyId,
                    productId: item.productId,
                    status: 'IN_STOCK'
                })
                .sort({ createdAt: 1 })
                .limit(qty);

                const assignedSerials = [];

                for (const asset of existingAssets) {
                    await Asset.findByIdAndUpdate(asset._id, {
                        customerId: voucherData.customerId,
                        status: 'SOLD',
                        invoiceNumber: voucherData.voucherNumber,
                        invoiceDate: voucherData.date,
                        saleDate: voucherData.date,
                        assignedAt: new Date(),
                        createdBy: req.user?.id,
                        warrantyStart: voucherData.date,
                        warrantyEnd: new Date(new Date(voucherData.date).setFullYear(new Date(voucherData.date).getFullYear() + 1))
                    });

                    assignedSerials.push({
                        serialNumber: asset.serialNumber,
                        assetId: asset._id
                    });
                }

                const remaining = qty - existingAssets.length;
                if (remaining > 0) {
                    // Generate new serial numbers
                    let prefix = 'SN';
                    const prodCode = product.productCode;
                    const prodName = product.productName;
                    if (prodCode) {
                        prefix = prodCode.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
                    }
                    if (prefix.length < 2 && prodName) {
                        prefix = prodName.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
                    }
                    if (prefix.length < 2) {
                        prefix = 'DH';
                    }

                    const regex = new RegExp(`^${prefix}\\d+$`);
                    const latestAsset = await Asset.findOne({
                        companyId: req.user?.companyId,
                        serialNumber: regex
                    })
                    .sort({ serialNumber: -1 })
                    .lean();

                    let startIndex = 1;
                    if (latestAsset) {
                        const numPart = latestAsset.serialNumber.slice(prefix.length);
                        const parsed = parseInt(numPart, 10);
                        if (!isNaN(parsed)) {
                            startIndex = parsed + 1;
                        }
                    }

                    for (let i = 0; i < remaining; i++) {
                        const serialNumber = `${prefix}${String(startIndex + i).padStart(3, '0')}`;
                        const wStart = voucherData.date;
                        const wEnd = new Date(wStart);
                        wEnd.setFullYear(wEnd.getFullYear() + 1);

                        const newAsset = await Asset.create({
                            companyId: req.user?.companyId,
                            customerId: voucherData.customerId,
                            productId: item.productId,
                            serialNumber,
                            status: 'SOLD',
                            invoiceNumber: voucherData.voucherNumber,
                            invoiceDate: voucherData.date,
                            saleDate: voucherData.date,
                            assignedAt: new Date(),
                            createdBy: req.user?.id,
                            warrantyStart: wStart,
                            warrantyEnd: wEnd,
                            installationDate: wStart
                        });

                        assignedSerials.push({
                            serialNumber: newAsset.serialNumber,
                            assetId: newAsset._id
                        });
                    }
                }

                item.serialNumbers = assignedSerials;
            }
        } else if (voucherData.voucherType === 'Purchase') {
            delete voucherData.customerId;
            delete voucherData.customerName;
            delete voucherData.referenceVoucherId;
            if (!voucherData.vendorName) {
                return res.status(400).json({ message: 'Vendor Name is required for Purchase/GRN entries' });
            }
        } else if (voucherData.voucherType === 'Sale Return') {
            delete voucherData.vendorId;
            delete voucherData.vendorName;
            if (!voucherData.customerName) {
                return res.status(400).json({ message: 'Customer Name is required for Sale Return entries' });
            }
        } else {
            return res.status(400).json({ message: 'Invalid voucher type' });
        }
        
        const newVoucher = new Voucher(voucherData);
        await newVoucher.save();

        // Update assigned assets with the saved invoice's ObjectId
        if (voucherData.voucherType === 'Invoice') {
            const Asset = require('../models/Asset');
            for (const item of newVoucher.items || []) {
                for (const sn of item.serialNumbers || []) {
                    await Asset.findByIdAndUpdate(sn.assetId, { invoiceId: newVoucher._id });
                }
            }
        }

        await adjustProductStock(voucherData, newVoucher, req.user?.id);

        res.status(201).json({ message: 'Voucher saved successfully', voucher: newVoucher });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Voucher Number already exists' });
        }
        res.status(500).json({ message: 'Error saving voucher', error: error.message });
    }
};

exports.updateVoucher = async (req, res) => {
    try {
        const isVendorUser = req.user?.role === 'vendor' || String(req.user?.role || '').toLowerCase() === 'vendor';
        if (isVendorUser) {
            return res.status(403).json({ message: 'Vendors only have read-only access to vouchers' });
        }

        const voucherData = req.body;
        cleanObjectIds(voucherData);

        // Check for duplicate voucher number on update within the same company
        if (voucherData.voucherNumber) {
            const existing = await Voucher.findOne({
                companyId: req.user?.companyId,
                voucherNumber: String(voucherData.voucherNumber).trim(),
                _id: { $ne: req.params.id }
            }).lean();
            if (existing) {
                return res.status(400).json({ message: 'Voucher Number already exists' });
            }
        }

        if (voucherData.voucherType === 'Invoice') {
            delete voucherData.vendorId;
            delete voucherData.vendorName;
            delete voucherData.referenceVoucherId;
        } else if (voucherData.voucherType === 'Purchase') {
            delete voucherData.customerId;
            delete voucherData.customerName;
            delete voucherData.referenceVoucherId;
        } else if (voucherData.voucherType === 'Sale Return') {
            delete voucherData.vendorId;
            delete voucherData.vendorName;
        }

        const voucher = await Voucher.findByIdAndUpdate(req.params.id, voucherData, { new: true });
        if (!voucher) {
            return res.status(404).json({ message: 'Voucher not found' });
        }
        res.status(200).json({ message: 'Voucher updated', voucher });
    } catch (error) {
        res.status(500).json({ message: 'Error updating voucher', error: error.message });
    }
};

// Delete voucher
exports.deleteVoucher = async (req, res) => {
    try {
        const isVendorUser = req.user?.role === 'vendor' || String(req.user?.role || '').toLowerCase() === 'vendor';
        if (isVendorUser) {
            return res.status(403).json({ message: 'Vendors only have read-only access to vouchers' });
        }

        const voucher = await Voucher.findByIdAndDelete(req.params.id);
        if (!voucher) {
            return res.status(404).json({ message: 'Voucher not found' });
        }
        res.status(200).json({ message: 'Voucher deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting voucher', error: error.message });
    }
};
