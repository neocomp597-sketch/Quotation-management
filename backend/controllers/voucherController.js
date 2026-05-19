const Voucher = require('../models/Voucher');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');

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

const adjustProductStock = async (voucherData, direction) => {
    for (const item of voucherData.items || []) {
        if (!item.productId) continue;

        const product = await Product.findById(item.productId);
        if (!product) continue;

        const qty = Number(item.qty || 0);
        const stockDelta = direction === 'out' ? -qty : qty;
        let vendorUpdated = false;

        if (voucherData.vendorId) {
            const vendorIndex = product.vendors.findIndex(
                v => v.vendorId.toString() === voucherData.vendorId.toString()
            );

            if (vendorIndex > -1) {
                product.vendors[vendorIndex].stock = Math.max(0, Number(product.vendors[vendorIndex].stock || 0) + stockDelta);
                vendorUpdated = true;
            } else if (direction === 'in') {
                product.vendors.push({
                    vendorId: voucherData.vendorId,
                    price: item.price,
                    stock: qty,
                    isPrimary: product.vendors.length === 0
                });
                vendorUpdated = true;
            }
        }

        if (!vendorUpdated && product.vendors.length > 0) {
            let primaryIndex = product.vendors.findIndex(v => v.isPrimary);
            if (primaryIndex === -1) primaryIndex = 0;
            product.vendors[primaryIndex].stock = Math.max(0, Number(product.vendors[primaryIndex].stock || 0) + stockDelta);
        }

        await product.save();
    }
};

// Get all vouchers
exports.getVouchers = async (req, res) => {
    try {
        const { scope, type } = req.query;
        const filter = {};
        if (type) {
            filter.voucherType = type;
        } else if (scope === 'invoice') {
            filter.voucherType = 'Invoice';
        } else if (scope === 'grn') {
            filter.voucherType = { $in: ['Purchase', 'Sale Return'] };
        }

        const vouchers = await Voucher.find(filter)
            .select('voucherNumber voucherType date vendorId customerId vendorName customerName contactNumber items totalQty totalTax grandTotal totalAmount referenceVoucherId createdAt updatedAt')
            .sort({ createdAt: -1 })
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
        res.status(200).json(voucher);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching voucher details', error: error.message });
    }
};

// Create a new voucher
exports.createVoucher = async (req, res) => {
    try {
        const voucherData = req.body;
        
        // Ensure standard fields formatting
        voucherData.date = new Date(voucherData.date);
        
        cleanObjectIds(voucherData);

        if (voucherData.voucherType === 'Invoice') {
            delete voucherData.vendorId;
            delete voucherData.vendorName;
            delete voucherData.referenceVoucherId;
            if (!voucherData.customerName) {
                return res.status(400).json({ message: 'Customer Name is required for invoices' });
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

        await adjustProductStock(voucherData, isInvoiceType(voucherData.voucherType) ? 'out' : 'in');

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
        const voucherData = req.body;
        cleanObjectIds(voucherData);

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
        const voucher = await Voucher.findByIdAndDelete(req.params.id);
        if (!voucher) {
            return res.status(404).json({ message: 'Voucher not found' });
        }
        res.status(200).json({ message: 'Voucher deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting voucher', error: error.message });
    }
};
